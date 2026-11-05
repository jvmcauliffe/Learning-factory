#!/usr/bin/env python3
"""Turn raw letmemaster.com pages into data/letmemaster/<slug>.json (standard library only).

Each output holds source_url, fetched_at, raw_sha256, status "candidate", the page
title and its headings, paragraphs, lists and tables. Text is kept exactly as
fetched: entities are decoded and the ends of each text are trimmed, nothing is
reworded, merged or re-wrapped. A list item or table cell inside a paragraph is
not merged into it, and a nested list is its own list. There is no quiz-specific
mapping here; that waits for a real crawl (a later packet).

The output is deterministic: the same raw files always give the same bytes.
Fetched content is a candidate only. Credit: letmemaster.com (Jeremy, "Let me master").
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "raw" / "letmemaster"
OUT_DIR = ROOT / "data" / "letmemaster"

SKIP_TAGS = frozenset({"script", "style", "noscript", "template"})
HEADINGS = frozenset({"h1", "h2", "h3", "h4", "h5", "h6"})
LISTS = frozenset({"ul", "ol"})
CELLS = frozenset({"td", "th"})
TEXT_KINDS = frozenset(HEADINGS | {"p", "li"} | CELLS)
STRUCTURE = frozenset(HEADINGS | LISTS | CELLS | {"p", "li", "tr", "table"})


class _Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title_parts, self.in_title = [], False
        self.skip = 0
        self.stack = []
        self.headings, self.paragraphs, self.lists, self.tables = [], [], [], []

    # -- helpers -------------------------------------------------------------

    def _open(self, tag, **extra):
        entry = {"tag": tag, "buf": [], **extra}
        self.stack.append(entry)
        return entry

    def _close_top(self):
        entry = self.stack.pop()
        text = "".join(entry["buf"]).strip()
        tag = entry["tag"]
        if tag in HEADINGS:
            if text:
                self.headings.append({"level": int(tag[1]), "text": text})
        elif tag == "p":
            if text:
                self.paragraphs.append(text)
        elif tag == "li":
            owner = next((e for e in reversed(self.stack) if e["tag"] in LISTS), None)
            if owner is not None and text:
                owner["items"].append(text)
        elif tag in CELLS:
            row = next((e for e in reversed(self.stack) if e["tag"] == "tr"), None)
            if row is not None:
                row["cells"].append(text)
        elif tag == "tr":
            table = next((e for e in reversed(self.stack) if e["tag"] == "table"), None)
            if table is not None and entry["cells"]:
                table["rows"].append(entry["cells"])

    def _close_until(self, tags):
        """Close open elements down to and including the nearest one in tags."""
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i]["tag"] in tags:
                while len(self.stack) > i:
                    self._close_top()
                return

    def _close_implied(self, tag):
        """Close elements that HTML closes implicitly when this tag starts."""
        if tag in CELLS or tag == "tr":
            while self.stack and self.stack[-1]["tag"] in {"p"} | CELLS | ({"tr"} if tag == "tr" else set()):
                self._close_top()
        elif tag == "li":
            while self.stack and self.stack[-1]["tag"] in {"p", "li"}:
                self._close_top()
        elif tag in STRUCTURE:
            while self.stack and self.stack[-1]["tag"] == "p":
                self._close_top()

    # -- parser callbacks ----------------------------------------------------

    def handle_starttag(self, tag, attrs):
        if tag in SKIP_TAGS:
            self.skip += 1
            return
        if tag == "title":
            self.in_title = True
            return
        if tag not in STRUCTURE:
            return
        self._close_implied(tag)
        if tag in LISTS:
            entry = self._open(tag, items=[])
            self.lists.append(entry)
            entry["ordered"] = tag == "ol"
        elif tag == "table":
            entry = self._open(tag, rows=[])
            self.tables.append(entry)
        elif tag == "tr":
            self._open(tag, cells=[])
        else:
            self._open(tag)

    def handle_endtag(self, tag):
        if tag in SKIP_TAGS:
            self.skip = max(0, self.skip - 1)
        elif tag == "title":
            self.in_title = False
        elif tag in STRUCTURE:
            self._close_until({tag})

    def handle_data(self, data):
        if self.skip:
            return
        if self.in_title:
            self.title_parts.append(data)
            return
        for entry in reversed(self.stack):
            if entry["tag"] in TEXT_KINDS:
                entry["buf"].append(data)
            elif entry["tag"] in LISTS or entry["tag"] == "table":
                break   # text after a nested list or table is not part of the item above it

    def finish(self):
        self.close()
        while self.stack:
            self._close_top()
        return {
            "title": "".join(self.title_parts).strip(),
            "headings": self.headings,
            "paragraphs": self.paragraphs,
            "lists": [{"ordered": e["ordered"], "items": e["items"]} for e in self.lists if e["items"]],
            "tables": [{"rows": e["rows"]} for e in self.tables if e["rows"]],
        }


def parse_html(text):
    page = _Page()
    page.feed(text)
    return page.finish()


def render(doc):
    return json.dumps(doc, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def parse_all(raw_dir=RAW_DIR, out_dir=OUT_DIR):
    """Parse every saved page listed in the manifest; return (written, problems)."""
    raw_dir, out_dir = Path(raw_dir), Path(out_dir)
    manifest_path = raw_dir / "manifest.json"
    if not manifest_path.is_file():
        raise FileNotFoundError(f"{manifest_path} not found: run tools/fetch_letmemaster.py first")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    written, problems = [], []
    for url in sorted(manifest["pages"]):
        entry = manifest["pages"][url]
        if entry.get("status") != 200 or not entry.get("file"):
            continue
        raw = (raw_dir / "pages" / entry["file"]).read_bytes()
        if hashlib.sha256(raw).hexdigest() != entry["sha256"]:
            problems.append(f"{entry['file']}: raw file does not match the manifest hash; skipped")
            continue
        doc = {"source_url": url, "fetched_at": entry["fetched_at"], "raw_sha256": entry["sha256"],
               "status": "candidate"}
        doc.update(parse_html(raw.decode("utf-8", "replace")))
        out_dir.mkdir(parents=True, exist_ok=True)
        target = out_dir / (Path(entry["file"]).stem + ".json")
        target.write_text(render(doc), encoding="utf-8")
        written.append(target.name)
    return written, problems


def main(argv=None):
    parser = argparse.ArgumentParser(description="Parse raw letmemaster.com pages into candidate JSON.")
    parser.add_argument("--raw-dir", default=str(RAW_DIR))
    parser.add_argument("--out-dir", default=str(OUT_DIR))
    args = parser.parse_args(argv)
    try:
        written, problems = parse_all(args.raw_dir, args.out_dir)
    except FileNotFoundError as err:
        print(f"parse_letmemaster: {err}", file=sys.stderr)
        return 2
    for problem in problems:
        print(f"parse_letmemaster: {problem}", file=sys.stderr)
    print(json.dumps({"parsed": len(written), "problems": len(problems)}, sort_keys=True))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
