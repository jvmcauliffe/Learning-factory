import copy
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import validate_mcq as v  # noqa: E402

CTX = v.Context()
BANK = json.loads((ROOT / "data/saa-c03/bank.json").read_text(encoding="utf-8"))["items"]
GUIDE = "content/saa-c03/01-IAM.md"
GROUP = CTX.group_of[GUIDE]


def src(item):
    return {"guide": item["guide"], "line": item["line"]}


def option(item, why):
    return {"text": item["answer"], "explanation": why, "source": src(item)}


def valid_question(qid="q0001", pick=0):
    """A sample built from the guides' own answers. Its stem is the guide's scenario text."""
    patterns = [i for i in BANK if i["guide"] == GUIDE and i["type"] == "question_pattern"]
    right = patterns[pick]
    wrong, seen = [], {v.norm(right["answer"])}
    for item in BANK:
        if CTX.group_of[item["guide"]] == GROUP and v.norm(item["answer"]) not in seen:
            if item["guide"] == GUIDE and item is right:
                continue
            seen.add(v.norm(item["answer"]))
            wrong.append(item)
        if len(wrong) == 3:
            break
    options = [option(right, "This is the guide's own answer for this scenario.")]
    options += [option(w, "The guide gives this as the answer to a different scenario.") for w in wrong]
    return {
        "id": qid, "guide": GUIDE, "stem": right["scenario"], "options": options,
        "correct": 0, "domain": "domain-1", "status": "candidate",
    }


def file_of(*questions):
    return {"questions": list(questions)}


def problems_for(data):
    return v.validate_data(data, CTX, "sample.json")


class ValidSamples(unittest.TestCase):
    def test_valid_sample_has_no_problems(self):
        self.assertEqual(problems_for(file_of(valid_question())), [])

    def test_correct_index_can_be_any_option(self):
        q = valid_question()
        q["options"] = q["options"][1:] + q["options"][:1]
        q["correct"] = 3
        self.assertEqual(problems_for(file_of(q)), [])

    def test_two_distinct_questions_pass_together(self):
        a, b = valid_question("q0001", 0), valid_question("q0002", 1)
        self.assertEqual(problems_for(file_of(a, b)), [])


class InvalidSamples(unittest.TestCase):
    def reject(self, data, *fragments):
        problems = problems_for(data)
        self.assertTrue(problems, "expected the validator to reject this")
        joined = "\n".join(problems)
        for fragment in fragments:
            self.assertIn(fragment, joined)
        return problems

    def mutate(self, fn):
        q = valid_question()
        fn(q)
        return file_of(q)

    def test_three_options(self):
        self.reject(self.mutate(lambda q: q["options"].pop()), "needs at least 4 items")

    def test_five_options(self):
        self.reject(self.mutate(lambda q: q["options"].append(copy.deepcopy(q["options"][1]))), "at most 4 items")

    def test_correct_index_out_of_range(self):
        self.reject(self.mutate(lambda q: q.update(correct=4)), "must be at most 3")

    def test_missing_explanation(self):
        self.reject(self.mutate(lambda q: q["options"][2].pop("explanation")), "missing 'explanation'")

    def test_empty_explanation(self):
        self.reject(self.mutate(lambda q: q["options"][2].update(explanation="")), "too short")

    def test_missing_source(self):
        self.reject(self.mutate(lambda q: q["options"][1].pop("source")), "missing 'source'")

    def test_unknown_domain(self):
        self.reject(self.mutate(lambda q: q.update(domain="domain-9")), "must be one of")

    def test_unexpected_field(self):
        self.reject(self.mutate(lambda q: q.update(extra=1)), "unexpected field 'extra'")

    def test_verified_status_is_rejected(self):
        self.reject(self.mutate(lambda q: q.update(status="verified")), "only John sets verified")

    def test_unknown_status(self):
        self.reject(self.mutate(lambda q: q.update(status="draft")), "must be one of")

    def test_source_line_beyond_end_of_guide(self):
        def bad(q):
            q["options"][1]["source"]["line"] = 99999
        self.reject(self.mutate(bad), "has no line 99999")

    def test_source_line_is_blank(self):
        lines = CTX.guide_lines(GUIDE)
        blank = next(n for n, text in enumerate(lines, 1) if not text.strip())

        def bad(q):
            q["options"][1]["source"]["line"] = blank
        self.reject(self.mutate(bad), "is blank")

    def test_source_guide_missing(self):
        def bad(q):
            q["options"][1]["source"]["guide"] = "content/saa-c03/99-Nothing.md"
        self.reject(self.mutate(bad), "does not exist")

    def test_correct_answer_does_not_match_guide(self):
        def bad(q):
            q["options"][0]["text"] = "Something the guide never says"
        self.reject(self.mutate(bad), "does not match the guide")

    def test_correct_option_from_another_guide(self):
        other = next(i for i in BANK if i["guide"] != GUIDE and CTX.group_of[i["guide"]] == GROUP)

        def bad(q):
            q["options"][0] = option(other, "Taken from a different guide.")
        self.reject(self.mutate(bad), "not the question's guide")

    def test_correct_option_source_is_not_a_guide_answer(self):
        lines = CTX.guide_lines(GUIDE)
        used = {i["line"] for i in BANK if i["guide"] == GUIDE}
        plain = next(n for n, text in enumerate(lines, 1) if text.strip() and n not in used)

        def bad(q):
            q["options"][0]["source"]["line"] = plain
        self.reject(self.mutate(bad), "not one of the guide's own answers")

    def test_distractor_invented(self):
        def bad(q):
            q["options"][2]["text"] = "An answer nobody wrote"
        self.reject(self.mutate(bad), "wrong option 3 does not match its source")

    def test_distractor_from_unrelated_group(self):
        outsider = next(i for i in BANK if CTX.group_of[i["guide"]] != GROUP)

        def bad(q):
            q["options"][3] = option(outsider, "Taken from an unrelated guide.")
        self.reject(self.mutate(bad), "not the same or a related guide")

    def test_distractor_not_in_bank(self):
        lines = CTX.guide_lines(GUIDE)
        used = {i["line"] for i in BANK if i["guide"] == GUIDE}
        plain = next(n for n, text in enumerate(lines, 1) if text.strip() and n not in used)

        def bad(q):
            q["options"][3]["source"]["line"] = plain
        self.reject(self.mutate(bad), "not one of the guides' own answers")

    def test_duplicate_option_text(self):
        def bad(q):
            q["options"][2] = copy.deepcopy(q["options"][1])
        self.reject(self.mutate(bad), "two options have the same text")

    def test_distractor_repeats_correct_answer(self):
        def bad(q):
            q["options"][1] = copy.deepcopy(q["options"][0])
        self.reject(self.mutate(bad), "repeats the correct answer")

    def test_duplicate_stems_in_one_file(self):
        a, b = valid_question("q0001", 0), valid_question("q0002", 1)
        b["stem"] = "  " + a["stem"].upper() + " "
        self.reject(file_of(a, b), "same stem as")

    def test_duplicate_ids_in_one_file(self):
        a, b = valid_question("q0001", 0), valid_question("q0001", 1)
        self.reject(file_of(a, b), "id already used")

    def test_duplicate_stems_across_files(self):
        seen = {"stems": {}, "ids": {}}
        first = v.validate_data(file_of(valid_question("q0001", 0)), CTX, "a.json", seen)
        second = v.validate_data(file_of(valid_question("q0002", 0)), CTX, "b.json", seen)
        self.assertEqual(first, [])
        self.assertIn("same stem as a.json", "\n".join(second))

    def test_not_an_object(self):
        self.reject([], "should be an object")

    def test_empty_question_list(self):
        self.reject({"questions": []}, "needs at least 1 items")


class GuidesAndFiles(unittest.TestCase):
    def test_every_bank_item_resolves_and_answers_are_unique_per_line(self):
        self.assertEqual(len(CTX.answers), len(BANK))
        for item in BANK:
            self.assertIsNone(CTX.resolve(item["guide"], item["line"]), item["id"])

    def test_domain_map_covers_every_guide(self):
        dm = json.loads((ROOT / "data/saa-c03/domain-map.json").read_text(encoding="utf-8"))
        self.assertEqual(dm["status"], "unverified")
        self.assertEqual(set(dm["guides"]), set(CTX.group_of))
        self.assertEqual(len(dm["guides"]), 37)
        self.assertTrue(set(dm["guides"].values()) <= set(dm["domains"]))
        self.assertIn("RonitSachdev", dm["credit"])
        self.assertIn("CC BY 4.0", dm["credit"])

    def test_schema_names_the_credit_and_enums(self):
        schema = json.loads(v.SCHEMA_PATH.read_text(encoding="utf-8"))
        self.assertIn("RonitSachdev", schema["description"])
        q = schema["$defs"]["question"]["properties"]
        self.assertEqual(q["status"]["enum"], ["candidate", "verified"])
        self.assertEqual(q["options"]["minItems"], 4)
        self.assertEqual(q["options"]["maxItems"], 4)

    def test_cli_accepts_valid_file_and_rejects_invalid_one(self):
        with tempfile.TemporaryDirectory() as tmp:
            good, bad = Path(tmp) / "good.json", Path(tmp) / "bad.json"
            good.write_text(json.dumps(file_of(valid_question())), encoding="utf-8")
            broken = valid_question()
            broken["options"][0]["text"] = "Not in the guide"
            bad.write_text(json.dumps(file_of(broken)), encoding="utf-8")
            run = lambda p: subprocess.run(
                [sys.executable, str(ROOT / "tools/validate_mcq.py"), str(p)], capture_output=True, text=True
            )
            ok, no = run(good), run(bad)
        self.assertEqual(ok.returncode, 0, ok.stdout)
        self.assertEqual(no.returncode, 1)
        self.assertIn("does not match the guide", no.stdout)

    def test_cli_default_run_passes_on_the_shipped_folder(self):
        run = subprocess.run([sys.executable, str(ROOT / "tools/validate_mcq.py")], capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stdout)

    def test_bad_json_is_reported_plainly(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "x.json"
            p.write_text("{not json", encoding="utf-8")
            problems = v.validate_paths([p], CTX)
        self.assertIn("not valid JSON", problems[0])


if __name__ == "__main__":
    unittest.main()
