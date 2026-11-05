### Base commit
02451da5cdfd16477192e41fab9cd9ff8491fb3d

### Outcome
John receives a report listing every number and limit in the guides and MCQs that the exam may test, with its current AWS documentation source where readable, plus any upstream changes since commit a71e466.

### Task items
1. Run a one-off extraction (not committed) listing every number, limit, duration and percentage in content/saa-c03/ and data/saa-c03/mcq/ with file and line.
2. For each, record the matching AWS documentation URL and whether it agrees, disagrees or could not be checked (unchecked stays indeterminate).
3. Compare upstream main with commit a71e466 and list changed guides.
4. Post the report on this issue for John; change no data.

### In-scope paths
jvmcauliffe/learning-factory: content/saa-c03/, data/saa-c03/ (read only)

### Out-of-scope
Changing any file, fact, status or question. Publishing, deploying or merging. Any change to jvmcauliffe/content-creation-pipeline.

### Authority
report-only

### Model route
standard_reasoning

### Effort level
medium

### Acceptance checks
The report lists every extracted item with agree, disagree or unchecked, and the upstream diff summary. No repository files are changed.

### Evidence packet
Upstream: RonitSachdev/aws-saa-c03-guides at a71e466f02702fe01a6fe414c0b49cb8a673d205 (CC BY 4.0). Depends on packets 01 and 07 to 18. John alone marks facts verified.

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
