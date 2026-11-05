### Base commit
02451da5cdfd16477192e41fab9cd9ff8491fb3d

### Outcome
learning-factory's site passes automated accessibility checks, works offline after the first visit, and has end-to-end browser tests for every section.

### Task items
1. Run axe-core (pinned version) on every section and fix all serious and critical issues; keyboard-only use works end to end.
2. Add site/sw.js and site/manifest.json so the site installs and works offline after one visit, with the content version in the cache name.
3. Add tests/e2e/ Playwright smoke tests at phone and desktop widths: open each section, complete one card, one drill and a short exam.
4. Document the test commands in README.md.

### In-scope paths
jvmcauliffe/learning-factory: site/, tests/e2e/, README.md

### Out-of-scope
New features or content. Publishing, deploying or merging. Any change to jvmcauliffe/content-creation-pipeline.

### Authority
implement-and-open-pr

### Model route
standard_reasoning

### Effort level
medium

### Acceptance checks
node --test site/tests passes. python3 -m unittest discover -s tests -q passes. The Playwright suite passes. axe-core reports no serious or critical issues.

### Evidence packet
Upstream: RonitSachdev/aws-saa-c03-guides at a71e466f02702fe01a6fe414c0b49cb8a673d205 (CC BY 4.0). Depends on packets 03 to 22 and 25.

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
