#!/usr/bin/env python3
"""Build data/saa-c03/bank.json from the SAA-C03 topic guides.

Standard library only. Output is sorted and stable, so two runs give the same bytes.
Every item records the guide file, section and 1-based line number it came from.
Text is kept exactly as written in the guide (markdown included); nothing is reworded.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GUIDE_DIR = "content/saa-c03"
OUT = ROOT / "data" / "saa-c03" / "bank.json"

GUIDE_RE = re.compile(r"^(\d\d)-.+\.md$")
QUESTION_RE = re.compile(r'^> \*"(?P<scenario>.+)"\* → \*\*(?P<answer>.+?)\*\*(?P<rest>.*)$')
TRAP_RE = re.compile(r"\btrap\b", re.IGNORECASE)


class ParseError(Exception):
    pass


def guide_files(root):
    files = sorted(p for p in (root / GUIDE_DIR).iterdir() if GUIDE_RE.match(p.name) and p.name[:2] != "00")
    return files


def section_lines(lines, heading):
    """Yield (line_number, text) for lines under '## <heading>' until the next '## '."""
    inside = False
    for number, text in enumerate(lines, 1):
        if text.startswith("## "):
            inside = text[3:].strip().lower() == heading.lower()
            continue
        if inside:
            yield number, text


def parse_pocket_card(guide, lines):
    items = []
    rows = [(n, t) for n, t in section_lines(lines, "Pocket card") if t.startswith("|")]
    if len(rows) < 3:
        raise ParseError(f"{guide}: no parsable Pocket card table")
    for number, text in rows[2:]:  # skip header and separator
        cells = [c.strip() for c in text.strip().strip("|").split("|")]
        if len(cells) < 2:
            raise ParseError(f"{guide}:{number}: pocket card row has fewer than two cells")
        keyword, answer = cells[0], " | ".join(cells[1:])
        items.append({
            "type": "pocket_card", "guide": guide, "section": "Pocket card", "line": number,
            "keyword": keyword, "answer": answer, "is_trap": bool(TRAP_RE.search(text)),
        })
    return items


def parse_questions(guide, lines):
    items = []
    for number, text in section_lines(lines, "Question patterns"):
        if not text.startswith(">"):
            continue
        match = QUESTION_RE.match(text)
        if not match:
            raise ParseError(f"{guide}:{number}: question pattern does not match the expected shape")
        rest = match.group("rest").strip()
        if rest.startswith("(") and rest.endswith(")"):
            rest = rest[1:-1].strip()
        items.append({
            "type": "question_pattern", "guide": guide, "section": "Question patterns", "line": number,
            "scenario": match.group("scenario"), "answer": match.group("answer"), "signal": rest,
        })
    return items


def build(root=ROOT):
    items = []
    guides = guide_files(root)
    for path in guides:
        lines = path.read_text(encoding="utf-8").splitlines()
        guide = f"{GUIDE_DIR}/{path.name}"
        pocket = parse_pocket_card(guide, lines)
        questions = parse_questions(guide, lines)
        if not questions:
            raise ParseError(f"{guide}: no question patterns found")
        items.extend(pocket + questions)
    items.sort(key=lambda i: (i["guide"], i["line"]))
    for index, item in enumerate(items, 1):
        item["id"] = f"b{index:04d}"
    bank = {
        "source": "RonitSachdev/aws-saa-c03-guides @ a71e466f02702fe01a6fe414c0b49cb8a673d205 (CC BY 4.0)",
        "status": "candidate",
        "guide_count": len(guides),
        "item_count": len(items),
        "items": items,
    }
    return json.dumps(bank, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def main():
    try:
        text = build()
    except ParseError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(text, encoding="utf-8")
    data = json.loads(text)
    print(f"wrote {OUT.relative_to(ROOT)}: {data['guide_count']} guides, {data['item_count']} items")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
