import json
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

import build_glossary as bg  # noqa: E402

GLOSSARY = ROOT / "data" / "saa-c03" / "glossary.json"
SKIPPED = ROOT / "data" / "saa-c03" / "glossary-skipped.json"


class GlossaryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc = json.loads(GLOSSARY.read_text(encoding="utf-8"))
        cls.skipped = json.loads(SKIPPED.read_text(encoding="utf-8"))
        cls.entries = cls.doc["entries"]

    def guide_lines(self, guide):
        return (ROOT / guide).read_text(encoding="utf-8").splitlines()

    def test_rebuild_is_byte_identical_to_committed_files(self):
        text, skipped = bg.build()
        self.assertEqual(text, GLOSSARY.read_text(encoding="utf-8"))
        self.assertEqual(skipped, SKIPPED.read_text(encoding="utf-8"))

    def test_two_builds_are_identical(self):
        self.assertEqual(bg.build(), bg.build())

    def test_status_credit_and_count(self):
        for doc in (self.doc, self.skipped):
            self.assertEqual(doc["status"], "candidate")
            self.assertIn("RonitSachdev", doc["credit"])
            self.assertIn("CC BY 4.0", doc["credit"])
        self.assertEqual(self.doc["entry_count"], len(self.entries))
        self.assertEqual(self.skipped["skipped_count"], len(self.skipped["skipped"]))
        self.assertGreater(len(self.entries), 100)

    def test_every_sentence_is_quoted_from_its_source_line(self):
        for e in self.entries:
            lines = self.guide_lines(e["guide"])
            self.assertTrue(1 <= e["line"] <= len(lines), e["id"])
            self.assertIn(e["sentence"], lines[e["line"] - 1], e["id"])

    def test_every_term_is_bold_on_its_source_line(self):
        for e in self.entries:
            line = self.guide_lines(e["guide"])[e["line"] - 1]
            self.assertIn("**" + e["term"] + "**", line, e["id"])

    def test_every_skipped_line_resolves(self):
        for s in self.skipped["skipped"]:
            lines = self.guide_lines(s["guide"])
            self.assertTrue(1 <= s["line"] <= len(lines), s["term"])
            self.assertIn(s["term"], lines[s["line"] - 1], s["term"])
            self.assertTrue(s["reason"])

    def test_terms_are_unique_and_sorted(self):
        keys = [e["term"].lower() for e in self.entries]
        self.assertEqual(len(keys), len(set(keys)))
        self.assertEqual(keys, sorted(keys))

    def test_ids_run_in_order(self):
        self.assertEqual([e["id"] for e in self.entries], [f"g{i:04d}" for i in range(1, len(self.entries) + 1)])

    def test_skipped_terms_are_not_in_the_glossary(self):
        have = {e["term"].lower() for e in self.entries}
        for s in self.skipped["skipped"]:
            self.assertNotIn(s["term"].lower(), have)

    def test_section_slug_matches_a_heading_in_the_guide(self):
        for e in self.entries:
            slugs = set()
            seen = {}
            for line in self.guide_lines(e["guide"]):
                m = bg.HEADING_RE.match(line)
                if m:
                    base = bg.slug(m.group(2))
                    seen[base] = seen.get(base, 0) + 1
                    slugs.add(base if seen[base] == 1 else f"{base}-{seen[base]}")
            if e["section_slug"]:
                self.assertIn(e["section_slug"], slugs, e["id"])

    def test_no_entry_is_a_claim_or_too_long(self):
        for e in self.entries:
            self.assertFalse(bg.CLAIM_WORDS & set(re.findall(r"[a-z]+", e["term"].lower())), e["term"])
            self.assertLessEqual(len(e["term"].split()), bg.MAX_TERM_WORDS, e["term"])
            self.assertLessEqual(len(e["sentence"]), bg.MAX_SENTENCE_CHARS, e["id"])

    def test_pocket_cards_and_patterns_are_not_mined(self):
        for e in self.entries:
            self.assertNotIn(e["section"], ("Pocket card", "Question patterns"), e["id"])


class RuleTests(unittest.TestCase):
    def test_slug_matches_the_reader_rule(self):
        self.assertEqual(bg.slug("Roles & Policies"), "roles-and-policies")
        self.assertEqual(bg.slug("!!!"), "section")

    def test_term_problems(self):
        self.assertIsNone(bg.term_problem("IAM role"))
        self.assertIsNotNone(bg.term_problem("What is it?"))
        self.assertIsNotNone(bg.term_problem("one two three four five six seven"))
        self.assertIsNotNone(bg.term_problem("never use root"))
        self.assertIsNotNone(bg.term_problem("---"))

    def test_introduces(self):
        self.assertTrue(bg.introduces(" is a thing", "X"))
        self.assertTrue(bg.introduces(" - does a thing", "X"))
        self.assertTrue(bg.introduces(" (Amazon Resource Name)", "ARN"))
        self.assertFalse(bg.introduces(" (global)", "global"))
        self.assertFalse(bg.introduces(" can be used", "X"))

    def test_scan_finds_a_prose_definition(self):
        got = [r for r in bg.scan("g.md", ["# Top", "", "**Bucket** is a container for objects."])]
        self.assertEqual(len(got), 1)
        term, sentence, number, section, slug_, problem = got[0]
        self.assertEqual((term, sentence, number, section, slug_, problem), ("Bucket", "**Bucket** is a container for objects.", 3, "Top", "top", None))

    def test_scan_skips_code_and_quotes(self):
        lines = ["# T", "```", "**Bucket** is a container for objects.", "```", "> **Key** is a thing here too."]
        self.assertEqual(list(bg.scan("g.md", lines)), [])

    def test_scan_reads_a_definition_table(self):
        lines = ["# T", "| Service | One-liner |", "|---|---|", "| **SQS** | A managed queue |"]
        got = list(bg.scan("g.md", lines))
        self.assertEqual([(g[0], g[1]) for g in got], [("SQS", "A managed queue")])


if __name__ == "__main__":
    unittest.main()
