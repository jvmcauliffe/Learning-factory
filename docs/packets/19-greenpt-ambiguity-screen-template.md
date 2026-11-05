[greenpt-task-v1]
{
  "project": "jvmcauliffe/Content-Creation-Pipeline",
  "base_sha": "02451da5cdfd16477192e41fab9cd9ff8491fb3d",
  "sender": "claude",
  "review_by": "claude",
  "objective": "Screen these SAA-C03 multiple-choice candidates (pasted below, from one learning-factory MCQ pull request) and flag any question where two options could both be defended, the stem gives the answer away, or a distractor is obviously wrong. Return one line per flag: question id, problem, one-sentence reason. Flags are candidates only.",
  "evidence": "REPLACE_WITH_THE_PR_URL_COMMIT_AND_PASTED_MCQ_JSON (public CC BY 4.0 study content; no private material)",
  "acceptance": "Claude checks each flag against the cited guide line before acting; Codex reviews the PR independently; John decides. Unflagged questions are not thereby approved.",
  "max_calls": 2,
  "budget_eur": "0.01"
}
