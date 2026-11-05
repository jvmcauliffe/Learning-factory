### Base commit
02451da5cdfd16477192e41fab9cd9ff8491fb3d

### Outcome
learning-factory gains a searchable glossary built only from the guides' own wording, and bookmarks for lessons, cards, drills and questions that export with progress.

### Task items
1. Add tools/build_glossary.py: build data/saa-c03/glossary.json from the bold terms in the guides, each entry holding the term, the guide's own sentence that introduces it (quoted, not reworded), guide file and line; a term with no such sentence is skipped and listed in data/saa-c03/glossary-skipped.json.
2. Add site/glossary.js: an A to Z search page with each entry linking to its guide section.
3. Add site/bookmarks.js: bookmark a lesson section, flashcard, drill or question, stored in localStorage behind try/catch, listed on one page and included in the progress export from packet 22.
4. Add tests/test_build_glossary.py and site/tests/bookmarks.test.js: every entry has a source line that resolves, a rebuild is byte-identical, bookmark add, remove, list and export round trip.

### In-scope paths
jvmcauliffe/learning-factory: tools/build_glossary.py, data/saa-c03/glossary.json, data/saa-c03/glossary-skipped.json, site/glossary.js, site/bookmarks.js, site/index.html, site/styles.css, tests/test_build_glossary.py, site/tests/bookmarks.test.js

### Out-of-scope
Definitions the guides do not state. Any text copied from a third-party site. Publishing, deploying or merging. Any change to jvmcauliffe/content-creation-pipeline.

### Authority
implement-and-open-pr

### Model route
standard_reasoning

### Effort level
medium

### Acceptance checks
python3 -m unittest discover -s tests -q passes. node --test site/tests passes. Two runs of python3 tools/build_glossary.py give the same sha256sum. Every glossary source line resolves to a real line in content/saa-c03/.

### Evidence packet
Upstream: RonitSachdev/aws-saa-c03-guides at a71e466f02702fe01a6fe414c0b49cb8a673d205 (CC BY 4.0). Depends on packets 01, 03, 04, 05, 06 and 22. Feature idea only: modelled on public study sites; no third-party content is copied.

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
Stop and hand over if: a term cannot be defined using only the guides' own words (skip and list it, never invent a definition); learning-factory has no commit to branch from; the workflow or session cannot write to learning-factory; a packet this one depends on is not merged; any acceptance check fails; the budget, turn or time limit is reached; another branch touches the in-scope paths; or a step would need a fact the guides do not state.

### Handover destination
This issue: exact branch and commit, files changed, commands and results, unresolved findings, model route, retry count and usage (unknown where telemetry is missing).
