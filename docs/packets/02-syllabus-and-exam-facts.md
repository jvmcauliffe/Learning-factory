### Base commit
02451da5cdfd16477192e41fab9cd9ff8491fb3d

### Outcome
learning-factory gains data/saa-c03/syllabus.json (the upstream reading order and topic groups) and data/saa-c03/exam-facts.json (exam format and domain weights, each marked unverified until John verifies it).

### Task items
1. Add tools/build_syllabus.py: parse content/saa-c03/00-README.md into syllabus.json (group name, order, guide number, title, file, owns-questions-about text).
2. Add data/saa-c03/exam-facts.json: four exam domains with weights, question count, time limit, pass mark and scoring note, each with a source_url field pointing to the official AWS SAA-C03 exam guide page and status unverified. The values are left null when the official page cannot be read in this run.
3. Add tests/test_syllabus.py: all 37 guides appear exactly once, order is stable, every exam fact has a source_url and a status.
4. Extend README.md with the syllabus and the rule that only John changes a status to verified.

### In-scope paths
jvmcauliffe/learning-factory: tools/build_syllabus.py, data/saa-c03/syllabus.json, data/saa-c03/exam-facts.json, tests/test_syllabus.py, README.md

### Out-of-scope
Changing any fact's status to verified. Mapping individual guides to official domains (packet 06). Publishing, deploying or merging. Any change to jvmcauliffe/content-creation-pipeline.

### Authority
implement-and-open-pr

### Model route
standard_reasoning

### Effort level
medium

### Acceptance checks
python3 -m unittest discover -s tests -q passes. syllabus.json lists 37 guides in the 00-README order. Every exam-facts entry has status unverified and a source_url.

### Evidence packet
Upstream: RonitSachdev/aws-saa-c03-guides at a71e466f02702fe01a6fe414c0b49cb8a673d205 (CC BY 4.0). Depends on packet 01. The upstream index groups guides by topic, not by official exam domain, so official weights must come from AWS, not the guides. Commonly cited values (to confirm, not to trust): four domains weighted 30/26/24/20, 65 questions, 130 minutes, pass mark 720 of 1000 scaled.

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
Stop and hand over if: the official AWS exam guide contradicts the commonly cited values; learning-factory has no commit to branch from; the workflow or session cannot write to learning-factory; a packet this one depends on is not merged; any acceptance check fails; the budget, turn or time limit is reached; another branch touches the in-scope paths; or a step would need a fact the guides do not state.

### Handover destination
This issue: exact branch and commit, files changed, commands and results, unresolved findings, model route, retry count and usage (unknown where telemetry is missing).
