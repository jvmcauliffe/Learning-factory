# Learning Factory

A study tool for the AWS Certified Solutions Architect – Associate exam (SAA-C03), built in small, reviewed steps through the content creation harness (`jvmcauliffe/content-creation-pipeline`).

## Status

Packets 01 and 02 done: the 37 guides are copied unchanged into `content/saa-c03/`, parsed into a question bank, and listed in the upstream reading order with the exam facts. No user interface yet. The build plan is in [docs/roadmap.md](docs/roadmap.md).

## Question bank

`data/saa-c03/bank.json` holds every Pocket card row (trap rows flagged) and every Question pattern from the guides: 37 guides, 881 items. Each item records its guide file, section and line number, and its text is kept exactly as the guide wrote it. Everything in the bank is a **candidate**; nothing is verified.

Rebuild it (standard library only, byte-identical on every run):

```
python3 tools/build_bank.py
python3 -m unittest discover -s tests -q
```

## Syllabus and exam facts

`data/saa-c03/syllabus.json` lists the 37 guides in the upstream reading order, in 8 topic groups, with each guide's number, title, file and the "owns the questions about" text. Rebuild it with `python3 tools/build_syllabus.py` (standard library only, byte-identical on every run). The upstream groups are by topic, not by official exam domain; mapping guides to domains is a later packet.

`data/saa-c03/exam-facts.json` holds the exam format, the four domain weights (30/26/24/20), the time limit and the pass mark, each with a `source_url` (the official AWS exam guide, version 1.1, or the AWS certification page) and `"status": "unverified"`. **Only John changes a status to verified**, after checking it against current AWS documentation. No packet or tool may do it.

## Roadmap

Each step is a separate Claude task packet and a separate reviewed pull request, listed in [docs/roadmap.md](docs/roadmap.md): syllabus and exam facts, lesson reader, flashcards, scenario drills, multiple-choice questions (with an explanation for every option), practice exam, technique trainer, progress dashboard, glossary and bookmarks, accessibility and offline use. Only John merges, publishes or marks facts verified.

## What it will be

A static, mobile-first study site with:

- the topic guides as lessons, in the recommended reading order
- flashcards with spaced repetition
- scenario drills
- multiple-choice questions for every guide
- a timed practice exam
- an exam technique trainer
- a progress dashboard

## Run the site

The site is static, with no build step. It reads the guides and `data/saa-c03/syllabus.json` from the repository, so serve the repository root and open `/site/`:

```
python3 -m http.server 8000
# then open http://localhost:8000/site/
```

Lessons are rendered with [marked](https://github.com/markedjs/marked) 12.0.2, pinned from cdnjs with a subresource-integrity hash. If the library cannot load, a lesson is shown as plain text. Read progress is kept per section in `localStorage`; if the browser blocks storage the site still works and says progress will not be saved.

Tests for the reader logic (Node 22 or later, no packages):

```
node --test "site/tests/*.test.js"
python3 -m unittest discover -s tests -q
```

Both `node --test "site/tests/*.test.js"` and `node --test site/tests` work. The second needs `site/tests/index.js`, which loads every test file, because Node 22 treats a bare directory as a file path.

### Browser tests, accessibility and offline use

The browser tests live in `tests/e2e/`. They need Node 22 or later and the pinned packages in `tests/e2e/package.json` (Playwright 1.63.0, axe-core 4.10.2, marked 12.0.2). Install once, then run:

```
cd tests/e2e
npm ci
npx playwright install chromium   # only if Playwright has no browser yet
node --test "*.test.js"
```

| Test file | What it checks |
|---|---|
| `a11y.test.js` | axe-core on every section at phone and desktop width, light and dark. Any serious or critical issue fails. |
| `smoke.test.js` | Every section opens, no sideways page scroll, one flashcard, one drill and a short exam are completed, and the keyboard alone reaches the main controls. |
| `offline.test.js` | After one visit the site, a lesson and every section work with the network off. The cache name carries the content version. |

The tests start their own static server and serve the pinned marked build in place of the CDN, so they need no network.

Offline use: `site/sw.js` caches the lessons, question data, glossary and site files on the first visit (over https or localhost) and `site/manifest.json` lets the site be installed. The cache is named `lf-saa-c03-<upstream commit>-<content hash>`. When a guide or data file changes, `site/tests/sw.test.js` fails and reports the new `CONTENT_HASH` to put in `site/sw.js`; the old cache is deleted when the new worker activates.

## letmemaster.com fetch tools

Content from letmemaster.com ("Let me master", operated by Jeremy) is used only under the owner's written permission, recorded in [docs/permissions/letmemaster.md](docs/permissions/letmemaster.md). Credit letmemaster.com and its owner wherever its content appears, alongside the RonitSachdev credit below. Everything fetched is a `candidate`; facts stay `unverified` until John verifies them.

| Command | What it does |
|---|---|
| `python3 tools/fetch_letmemaster.py --max-pages N` | Reads robots.txt and the sitemap, fetches up to N sitemap pages on letmemaster.com only, at least 2 seconds apart, with a clear User-Agent and back-off on transient errors. Saves raw pages and `manifest.json` (url, fetched_at, status, sha256) under `raw/letmemaster/`. Pages already saved with an unchanged hash are skipped; `--refresh` refetches them and rewrites only the changed ones. |
| `python3 tools/parse_letmemaster.py` | Turns the saved pages into `data/letmemaster/<slug>.json`: source URL, fetch time, raw hash, status `candidate`, and the headings, paragraphs, lists and tables kept verbatim. Output is byte-identical across runs. It does no quiz mapping. |

The fetch tool refuses to run, with a non-zero exit and a clear message, if the permission file is missing or does not cover automated fetching.

`raw/` is git-ignored: raw pages and the session cookie are never committed. To fetch pages that need John's logged-in session, set `LETMEMASTER_COOKIE` as an environment secret in the session settings (the whole `Cookie` header value). Never paste it into a chat, an issue or a file. The tool sends it only to letmemaster.com, prints only whether it is set, and never logs or stores it. Without it, only public pages are fetched.

The tests (`tests/test_letmemaster.py`) use a local server only and never contact the live site.

## Source and credit

The study content will be adapted from **[aws-saa-c03-guides](https://github.com/RonitSachdev/aws-saa-c03-guides)** by **RonitSachdev**, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Anything built from it must keep this credit and link. The copied guides, their commit and the changes made are recorded in [content/saa-c03/ATTRIBUTION.md](content/saa-c03/ATTRIBUTION.md).

This repository's own licence has not been chosen yet. That is an owner decision.

## Disclaimer

These are community study materials, not affiliated with or endorsed by AWS. Exam facts stay marked unverified until the owner checks them against current AWS documentation.
