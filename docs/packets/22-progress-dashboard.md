### Base commit
02451da5cdfd16477192e41fab9cd9ff8491fb3d

### Outcome
learning-factory gains a progress page showing readiness by guide and topic group from lessons, flashcards, drills and exams, with a recommended next step and progress export and import.

### Task items
1. Add site/progress.js: combine lesson reads, flashcard boxes, drill results and exam scores per guide and topic group.
2. Show the weakest five guides and a recommended next activity for each.
3. Add progress export to a JSON file and import from it, with a version field and validation.
4. Add site/tests/progress.test.js: aggregation, ranking, export and import round trip, rejection of bad files.

### In-scope paths
jvmcauliffe/learning-factory: site/progress.js, site/index.html, site/styles.css, site/tests/progress.test.js

### Out-of-scope
Any server-side storage, accounts or analytics. Publishing, deploying or merging. Any change to jvmcauliffe/content-creation-pipeline.

### Authority
implement-and-open-pr

### Model route
standard_reasoning

### Effort level
medium

### Acceptance checks
node --test site/tests passes. An exported file re-imports to the same dashboard.

### Evidence packet
Upstream: RonitSachdev/aws-saa-c03-guides at a71e466f02702fe01a6fe414c0b49cb8a673d205 (CC BY 4.0). Depends on packets 03, 04, 05 and 20.

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
