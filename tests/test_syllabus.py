import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import build_syllabus  # noqa: E402

GUIDES = sorted(p.name for p in (ROOT / "content" / "saa-c03").glob("[0-9][0-9]-*.md") if not p.name.startswith("00-"))


class SyllabusTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = build_syllabus.build(ROOT)
        cls.data = json.loads(cls.text)
        cls.guides = [g for grp in cls.data["groups"] for g in grp["guides"]]

    def test_all_37_guides_appear_exactly_once(self):
        self.assertEqual(len(GUIDES), 37)
        files = [Path(g["file"]).name for g in self.guides]
        self.assertEqual(len(files), 37)
        self.assertEqual(sorted(files), GUIDES)
        self.assertEqual(self.data["guide_count"], 37)

    def test_order_is_stable_and_matches_the_index(self):
        self.assertEqual([g["order"] for g in self.guides], list(range(1, 38)))
        self.assertEqual(self.text, build_syllabus.build(ROOT))
        index = (ROOT / build_syllabus.INDEX).read_text(encoding="utf-8")
        positions = [index.index(Path(g["file"]).name) for g in self.guides]
        self.assertEqual(positions, sorted(positions))

    def test_committed_syllabus_is_current(self):
        committed = (ROOT / build_syllabus.OUT).read_text(encoding="utf-8")
        self.assertEqual(committed, self.text)

    def test_every_guide_has_all_fields(self):
        for g in self.guides:
            for key in ("order", "guide_number", "title", "file", "owns_questions_about", "source_line"):
                self.assertIn(key, g)
            self.assertTrue(g["title"] and g["owns_questions_about"], g["file"])
            self.assertTrue((ROOT / g["file"]).is_file(), g["file"])
            self.assertEqual(Path(g["file"]).name[:2], g["guide_number"])


class ExamFactsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((ROOT / "data" / "saa-c03" / "exam-facts.json").read_text(encoding="utf-8"))

    def test_every_fact_has_source_and_unverified_status(self):
        self.assertTrue(self.data["facts"])
        for fact in self.data["facts"]:
            self.assertTrue(fact["source_url"].startswith("https://"), fact["id"])
            self.assertEqual(fact["status"], "unverified", fact["id"])

    def test_four_domains_sum_to_100(self):
        domains = [f for f in self.data["facts"] if f["id"].startswith("domain-")]
        self.assertEqual(len(domains), 4)
        self.assertEqual(sum(d["value"]["weight_percent"] for d in domains), 100)

    def test_required_facts_present(self):
        ids = {f["id"] for f in self.data["facts"]}
        for needed in ("question-count", "time-limit", "pass-mark", "scoring-note"):
            self.assertIn(needed, ids)


if __name__ == "__main__":
    unittest.main()
