### Base commit
02451da5cdfd16477192e41fab9cd9ff8491fb3d

### Outcome
learning-factory gains an exam technique trainer built from the upstream README's six rules and the Exam Traps guide.

### Task items
1. Add site/technique.js with a page per rule: read the last sentence first, count the requirements, poison qualifiers, twin options, requirements as eliminators, the unfamiliar option.
2. Add a poison-qualifier drill: the learner taps the qualifier words in a multiple-choice stem and options, checked against the list in the upstream README.
3. Add a trap review deck from guide 36 and every TRAP row in bank.json.
4. Add site/tests/technique.test.js for qualifier detection and deck building.

### In-scope paths
jvmcauliffe/learning-factory: site/technique.js, site/index.html, site/styles.css, site/tests/technique.test.js, content/saa-c03/ATTRIBUTION.md

### Out-of-scope
New technique advice not in the source. Publishing, deploying or merging. Any change to jvmcauliffe/content-creation-pipeline.

### Authority
implement-and-open-pr

### Model route
standard_reasoning

### Effort level
medium

### Acceptance checks
node --test site/tests passes. All six rules and every TRAP row are reachable.

### Evidence packet
Upstream: RonitSachdev/aws-saa-c03-guides at a71e466f02702fe01a6fe414c0b49cb8a673d205 (CC BY 4.0). Depends on packets 01, 03 and 06. The six rules are in the upstream README.md, which packet 01 does not copy; this packet copies that README section with credit in ATTRIBUTION.md.

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
