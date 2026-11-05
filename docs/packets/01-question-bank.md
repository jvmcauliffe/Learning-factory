### Base commit
02451da5cdfd16477192e41fab9cd9ff8491fb3d

### Outcome
learning-factory gains a deterministic SAA-C03 question bank (data/saa-c03/bank.json) built from the 37 upstream topic guides, with author credit and a passing unittest.

### Task items
1. Copy the 37 topic guides and 00-README.md from upstream commit a71e466 into content/saa-c03/ unchanged, and add content/saa-c03/ATTRIBUTION.md (author RonitSachdev, repository link, commit, CC BY 4.0 link, note that later files adapt it).
2. Add tools/build_bank.py: a standard-library parser that reads each guide's Pocket card table (including TRAP rows, flagged as traps) and Question patterns section (scenario, answer, signal-keyword note) and writes data/saa-c03/bank.json, sorted and stable, every item carrying guide file, section and line number.
3. Add tests/test_build_bank.py (unittest): 37 guides parsed, every guide yields pocket-card and question-pattern items, every item has a source reference, a rebuild is byte-identical.
4. Add README.md: purpose, rebuild command, the packet roadmap, and the CC BY 4.0 credit.

### In-scope paths
jvmcauliffe/learning-factory: content/saa-c03/, tools/build_bank.py, data/saa-c03/bank.json, tests/test_build_bank.py, README.md

### Out-of-scope
Any user interface (packets 03 onward). Rewriting, correcting or adding AWS facts. Model-written question content. Publishing, deploying or merging. Any change to jvmcauliffe/content-creation-pipeline.

### Authority
implement-and-open-pr

### Model route
standard_reasoning

### Effort level
medium

### Acceptance checks
python3 -m unittest discover -s tests -q passes. Two runs of python3 tools/build_bank.py give the same sha256sum. content/saa-c03/*.md match upstream byte for byte. ATTRIBUTION.md and README.md name RonitSachdev and link https://github.com/RonitSachdev/aws-saa-c03-guides.

### Evidence packet
Upstream: RonitSachdev/aws-saa-c03-guides at a71e466f02702fe01a6fe414c0b49cb8a673d205 (CC BY 4.0). Structure check (5 November 2026): 37 of 38 files contain The idea, Question patterns and Pocket card; patterns are quoted scenarios followed by an arrow, a bold answer and a bracketed signal note; 00-README.md is the index.

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
Stop and hand over if: a guide lacks a parsable Pocket card table; the upstream commit or licence differs from the evidence; learning-factory has no commit to branch from; the workflow or session cannot write to learning-factory; a packet this one depends on is not merged; any acceptance check fails; the budget, turn or time limit is reached; another branch touches the in-scope paths; or a step would need a fact the guides do not state.

### Handover destination
This issue: exact branch and commit, files changed, commands and results, unresolved findings, model route, retry count and usage (unknown where telemetry is missing).
