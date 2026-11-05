### Base commit
02451da5cdfd16477192e41fab9cd9ff8491fb3d

### Outcome
learning-factory gains candidate multiple-choice questions for 34-Well-Architected, 35-Disaster-Recovery, 37-GapFill-Services, 36-Exam-Traps-KeyPatterns: one per question pattern, each passing tools/validate_mcq.py with status candidate.

### Task items
1. Write data/saa-c03/mcq/34-Well-Architected.json: one question per question pattern in content/saa-c03/34-Well-Architected.md, stem reworded into exam style without adding facts, correct answer from the guide, three distractors from the guides' own answers or TRAP rows, a short explanation for each of the four options (why it is right or wrong), each citing a guide line and using only what the guides state.
2. Write data/saa-c03/mcq/35-Disaster-Recovery.json: one question per question pattern in content/saa-c03/35-Disaster-Recovery.md, stem reworded into exam style without adding facts, correct answer from the guide, three distractors from the guides' own answers or TRAP rows, a short explanation for each of the four options (why it is right or wrong), each citing a guide line and using only what the guides state.
3. Write data/saa-c03/mcq/37-GapFill-Services.json: one question per question pattern in content/saa-c03/37-GapFill-Services.md, stem reworded into exam style without adding facts, correct answer from the guide, three distractors from the guides' own answers or TRAP rows, a short explanation for each of the four options (why it is right or wrong), each citing a guide line and using only what the guides state.
4. Write data/saa-c03/mcq/36-Exam-Traps-KeyPatterns.json: one question per question pattern in content/saa-c03/36-Exam-Traps-KeyPatterns.md, stem reworded into exam style without adding facts, correct answer from the guide, three distractors from the guides' own answers or TRAP rows, a short explanation for each of the four options (why it is right or wrong), each citing a guide line and using only what the guides state.

### In-scope paths
jvmcauliffe/learning-factory: data/saa-c03/mcq/34-Well-Architected.json, data/saa-c03/mcq/35-Disaster-Recovery.json, data/saa-c03/mcq/37-GapFill-Services.json, data/saa-c03/mcq/36-Exam-Traps-KeyPatterns.json

### Out-of-scope
Any guide outside this batch. Any fact not stated in the guides. Changing status to verified. Publishing, deploying or merging. Any change to jvmcauliffe/content-creation-pipeline.

### Authority
implement-and-open-pr

### Model route
standard_reasoning

### Effort level
medium

### Acceptance checks
python3 tools/validate_mcq.py data/saa-c03/mcq/ passes. python3 -m unittest discover -s tests -q passes. Question count per guide equals that guide's question-pattern count in bank.json.

### Evidence packet
Upstream: RonitSachdev/aws-saa-c03-guides at a71e466f02702fe01a6fe414c0b49cb8a673d205 (CC BY 4.0). Depends on packet 06. Each PR then gets a GreenPT ambiguity screen (packet 19 template) and an independent Codex review before John merges.

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
Stop and hand over if: a question pattern cannot be turned into one unambiguous correct option; learning-factory has no commit to branch from; the workflow or session cannot write to learning-factory; a packet this one depends on is not merged; any acceptance check fails; the budget, turn or time limit is reached; another branch touches the in-scope paths; or a step would need a fact the guides do not state.

### Handover destination
This issue: exact branch and commit, files changed, commands and results, unresolved findings, model route, retry count and usage (unknown where telemetry is missing).
