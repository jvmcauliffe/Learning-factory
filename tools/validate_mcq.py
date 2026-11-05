#!/usr/bin/env python3
"""Validate SAA-C03 multiple-choice question files against the guides.

Standard library only. Usage:

    python3 tools/validate_mcq.py [FILE_OR_DIR ...]

With no arguments it checks every *.json in data/saa-c03/mcq/ except schema.json.
Exit code 0 means every file is clean; 1 means at least one plain-language
problem was printed.

What it checks (nothing here adds an AWS fact; it only compares questions with
the guides in content/saa-c03/, RonitSachdev/aws-saa-c03-guides, CC BY 4.0,
https://github.com/RonitSachdev/aws-saa-c03-guides):

1. Shape: the file matches data/saa-c03/mcq/schema.json.
2. Every source reference (the question's, and one per option) points at a real,
   non-blank line of a real guide.
3. The correct option is the guide's own answer: its source line is a bank item
   of the question's guide and its text equals that item's answer.
4. Every wrong option is another guide answer from the same syllabus group
   (the question's guide or a related guide), and differs from the correct one.
5. Every option has an explanation, and no two options repeat.
6. No two questions share a stem or an id, across all files checked together.
7. Status is candidate. Only John sets verified, so verified is rejected.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MCQ_DIR = ROOT / "data" / "saa-c03" / "mcq"
SCHEMA_PATH = MCQ_DIR / "schema.json"
BANK_PATH = ROOT / "data" / "saa-c03" / "bank.json"
SYLLABUS_PATH = ROOT / "data" / "saa-c03" / "syllabus.json"


def norm(text):
    """Compare answers ignoring bold marks, case and spacing."""
    return re.sub(r"\s+", " ", str(text).replace("**", "")).strip().casefold()


# ---------------------------------------------------------------- schema ----

def _type_ok(value, name):
    if name == "object":
        return isinstance(value, dict)
    if name == "array":
        return isinstance(value, list)
    if name == "string":
        return isinstance(value, str)
    if name == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    return True


def check_schema(value, schema, root, path="file"):
    """Check a value against the subset of JSON Schema that schema.json uses."""
    problems = []
    if "$ref" in schema:
        node = root
        for part in schema["$ref"].lstrip("#/").split("/"):
            node = node[part]
        return check_schema(value, node, root, path)
    want = schema.get("type")
    if want and not _type_ok(value, want):
        return [f"{path}: should be {_plain_type(want)}"]
    if "enum" in schema and value not in schema["enum"]:
        problems.append(f"{path}: must be one of {', '.join(map(str, schema['enum']))} (got {value!r})")
    if isinstance(value, str):
        if "minLength" in schema and len(value.strip()) < schema["minLength"]:
            problems.append(f"{path}: too short (needs at least {schema['minLength']} characters)")
        if "pattern" in schema and not re.search(schema["pattern"], value):
            problems.append(f"{path}: wrong format ({value!r})")
    if isinstance(value, int) and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]:
            problems.append(f"{path}: must be at least {schema['minimum']} (got {value})")
        if "maximum" in schema and value > schema["maximum"]:
            problems.append(f"{path}: must be at most {schema['maximum']} (got {value})")
    if isinstance(value, list):
        if "minItems" in schema and len(value) < schema["minItems"]:
            problems.append(f"{path}: needs at least {schema['minItems']} items (has {len(value)})")
        if "maxItems" in schema and len(value) > schema["maxItems"]:
            problems.append(f"{path}: needs at most {schema['maxItems']} items (has {len(value)})")
        if "items" in schema:
            for i, item in enumerate(value):
                problems += check_schema(item, schema["items"], root, f"{path}[{i}]")
    if isinstance(value, dict):
        for key in schema.get("required", []):
            if key not in value:
                problems.append(f"{path}: missing '{key}'")
        props = schema.get("properties", {})
        if schema.get("additionalProperties") is False:
            for key in value:
                if key not in props:
                    problems.append(f"{path}: unexpected field '{key}'")
        for key, sub in props.items():
            if key in value:
                problems += check_schema(value[key], sub, root, f"{path}.{key}")
    return problems


def _plain_type(name):
    return {"object": "an object", "array": "a list", "string": "text", "integer": "a whole number"}.get(name, name)


# ---------------------------------------------------------------- context ---

class Context:
    """The guides, the bank and the syllabus groups, loaded once."""

    def __init__(self, root=ROOT):
        self.root = Path(root)
        self.schema = json.loads((self.root / "data/saa-c03/mcq/schema.json").read_text(encoding="utf-8"))
        bank = json.loads((self.root / "data/saa-c03/bank.json").read_text(encoding="utf-8"))
        self.answers = {(i["guide"], i["line"]): i["answer"] for i in bank["items"]}
        syllabus = json.loads((self.root / "data/saa-c03/syllabus.json").read_text(encoding="utf-8"))
        self.group_of = {}
        for group in syllabus["groups"]:
            for lesson in group["guides"]:
                self.group_of[lesson["file"]] = group["name"]
        self._lines = {}

    def guide_lines(self, guide):
        if guide not in self._lines:
            path = self.root / guide
            if guide.startswith("content/saa-c03/") and ".." not in guide and path.is_file():
                self._lines[guide] = path.read_text(encoding="utf-8").split("\n")
            else:
                self._lines[guide] = None
        return self._lines[guide]

    def resolve(self, guide, line):
        """Return None if the reference is a real non-blank line, else a plain reason."""
        lines = self.guide_lines(guide)
        if lines is None:
            return f"guide {guide} does not exist in content/saa-c03/"
        if not isinstance(line, int) or line < 1 or line > len(lines):
            return f"{guide} has no line {line} (it has {len(lines)})"
        if not lines[line - 1].strip():
            return f"{guide} line {line} is blank"
        return None


# ---------------------------------------------------------------- checks ----

def check_question(q, ctx, label):
    """Checks that need the guides. Assumes the shape already passed."""
    problems = []
    guide = q["guide"]
    options = q["options"]

    texts = [norm(o["text"]) for o in options]
    if len(set(texts)) != len(texts):
        problems.append(f"{label}: two options have the same text")

    for i, opt in enumerate(options):
        src = opt["source"]
        reason = ctx.resolve(src["guide"], src["line"])
        if reason:
            problems.append(f"{label}: option {i + 1} source: {reason}")

    if ctx.guide_lines(guide) is None:
        problems.append(f"{label}: guide {guide} does not exist in content/saa-c03/")

    correct = options[q["correct"]]
    csrc = correct["source"]
    if csrc["guide"] != guide:
        problems.append(
            f"{label}: the correct option's source is {csrc['guide']}, not the question's guide {guide}"
        )
    else:
        bank_answer = ctx.answers.get((csrc["guide"], csrc["line"]))
        if bank_answer is None:
            problems.append(
                f"{label}: the correct option's source ({csrc['guide']} line {csrc['line']}) is not one of the guide's own answers"
            )
        elif norm(bank_answer) != norm(correct["text"]):
            problems.append(
                f"{label}: the correct option does not match the guide; line {csrc['line']} says {bank_answer!r}, the option says {correct['text']!r}"
            )

    group = ctx.group_of.get(guide)
    for i, opt in enumerate(options):
        if i == q["correct"]:
            continue
        src = opt["source"]
        bank_answer = ctx.answers.get((src["guide"], src["line"]))
        if bank_answer is None:
            problems.append(
                f"{label}: wrong option {i + 1} is not one of the guides' own answers ({src['guide']} line {src['line']})"
            )
            continue
        if norm(bank_answer) != norm(opt["text"]):
            problems.append(
                f"{label}: wrong option {i + 1} does not match its source; line {src['line']} says {bank_answer!r}, the option says {opt['text']!r}"
            )
        if ctx.group_of.get(src["guide"]) != group:
            problems.append(
                f"{label}: wrong option {i + 1} comes from {src['guide']}, which is not the same or a related guide (group: {group})"
            )
        if norm(opt["text"]) == norm(correct["text"]):
            problems.append(f"{label}: wrong option {i + 1} repeats the correct answer")

    if q["status"] != "candidate":
        problems.append(f"{label}: status is {q['status']!r}; new questions must be 'candidate' (only John sets verified)")
    return problems


def validate_data(data, ctx, source_name="file", seen=None):
    """Validate one parsed file. `seen` carries stems and ids across files."""
    seen = {"stems": {}, "ids": {}} if seen is None else seen
    problems = check_schema(data, ctx.schema, ctx.schema, source_name)
    if problems:
        return problems
    for index, q in enumerate(data["questions"]):
        label = f"{source_name}: question {q['id']}"
        shape = check_schema(q, ctx.schema["$defs"]["question"], ctx.schema, label)
        if shape:  # already caught above, kept for safety
            problems += shape
            continue
        problems += check_question(q, ctx, label)
        stem = norm(q["stem"])
        if stem in seen["stems"]:
            problems.append(f"{label}: same stem as {seen['stems'][stem]}")
        else:
            seen["stems"][stem] = f"{source_name}: question {q['id']}"
        if q["id"] in seen["ids"]:
            problems.append(f"{label}: id already used by {seen['ids'][q['id']]}")
        else:
            seen["ids"][q["id"]] = f"{source_name}: question {q['id']}"
    return problems


def validate_paths(paths, ctx):
    problems = []
    seen = {"stems": {}, "ids": {}}
    for path in paths:
        name = str(path)
        try:
            data = json.loads(Path(path).read_text(encoding="utf-8"))
        except FileNotFoundError:
            problems.append(f"{name}: file not found")
            continue
        except ValueError as err:
            problems.append(f"{name}: not valid JSON ({err})")
            continue
        problems += validate_data(data, ctx, name, seen)
    return problems


def collect(args, root=ROOT):
    mcq = Path(root) / "data/saa-c03/mcq"
    targets = [Path(a) for a in args] or [mcq]
    files = []
    for t in targets:
        if t.is_dir():
            files += sorted(p for p in t.glob("*.json") if p.name != "schema.json")
        else:
            files.append(t)
    return files


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    ctx = Context()
    files = collect(args)
    problems = validate_paths(files, ctx)
    for p in problems:
        print(p)
    if problems:
        print(f"{len(problems)} problem(s) in {len(files)} file(s). Not valid.")
        return 1
    print(f"{len(files)} question file(s) checked. No problems.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
