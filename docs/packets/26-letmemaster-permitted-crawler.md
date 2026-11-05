### Base commit
02451da5cdfd16477192e41fab9cd9ff8491fb3d

### Outcome
learning-factory gains a polite, resumable, offline-tested crawler and a faithful HTML parser for letmemaster.com, usable only while a written permission record from the site owner is committed. This packet does not run the crawl and does not commit any fetched content.

### Task items
1. Add tools/fetch_letmemaster.py (standard library only): refuse to start unless docs/permissions/letmemaster.md exists and names the owner, the date and a scope that covers automated fetching; read robots.txt and the sitemap and honour disallow rules; fetch only sitemap URLs on letmemaster.com; send a clear User-Agent; wait at least 2 seconds between requests; retry transient errors with back-off; stop at a page cap given on the command line; save each raw page under raw/letmemaster/ with url, fetched_at, status and sha256 in raw/letmemaster/manifest.json; skip pages already fetched with an unchanged hash.
2. Add tools/parse_letmemaster.py (standard library only): turn each raw page into data/letmemaster/<slug>.json holding source_url, fetched_at, raw_sha256, status candidate, and the page's headings, paragraphs, lists and tables with their text kept exactly as fetched (no rewording, no merging). No quiz-specific mapping yet: that waits for a real crawl (a later packet).
3. Add tests/test_letmemaster.py (unittest) that uses a local http.server fixture only and never contacts the live site: refuses without the permission file, honours a robots.txt disallow, spaces requests at least 2 seconds apart (clock injected), respects the page cap, resumes without refetching unchanged pages, and gives a byte-identical parse on two runs.
4. Add .gitignore entries for raw/, and a README.md section: the permission rule, the commands, that raw pages are never committed, that parsed content stays out of the public site until packet 27 and John's check of the permission scope, and the credit line for letmemaster.com.

### In-scope paths
jvmcauliffe/learning-factory: tools/fetch_letmemaster.py, tools/parse_letmemaster.py, tests/test_letmemaster.py, .gitignore, README.md

### Out-of-scope
Running the crawler against the live site. Committing raw pages or any fetched content. Creating or editing docs/permissions/letmemaster.md (John supplies it). Mapping fetched pages to questions or lessons (packet 27). Logging in, using credentials, bypassing a paywall or a block. Publishing, deploying or merging. Any change to jvmcauliffe/content-creation-pipeline.

### Authority
implement-and-open-pr

### Model route
standard_reasoning

### Effort level
medium

### Acceptance checks
python3 -m unittest discover -s tests -q passes. The tests make no request to letmemaster.com. python3 tools/fetch_letmemaster.py exits non-zero with a clear message when docs/permissions/letmemaster.md is missing. raw/ is ignored by git.

### Evidence packet
Upstream: RonitSachdev/aws-saa-c03-guides at a71e466f02702fe01a6fe414c0b49cb8a673d205 (CC BY 4.0). Depends on packet 01 (repository layout). John supplies docs/permissions/letmemaster.md (owner name, date, scope, the owner's written words) before this packet is posted. John's statement of 5 November 2026: the site owner suggested fetching the site. Site structure is not confirmed, so the parser is generic. Packet 27 (ingest and map) is drafted only after a real crawl.

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
Stop and hand over if: docs/permissions/letmemaster.md is missing or does not cover automated fetching; robots.txt or the sitemap forbids the planned fetch; a test would need the live site; learning-factory has no commit to branch from; the workflow or session cannot write to learning-factory; a packet this one depends on is not merged; any acceptance check fails; the budget, turn or time limit is reached; another branch touches the in-scope paths; or a step would need a fact the guides do not state.

### Handover destination
This issue: exact branch and commit, files changed, commands and results, unresolved findings, model route, retry count and usage (unknown where telemetry is missing).
