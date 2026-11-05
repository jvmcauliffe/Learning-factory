import hashlib
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import build_bank  # noqa: E402

GUIDES = ROOT / "content" / "saa-c03"


class BuildBankTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = build_bank.build(ROOT)
        cls.bank = json.loads(cls.text)
        cls.items = cls.bank["items"]

    def test_37_guides_parsed(self):
        self.assertEqual(self.bank["guide_count"], 37)
        self.assertEqual(len({i["guide"] for i in self.items}), 37)

    def test_every_guide_has_both_item_types(self):
        for guide in {i["guide"] for i in self.items}:
            kinds = {i["type"] for i in self.items if i["guide"] == guide}
            self.assertEqual(kinds, {"pocket_card", "question_pattern"}, guide)

    def test_every_item_has_a_source_that_resolves(self):
        cache = {}
        for item in self.items:
            for key in ("id", "guide", "section", "line"):
                self.assertIn(key, item)
            lines = cache.setdefault(item["guide"], (ROOT / item["guide"]).read_text(encoding="utf-8").splitlines())
            source = lines[item["line"] - 1]
            if item["type"] == "question_pattern":
                self.assertIn(item["scenario"], source, item["id"])
            else:
                self.assertIn(item["keyword"], source, item["id"])
            self.assertIn(item["answer"].split(" | ")[0], source, item["id"])

    def test_ids_unique_and_sorted(self):
        ids = [i["id"] for i in self.items]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(ids, sorted(ids))

    def test_trap_rows_flagged(self):
        traps = [i for i in self.items if i["type"] == "pocket_card" and i["is_trap"]]
        self.assertTrue(traps)
        self.assertTrue(all("trap" in (i["keyword"] + i["answer"]).lower() for i in traps))

    def test_rebuild_is_byte_identical(self):
        self.assertEqual(build_bank.build(ROOT), self.text)

    def test_committed_bank_is_current(self):
        committed = (ROOT / "data" / "saa-c03" / "bank.json").read_text(encoding="utf-8")
        self.assertEqual(committed, self.text)

    def test_copied_guides_match_checksums(self):
        listed = {}
        for line in (GUIDES / "SHA256SUMS").read_text().splitlines():
            digest, name = line.split(None, 1)
            listed[name.strip()] = digest
        self.assertEqual(len(listed), 38)
        for name, digest in listed.items():
            actual = hashlib.sha256((GUIDES / name).read_bytes()).hexdigest()
            self.assertEqual(actual, digest, name)

    def test_attribution_names_author_and_licence(self):
        text = (GUIDES / "ATTRIBUTION.md").read_text()
        for needle in ("RonitSachdev", "https://github.com/RonitSachdev/aws-saa-c03-guides", "a71e466", "CC BY 4.0"):
            self.assertIn(needle, text)


if __name__ == "__main__":
    unittest.main()
