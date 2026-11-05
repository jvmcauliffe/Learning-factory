### Base commit
02451da5cdfd16477192e41fab9cd9ff8491fb3d

### Outcome
learning-factory gains a timed practice exam: questions drawn by domain weight, a timer, flag-for-review, and a results screen with explanations and guide links.

### Task items
1. Add site/exam.js: draw a full-length exam using exam-facts.json; while any value there is unverified, show a banner and fall back to an even draw across domains.
2. Add the timer, question navigator, flag for review and submit flow; show unverified questions with a candidate badge, with a setting to use verified questions only.
3. Add the results screen: raw score per domain, every question with the explanation for every option and a guide link; state that the real pass mark is a scaled score and the raw percentage is not a prediction.
4. Add site/tests/exam.test.js: weighted draw, no repeats, timer expiry, scoring and the verified-only setting.

### In-scope paths
jvmcauliffe/learning-factory: site/exam.js, site/index.html, site/styles.css, site/tests/exam.test.js

### Out-of-scope
Predicting a pass. Changing question content. Publishing, deploying or merging. Any change to jvmcauliffe/content-creation-pipeline.

### Authority
implement-and-open-pr

### Model route
standard_reasoning

### Effort level
medium

### Acceptance checks
node --test site/tests passes. With the sample bank, a drawn exam respects the weights within one question per domain.

### Evidence packet
Upstream: RonitSachdev/aws-saa-c03-guides at a71e466f02702fe01a6fe414c0b49cb8a673d205 (CC BY 4.0). Depends on packets 02, 03, 06 and at least one of 07 to 18.

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
