#!/usr/bin/env python3
"""Build data/saa-c03/glossary.json from the bold terms in the SAA-C03 guides.

Standard library only. Output is sorted and byte-stable.

Nothing is written by hand and nothing is reworded. A glossary entry is a bold
term plus the guide's own sentence (or table cell) that introduces it, copied
exactly as the guide wrote it (markdown included), with the guide file and the
1-based line it sits on. A bold phrase that is not a term, or that has no
introducing sentence, is left out and listed in glossary-skipped.json.
Every entry is a candidate; nothing here is verified.

An introducing sentence is one of:
  * a sentence where the bold term is followed by "is", "are", "means" or
    "stands for";
  * a sentence where the bold term is followed by a dash (a bullet such as
    "- **Effect** - ...");
  * a sentence where an acronym (two capitals or more) is followed straight
    away by a bracket, as in "**ARN** (Amazon Resource Name ...)";
  * the definition cell of a table whose header names a definition column
    ("One-liner", "What it does", ...), taken from the row whose first cell is
    just the bold term.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GUIDE_DIR = "content/saa-c03"
OUT = ROOT / "data" / "saa-c03" / "glossary.json"
SKIPPED = ROOT / "data" / "saa-c03" / "glossary-skipped.json"

SOURCE = "RonitSachdev/aws-saa-c03-guides @ a71e466f02702fe01a6fe414c0b49cb8a673d205 (CC BY 4.0)"
CREDIT = "Terms and sentences are RonitSachdev's, from aws-saa-c03-guides (CC BY 4.0). https://github.com/RonitSachdev/aws-saa-c03-guides"

GUIDE_RE = re.compile(r"^(\d\d)-.+\.md$")
HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*#*\s*$")
BOLD_RE = re.compile(r"\*\*([^*\n]+?)\*\*")
LIST_RE = re.compile(r"^(\s*(?:[-*+]|\d+[.)])\s+)")
SEPARATOR_RE = re.compile(r"^\|[\s:|-]+\|?\s*$")
SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z*\"'(\[`])")
DEFINITION_HEADERS = {
    "one-liner", "what it does", "what it is", "how it works", "meaning", "job",
    "role in dr", "one-line essence",
}
MAX_TERM_WORDS = 6
CLAIM_WORDS = {"never", "always", "not", "must", "only", "cannot", "does", "will", "should"}
MIN_SENTENCE_WORDS = 4
MAX_SENTENCE_CHARS = 400


def slug(text):
    """Same rule as sectionSlug() in site/reader-logic.js."""
    s = re.sub(r"[^a-z0-9]+", "-", text.lower().replace("&", " and ")).strip("-")
    return s or "section"


def plain(text):
    return re.sub(r"[*_`]", "", text)


def guide_files(root):
    folder = Path(root) / GUIDE_DIR
    return sorted(p for p in folder.glob("*.md") if GUIDE_RE.match(p.name) and not p.name.startswith("00-"))


def term_problem(term):
    """Why a bold phrase cannot be a glossary term, or None."""
    if not term:
        return "empty bold phrase"
    if term[-1] in "?:!.,;":
        return "bold phrase ends in punctuation, so it is not a term"
    if len(term.split()) > MAX_TERM_WORDS:
        return "bold phrase is longer than six words, so it is not a term"
    if not re.search(r"[A-Za-z0-9]", term):
        return "bold phrase has no letters or digits"
    if CLAIM_WORDS & set(re.findall(r"[a-z]+", term.lower())):
        return "bold phrase is a claim, not a term"
    return None


def sentences(text):
    """(start, end) offsets of the sentences in text, ends excluded."""
    spans = []
    start = 0
    for match in SENTENCE_SPLIT_RE.finditer(text):
        spans.append((start, match.start()))
        start = match.end()
    spans.append((start, len(text)))
    return spans


def introduces(after, term):
    """True when the text after a bold term makes its sentence an introduction."""
    if re.match(r"\s*[—–]\s", after) or re.match(r"\s+-\s", after):
        return True
    if re.match(r"\s+(is|are|means|stands for)\s", after):
        return True
    if re.match(r"\s*\(", after) and re.search(r"[A-Z]{2,}", term):
        return True
    return False


def prose_candidates(line):
    """Yield (term, sentence) for every bold term in a prose or list line."""
    marker = LIST_RE.match(line)
    offset = marker.end() if marker else 0
    body = line[offset:]
    spans = sentences(body)
    for bold in BOLD_RE.finditer(body):
        term = bold.group(1).strip()
        for start, end in spans:
            if start <= bold.start() < end or (bold.start() >= start and end == len(body)):
                sentence = body[start:end].strip()
                after = body[bold.end():end]
                yield term, sentence, introduces(after, term)
                break


def table_candidate(line, header):
    """(term, cell) for a definition-table row, else None."""
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    if len(cells) < 2 or len(header) < 2:
        return None
    if header[1].lower() not in DEFINITION_HEADERS:
        return None
    match = re.fullmatch(r"\*\*([^*]+?)\*\*", cells[0])
    if not match or not cells[1]:
        return None
    return match.group(1).strip(), cells[1]


def scan(guide, lines):
    """Yield (term, sentence_or_None, line_number, section, section_slug, problem)."""
    in_code = False
    heading = ""
    seen_slugs = {}
    slugs = {}
    table_header = None
    for number, raw in enumerate(lines, start=1):
        line = raw.rstrip()
        if line.lstrip().startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue
        found = HEADING_RE.match(line)
        if found:
            heading = found.group(2)
            base = slug(heading)
            seen_slugs[base] = seen_slugs.get(base, 0) + 1
            slugs[heading] = base if seen_slugs[base] == 1 else f"{base}-{seen_slugs[base]}"
            table_header = None
            current = slugs[heading]
            continue
        current = slugs.get(heading, "")
        if line.startswith("|"):
            cells = [c.strip() for c in line.strip("|").split("|")]
            if SEPARATOR_RE.match(line):
                continue
            if table_header is None:
                table_header = cells
                continue
            if heading in ("Pocket card", "Question patterns"):
                continue
            found_row = table_candidate(line, table_header)
            if found_row:
                term, cell = found_row
                yield term, cell, number, heading, current, term_problem(term)
            continue
        table_header = None
        if line.startswith(">") or not line.strip():
            continue
        for term, sentence, ok in prose_candidates(line):
            problem = term_problem(term)
            if problem is None and not ok:
                problem = "no introducing sentence in the guide's own words"
            if problem is None and len(sentence.split()) < MIN_SENTENCE_WORDS:
                problem = "the introducing sentence is too short to define the term"
            if problem is None and len(sentence) > MAX_SENTENCE_CHARS:
                problem = "the introducing sentence is longer than 400 characters"
            yield term, (sentence if problem is None else None), number, heading, current, problem


def build(root=ROOT):
    entries = {}
    skipped = {}
    for path in guide_files(root):
        guide = f"{GUIDE_DIR}/{path.name}"
        lines = path.read_text(encoding="utf-8").splitlines()
        for term, sentence, number, section, section_slug, problem in scan(guide, lines):
            key = term.lower()
            if problem is None:
                if key not in entries:
                    entries[key] = {
                        "term": term, "sentence": sentence, "guide": guide, "line": number,
                        "section": section, "section_slug": section_slug,
                    }
            elif key not in skipped:
                skipped[key] = {"term": term, "guide": guide, "line": number, "reason": problem}
    for key in entries:
        skipped.pop(key, None)
    glossary = sorted(entries.values(), key=lambda e: (e["term"].lower(), e["guide"], e["line"]))
    left_out = sorted(skipped.values(), key=lambda e: (e["term"].lower(), e["guide"], e["line"]))
    for index, entry in enumerate(glossary, 1):
        entry["id"] = f"g{index:04d}"
    doc = {
        "source": SOURCE, "credit": CREDIT, "status": "candidate",
        "entry_count": len(glossary), "entries": glossary,
    }
    skip_doc = {
        "source": SOURCE, "credit": CREDIT, "status": "candidate",
        "note": "Bold phrases that are not terms, or that have no introducing sentence in the guide's own words. Never defined by hand.",
        "skipped_count": len(left_out), "skipped": left_out,
    }
    dump = lambda d: json.dumps(d, indent=2, sort_keys=True, ensure_ascii=False) + "\n"
    return dump(doc), dump(skip_doc)


def main():
    text, skipped = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(text, encoding="utf-8")
    SKIPPED.write_text(skipped, encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}: {json.loads(text)['entry_count']} entries; "
          f"{SKIPPED.relative_to(ROOT)}: {json.loads(skipped)['skipped_count']} skipped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
