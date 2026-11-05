# Build roadmap

Each step is a separately approved Claude task packet. The packet texts are in [docs/packets/](packets/). They were drafted on 5 November 2026, and each one passed the harness lint on that date (24 Claude packets plus the GreenPT screen template). The Base commit in each is restamped when the packet is posted.

## Order and dependencies
| # | Packet | Needs |
|---|---|---|
| 0 | Owner step: first commit (done) and a way to run packets in this repository | - |
| 01 | Question bank from all 37 guides | 0 |
| 02 | Syllabus + exam facts (unverified until John checks) | 01 |
| 03 | Site shell + lesson reader | 01, 02 |
| 04 | Flashcards, spaced repetition | 03 |
| 05 | Scenario drills | 03 |
| 06 | Multiple-choice schema (an explanation for every option), validator, domain map | 01, 02 |
| 07-18 | Multiple-choice authoring, 12 batches covering all 37 guides, an explanation for every option | 06 |
| 19 | GreenPT ambiguity screen, one per 07-18 pull request | each of 07-18 |
| 20 | Timed practice exam | 06, any of 07-18 |
| 21 | Exam technique trainer | 03, 06 |
| 22 | Progress dashboard, export/import | 04, 05, 20 |
| 25 | Glossary + bookmarks (run before 23) | 01, 03-06, 22 |
| 23 | Accessibility, offline, browser tests | 03-22, 25 |
| 24 | Fact freshness + upstream sync report (report-only) | 07-18 |
| 26 | letmemaster.com crawler + parser. Held until John commits the owner's written permission. Does not run the crawl or commit content. | 01, permission record |
| 27 | Ingest and map crawled content (not drafted; needs a real crawl and John's scope check) | 26 |

Every pull request: independent Codex review, then John merges. John alone marks facts verified and publishes.

## Feature map (modelled on public study sites)
Only the feature ideas are used. No text, questions or notes from any third-party site are copied; all content comes from the CC BY 4.0 guides by RonitSachdev.

| Feature | Lands in |
|---|---|
| Short tutorials | 03: the 37 guides as lessons |
| Quizzes with an explanation for every option | 06, 07-18 |
| Flashcards | 04 |
| Full-length timed practice exams | 20 |
| Progress tracking | 22 |
| Glossary | 25 |
| Bookmarks | 25 |
| Add to Home Screen, offline use | 23 |
| Beta / unfinished labels | Candidate and unverified badges on questions and exam facts |
| Optional sign-in to sync, feedback form | Not planned. Needs a server and accounts; your decision. Progress export and import (22) covers moving between devices. |

## Limits
| Item | Working | Total |
|---|---|---|
| Claude budget cap | 24 packets x $0.50 | $12.00 |
| Claude turns cap | 24 x 8 | 192 |
| GreenPT cap | 12 screens x EUR 0.01 | EUR 0.12 |
| Claude app-started runs | 24 of 250 a month | 24 |
| Codex reviews | 23 pull requests (24 makes none) | cost unknown |
