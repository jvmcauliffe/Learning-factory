### Base commit
02451da5cdfd16477192e41fab9cd9ff8491fb3d

### Outcome
learning-factory gains a flashcard mode built from every pocket-card row, with five-box Leitner spaced repetition, trap cards highlighted and filters by guide and topic group.

### Task items
1. Add site/flashcards.js: front is the keyword cue, back is the answer and its source link; TRAP rows show as trap cards.
2. Implement a five-box Leitner schedule (box intervals 0, 1, 3, 7 and 14 days) with a due queue, stored in localStorage behind try/catch.
3. Add filters (guide, topic group, traps only) and keyboard and touch controls (flip, knew it, missed it).
4. Add site/tests/flashcards.test.js: scheduling, promotion, demotion, due-queue order and filter counts.

### In-scope paths
jvmcauliffe/learning-factory: site/flashcards.js, site/index.html, site/styles.css, site/tests/flashcards.test.js

### Out-of-scope
Scenario drills, multiple choice, exams. Editing card text. Publishing, deploying or merging. Any change to jvmcauliffe/content-creation-pipeline.

### Authority
implement-and-open-pr

### Model route
standard_reasoning

### Effort level
medium

### Acceptance checks
node --test site/tests passes. Every bank.json pocket-card item is reachable as a card; card counts per guide match bank.json.

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
