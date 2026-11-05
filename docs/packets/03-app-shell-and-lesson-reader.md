### Base commit
02451da5cdfd16477192e41fab9cd9ff8491fb3d

### Outcome
learning-factory gains a static, mobile-first study site (site/) with a home page, the 37 guides as readable lessons in the upstream order, and per-guide read progress stored in the browser.

### Task items
1. Add site/index.html, site/styles.css and site/app.js: no build step, light and dark themes, phone-width layout, a navigation bar for Learn, Flashcards, Drills, Exam, Technique and Progress (later sections show coming soon).
2. Add the lesson reader: renders content/saa-c03/*.md with one pinned markdown library from cdnjs, grouped and ordered from syllabus.json, with section anchors (The idea, Core concepts, Question patterns, Pocket card).
3. Store read progress per guide and section in localStorage behind try/catch, so the site still works when storage is blocked.
4. Add a credit footer on every page and site/tests/reader.test.js covering ordering and progress logic with node --test.

### In-scope paths
jvmcauliffe/learning-factory: site/, README.md

### Out-of-scope
Flashcards, drills, exams and dashboards (packets 04 to 22). Any server, login or analytics. Publishing, deploying or merging. Any change to jvmcauliffe/content-creation-pipeline.

### Authority
implement-and-open-pr

### Model route
standard_reasoning

### Effort level
medium

### Acceptance checks
node --test site/tests passes. python3 -m unittest discover -s tests -q passes. Opening site/index.html through python3 -m http.server shows 37 lessons in index order with the credit footer.

### Evidence packet
Upstream: RonitSachdev/aws-saa-c03-guides at a71e466f02702fe01a6fe414c0b49cb8a673d205 (CC BY 4.0). Depends on packets 01 and 02. Every page and data file keeps the RonitSachdev credit and repository link (CC BY 4.0).

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
