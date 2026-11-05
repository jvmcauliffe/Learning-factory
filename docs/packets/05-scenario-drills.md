### Base commit
02451da5cdfd16477192e41fab9cd9ff8491fb3d

### Outcome
learning-factory gains a scenario drill mode: each question pattern is shown as a scenario, the learner commits to an answer, then sees the answer, the signal keywords and a link to the guide section.

### Task items
1. Add site/drills.js: show the scenario, a free-text answer box, then reveal the bold answer and bracketed signal note from bank.json.
2. Add self-grading (right, partly, wrong); wrong and partly answers return in the same session and the next.
3. Highlight the signal keywords in the scenario after reveal, using only words from the guide's own note.
4. Add site/tests/drills.test.js: queueing, re-queue of missed items, keyword highlighting and source links.

### In-scope paths
jvmcauliffe/learning-factory: site/drills.js, site/index.html, site/styles.css, site/tests/drills.test.js

### Out-of-scope
Automatic marking of free text. Multiple choice (packet 06 onward). Publishing, deploying or merging. Any change to jvmcauliffe/content-creation-pipeline.

### Authority
implement-and-open-pr

### Model route
standard_reasoning

### Effort level
medium

### Acceptance checks
node --test site/tests passes. Every bank.json question-pattern item is reachable as a drill.

### Evidence packet
Upstream: RonitSachdev/aws-saa-c03-guides at a71e466f02702fe01a6fe414c0b49cb8a673d205 (CC BY 4.0). Depends on packets 01 to 03.

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
