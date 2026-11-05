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

## Source and credit

The study content will be adapted from **[aws-saa-c03-guides](https://github.com/RonitSachdev/aws-saa-c03-guides)** by **RonitSachdev**, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Anything built from it must keep this credit and link. The copied guides, their commit and the changes made are recorded in [content/saa-c03/ATTRIBUTION.md](content/saa-c03/ATTRIBUTION.md).

This repository's own licence has not been chosen yet. That is an owner decision.

## Disclaimer

These are community study materials, not affiliated with or endorsed by AWS. Exam facts stay marked unverified until the owner checks them against current AWS documentation.
