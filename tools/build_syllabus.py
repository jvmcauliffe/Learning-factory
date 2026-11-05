#!/usr/bin/env python3
"""Parse content/saa-c03/00-README.md into data/saa-c03/syllabus.json.

Standard library only. Output is sorted by reading order and byte-stable.
Every guide is a candidate; nothing here is verified.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = "content/saa-c03/00-README.md"
OUT = "data/saa-c03/syllabus.json"

GROUP_RE = re.compile(r"^### (?P<name>.+?)\s*$")
ROW_RE = re.compile(r"^\|\s*(?P<num>\d\d)\s*\|\s*\[(?P<title>[^\]]+)\]\((?P<file>\d\d-[^)]+\.md)\)\s*\|\s*(?P<owns>.*?)\s*\|\s*$")
HEADING_ORDER_RE = re.compile(r"^## Suggested reading order")
NEXT_H2_RE = re.compile(r"^## ")


def clean_group(name):
    """Drop the leading emoji and spaces; keep the words the author wrote."""
    return re.sub(r"^[^\w(]+", "", name).strip()


def build(root=ROOT):
    lines = (Path(root) / INDEX).read_text(encoding="utf-8").splitlines()
    in_order = False
    group = None
    groups = []
    order = 0
    for number, line in enumerate(lines, start=1):
        if HEADING_ORDER_RE.match(line):
            in_order = True
            continue
        if in_order and NEXT_H2_RE.match(line):
            break
        if not in_order:
            continue
        g = GROUP_RE.match(line)
        if g:
            group = {"name": clean_group(g.group("name")), "raw_heading": g.group("name"), "guides": []}
            groups.append(group)
            continue
        r = ROW_RE.match(line)
        if r and group is not None:
            order += 1
            group["guides"].append({
                "order": order,
                "guide_number": r.group("num"),
                "title": r.group("title"),
                "file": "content/saa-c03/" + r.group("file"),
                "owns_questions_about": r.group("owns"),
                "source_line": number,
            })
    for index, g in enumerate(groups, start=1):
        g["group_order"] = index
    data = {
        "source": {
            "file": INDEX,
            "upstream": "https://github.com/RonitSachdev/aws-saa-c03-guides",
            "licence": "CC BY 4.0",
        },
        "status": "candidate",
        "guide_count": order,
        "groups": groups,
    }
    return json.dumps(data, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def main():
    text = build()
    out = ROOT / OUT
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding="utf-8")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    sys.exit(main())
