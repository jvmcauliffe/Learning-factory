"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const T = require("../technique.js");

const ROOT = path.join(__dirname, "..", "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const bank = JSON.parse(read("data/saa-c03/bank.json"));
const guide = read(T.GUIDE36);

function allQuestions() {
  const dir = path.join(ROOT, "data/saa-c03/mcq");
  let out = [];
  fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort().forEach((f) => {
    out = out.concat(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).questions || []);
  });
  return out;
}

test("the six rules are the README text recorded in ATTRIBUTION.md", () => {
  const attr = read("content/saa-c03/ATTRIBUTION.md");
  assert.equal(T.RULES.length, 6);
  T.RULES.forEach((r, i) => {
    assert.equal(r.n, i + 1);
    assert.ok(attr.includes(r.raw), "rule " + r.n + " not found unchanged in ATTRIBUTION.md");
  });
});

test("rule display text drops emphasis marks only", () => {
  const p = T.ruleParts(T.RULES[0]);
  assert.equal(p.title, "Read the last sentence of the question first");
  assert.ok(p.body.startsWith("— "));
  assert.ok(!/\*/.test(p.body));
  T.RULES.forEach((r) => assert.ok(T.ruleParts(r).title.length > 3));
  assert.equal(T.ruleParts(T.RULES[3]).title, "When two options are twins");
  assert.equal(T.plain("a *b* **c**"), "a b c");
});

test("the drill list equals the italic list in rule 3", () => {
  const m = /\*([^*]+)\*/g;
  const italics = [];
  let x;
  while ((x = m.exec(T.RULES[2].raw.replace(/\*\*[^*]+\*\*/, "")))) italics.push(x[1]);
  const list = italics[0].split(",").map((s) => s.trim());
  const expected = [];
  list.forEach((s) => s.split("/").forEach((p) => expected.push(p.trim())));
  assert.deepEqual(T.QUALIFIERS, expected);
});

test("guide notes appear at the stated lines of guide 36", () => {
  const lines = guide.split("\n");
  T.GUIDE_NOTES[1].forEach((n) => assert.equal(lines[n.line - 1].replace(/^- /, ""), n.text));
});

test("routes reach all six rules, the drill and the deck", () => {
  for (let n = 1; n <= 6; n++) assert.deepEqual(T.parseRoute("#/technique/rule/" + n), { page: "rule", n });
  assert.deepEqual(T.parseRoute("#/technique"), { page: "home" });
  assert.deepEqual(T.parseRoute("#/technique/"), { page: "home" });
  assert.deepEqual(T.parseRoute("#/technique/drill"), { page: "drill" });
  assert.deepEqual(T.parseRoute("#/technique/traps"), { page: "traps" });
  assert.deepEqual(T.parseRoute("#/technique/rule/7"), { page: "home" });
  assert.deepEqual(T.parseRoute("#/technique/rule/x"), { page: "home" });
  assert.deepEqual(T.parseRoute("#/exam"), { page: "none" });
  assert.deepEqual(T.parseRoute(""), { page: "none" });
  assert.equal(T.ruleHref(4), "#/technique/rule/4");
});

test("findQualifiers finds words and the phrase, ignoring case and look-alikes", () => {
  const terms = (s) => T.findQualifiers(s).map((q) => q.term);
  assert.deepEqual(terms("It is Serverless and ALWAYS scales"), ["serverless", "always"]);
  assert.deepEqual(terms("Costs are at no cost to you"), ["at no cost"]);
  assert.deepEqual(terms("It cannot be changed immediately or directly"), ["cannot", "immediately", "directly"]);
  assert.deepEqual(terms("automatically"), ["automatically"]);
  assert.deepEqual(terms("indirectly, alwaysOn, semi-serverless? no"), ["serverless"]);
  assert.deepEqual(terms("nothing to see here"), []);
  assert.deepEqual(terms(""), []);
});

test("segments rebuild the text exactly and flag each word of a phrase", () => {
  const text = "Data is replicated at no cost, automatically (it's O'Neil-style).";
  const segs = T.segments(text);
  assert.equal(segs.map((s) => s.text).join(""), text);
  const flagged = segs.filter((s) => s.qualifier).map((s) => s.text);
  assert.deepEqual(flagged, ["at", "no", "cost", "automatically"]);
  assert.ok(segs.every((s) => s.word === /[A-Za-z0-9]/.test(s.text.charAt(0))));
  assert.deepEqual(T.segments(""), []);
});

test("drills are built from real questions and each has a qualifier to find", () => {
  const qs = allQuestions();
  assert.ok(qs.length > 0);
  const drills = T.buildQualifierDrills(qs);
  assert.ok(drills.length > 0 && drills.length <= qs.length);
  const ids = new Set();
  drills.forEach((d) => {
    assert.ok(d.expected >= 1);
    assert.equal(d.parts.length, 5);
    assert.ok(!ids.has(d.id));
    ids.add(d.id);
    assert.equal(T.drillWords(d).filter((w) => w.qualifier).length, d.expected);
  });
});

test("a question without a qualifier gives no drill", () => {
  const q = { id: "x", guide: "g", stem: "Which service stores objects?", options: [{ text: "S3" }, { text: "EBS" }, { text: "EFS" }, { text: "SQS" }] };
  assert.deepEqual(T.buildQualifierDrills([q]), []);
});

test("checkTaps separates found, missed and not-on-the-list words", () => {
  const q = { id: "q", guide: "g", stem: "The service is serverless.",
    options: [{ text: "It cannot scale" }, { text: "It scales" }, { text: "It is fast" }, { text: "none" }] };
  const [d] = T.buildQualifierDrills([q]);
  assert.equal(d.expected, 2);
  const words = T.drillWords(d);
  const key = (t) => words.find((w) => w.text === t).key;
  const perfect = T.checkTaps(d, [key("serverless"), key("cannot")]);
  assert.ok(perfect.perfect);
  assert.equal(perfect.hit.length, 2);
  const partial = T.checkTaps(d, [key("serverless"), key("fast")]);
  assert.ok(!partial.perfect);
  assert.deepEqual(partial.missed.map((w) => w.text), ["cannot"]);
  assert.deepEqual(partial.wrong.map((w) => w.text), ["fast"]);
  const none = T.checkTaps(d, []);
  assert.equal(none.missed.length, 2);
  assert.equal(none.expected, 2);
});

test("the trap table in guide 36 has 20 rows with correct line numbers", () => {
  const rows = T.parseTrapTable(guide);
  assert.equal(rows.length, 20);
  const lines = guide.split("\n");
  rows.forEach((r) => {
    assert.ok(r.trap && r.truth);
    assert.ok(!/\*/.test(r.trap + r.truth));
    assert.equal(lines[r.line - 1].charAt(0), "|");
    assert.ok(lines[r.line - 1].includes(r.trap.split(" ")[0]));
  });
  assert.deepEqual(T.parseTrapTable("# nothing"), []);
});

test("the deck holds every guide-36 trap and every TRAP row of the bank", () => {
  const deck = T.buildTrapDeck(guide, bank);
  const trapRows = bank.items.filter((it) => it.type === "pocket_card" && (it.is_trap === true || /\bTRAP\b/.test(it.answer)));
  assert.ok(trapRows.length >= 2);
  assert.equal(deck.length, 20 + trapRows.length);
  const ids = new Set(deck.map((c) => c.id));
  assert.equal(ids.size, deck.length);
  trapRows.forEach((it) => assert.ok(ids.has(it.id), it.id + " missing"));
  deck.forEach((c) => {
    assert.ok(c.front && c.back && c.label && c.guide);
    assert.ok(c.line > 0);
  });
  assert.ok(deck.slice(0, 20).every((c) => c.guide === T.GUIDE36));
});

test("guide links use the lesson route with a section slug", () => {
  assert.equal(T.sectionSlug("The greatest-hits trap list"), "the-greatest-hits-trap-list");
  assert.equal(T.sectionSlug("Cost & value"), "cost-and-value");
  assert.equal(T.guideLink(T.GUIDE36, "The greatest-hits trap list"), "#/learn/content/saa-c03/36-Exam-Traps-KeyPatterns.md#the-greatest-hits-trap-list");
});
