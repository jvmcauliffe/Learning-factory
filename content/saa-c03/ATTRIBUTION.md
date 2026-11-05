# Attribution

The files in this folder (`00-README.md` and `01-*.md` to `37-*.md`) are copied unchanged from the topic guides in:

- **Author:** RonitSachdev
- **Repository:** https://github.com/RonitSachdev/aws-saa-c03-guides
- **Commit:** a71e466f02702fe01a6fe414c0b49cb8a673d205
- **Licence:** Creative Commons Attribution 4.0 International (CC BY 4.0), https://creativecommons.org/licenses/by/4.0/

Files elsewhere in this repository (the question bank, flashcards, drills and so on) adapt this material. Each adapted file or data record keeps a reference to the guide file and line it came from. Changes were made: the guides were parsed, restructured and extended. The author has not endorsed this repository.

`SHA256SUMS` lists the checksum of each copied file, so any edit to the originals is detected by `tests/test_build_bank.py`.

## Exam-technique rules (README.md)

The six exam-technique rules used by `site/technique.js` are copied from the "Exam-technique rules" section (lines 29 to 36) of the upstream `README.md`, which is not otherwise copied into this repository. They are by **RonitSachdev**, from https://github.com/RonitSachdev/aws-saa-c03-guides at commit a71e466f02702fe01a6fe414c0b49cb8a673d205, licensed CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). The text below is unchanged; the site shows it without the Markdown emphasis marks. The poison-qualifier drill checks taps against the word list in rule 3 and nothing else.

1. **Read the last sentence of the question first** — "MOST cost-effective" vs "LEAST operational overhead" vs "highly available" decides between the two plausible finalists.
2. **Count the requirements** — "X *as well as* Y" is a checklist; the right answer ticks every box. Half-solutions are planted for people who stop at the first match.
3. **Scan options for poison qualifiers** — *serverless, automatically, at no cost, immediately, directly, cannot/always* — a true fact welded to one false word is the exam's favorite distractor.
4. **When two options are twins**, the entire question lives in the differing clause.
5. **Requirements are eliminators, not decoration** — a stated number (retrieval time, IOPS, RPO/RTO) exists to kill specific options. Eliminate first, then pick the cheapest/most-managed survivor.
6. **When every familiar option is wrong-scope, the unfamiliar one is the answer** — real-but-unknown features sound specific and boring; fabricated ones sound grand and vague.
