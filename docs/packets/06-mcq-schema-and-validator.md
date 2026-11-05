### Base commit
02451da5cdfd16477192e41fab9cd9ff8491fb3d

### Outcome
learning-factory gains the schema, validator and domain mapping for multiple-choice questions, so the authoring packets (07 to 18) produce checkable, source-bound candidates.

### Task items
1. Add data/saa-c03/mcq/schema.json: id, guide, stem, four options, one correct index, an explanation for every option (why it is right, or why it is wrong), each with its own source line, exam domain, status (candidate or verified).
2. Add tools/validate_mcq.py: schema check, every source reference resolves to a real line in content/saa-c03/, the correct answer matches the guide, distractors come from the same or a related guide's own answers, every option has an explanation whose source line resolves, no duplicate stems, status starts as candidate.
3. Add data/saa-c03/domain-map.json mapping each guide to its main exam domain, marked unverified for John.
4. Add tests/test_validate_mcq.py with valid and invalid sample files.

### In-scope paths
jvmcauliffe/learning-factory: data/saa-c03/mcq/, data/saa-c03/domain-map.json, tools/validate_mcq.py, tests/test_validate_mcq.py

### Out-of-scope
Writing real questions (packets 07 to 18). Publishing, deploying or merging. Any change to jvmcauliffe/content-creation-pipeline.

### Authority
implement-and-open-pr

### Model route
standard_reasoning

### Effort level
medium

### Acceptance checks
python3 -m unittest discover -s tests -q passes. The validator rejects each invalid sample with a plain reason.

### Evidence packet
Upstream: RonitSachdev/aws-saa-c03-guides at a71e466f02702fe01a6fe414c0b49cb8a673d205 (CC BY 4.0). Depends on packets 01 and 02. Distractors are drawn from the guides' own pocket-card answers and TRAP rows so every wrong option is grounded in the source.

### Reusable review receipts
None

### Maximum turns
8

### Correction retries
0

### Run budget (USD)
0.50

### Work units
4

### Expected duration (minutes)
10

### Maximum delegated model calls
0

### Requested parallel workers
1

### Stop conditions
Stop and hand over if: learning-factory has no commit to branch from; the workflow or session cannot write to learning-factory; a packet this one depends on is not merged; any acceptance check fails; the budget, turn or time limit is reached; another branch touches the in-scope paths; or a step would need a fact the guides do not state.

### Handover destination
This issue: exact branch and commit, files changed, commands and results, unresolved findings, model route, retry count and usage (unknown where telemetry is missing).
