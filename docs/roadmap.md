# Build roadmap

Each step is a separately approved Claude task packet posted on `jvmcauliffe/content-creation-pipeline`. The full packet texts were drafted on 5 November 2026, and each one passed the harness lint at that date. Base commits are restamped when a packet is posted.

## Order and dependencies
| # | Packet | Needs |
|---|---|---|
| 0 | Owner step: first commit (done) and a way to run packets in this repository | - |
| 01 | Question bank from all 37 guides | 0 |
| 02 | Syllabus + exam facts (unverified until John checks) | 01 |
| 03 | Site shell + lesson reader | 01, 02 |
| 04 | Flashcards, spaced repetition | 03 |
| 05 | Scenario drills | 03 |
| 06 | Multiple-choice schema, validator, domain map | 01, 02 |
| 07-18 | Multiple-choice authoring, 12 batches covering all 37 guides | 06 |
| 19 | GreenPT ambiguity screen, one per 07-18 pull request | each of 07-18 |
| 20 | Timed practice exam | 06, any of 07-18 |
| 21 | Exam technique trainer | 03, 06 |
| 22 | Progress dashboard, export/import | 04, 05, 20 |
| 23 | Accessibility, offline, browser tests | 03-22 |
| 24 | Fact freshness + upstream sync report (report-only) | 07-18 |

Every pull request: independent Codex review, then John merges. John alone marks facts verified and publishes.

