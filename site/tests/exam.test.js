"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const E = require("../exam.js");

const root = path.join(__dirname, "..", "..");
const realFacts = JSON.parse(fs.readFileSync(path.join(root, "data/saa-c03/exam-facts.json"), "utf8"));
const D = E.DOMAINS;

function bank(perDomain, status) {
  const out = [];
  D.forEach((d, di) => {
    for (let i = 0; i < perDomain; i++) {
      out.push({ id: "q" + di + "_" + i, guide: "content/saa-c03/06-VPC.md", stem: "s", correct: i % 4, domain: d,
        status: status || "candidate",
        options: [0, 1, 2, 3].map((n) => ({ text: "o" + n, explanation: "e" + n, source: { guide: "g", line: 1 } })) });
    }
  });
  return out;
}
function verifiedCopy(facts) {
  const c = JSON.parse(JSON.stringify(facts));
  c.facts.forEach((f) => { f.status = "verified"; });
  return c;
}
function counts(ids, questions) {
  const by = {}; questions.forEach((q) => { by[q.id] = q; });
  const c = {}; D.forEach((d) => { c[d] = 0; });
  ids.forEach((id) => { c[by[id].domain] += 1; });
  return c;
}

test("readFacts reads weights, count, minutes and pass mark from the facts file", () => {
  const info = E.readFacts(realFacts);
  assert.deepEqual(info.weights, { "domain-1": 30, "domain-2": 26, "domain-3": 24, "domain-4": 20 });
  assert.equal(info.total, 65);
  assert.equal(info.minutes, 130);
  assert.equal(info.passMark.scaled, 720);
  assert.equal(info.allVerified, false);
  assert.ok(info.unverified.includes("time-limit"));
});

test("readFacts throws when a needed fact is missing", () => {
  const broken = JSON.parse(JSON.stringify(realFacts));
  broken.facts = broken.facts.filter((f) => f.id !== "time-limit");
  assert.throws(() => E.readFacts(broken), /time-limit/);
});

test("allocate follows the weights within one question and sums to the total", () => {
  const plan = E.allocate({ "domain-1": 99, "domain-2": 99, "domain-3": 99, "domain-4": 99 },
    { "domain-1": 30, "domain-2": 26, "domain-3": 24, "domain-4": 20 }, 65);
  assert.equal(D.reduce((n, d) => n + plan[d], 0), 65);
  const w = { "domain-1": 30, "domain-2": 26, "domain-3": 24, "domain-4": 20 };
  D.forEach((d) => assert.ok(Math.abs(plan[d] - 65 * w[d] / 100) < 1, d + " " + plan[d]));
});

test("allocate with equal weights is even within one", () => {
  const plan = E.allocate({ "domain-1": 99, "domain-2": 99, "domain-3": 99, "domain-4": 99 },
    { "domain-1": 1, "domain-2": 1, "domain-3": 1, "domain-4": 1 }, 65);
  assert.equal(D.reduce((n, d) => n + plan[d], 0), 65);
  const vals = D.map((d) => plan[d]);
  assert.ok(Math.max(...vals) - Math.min(...vals) <= 1);
});

test("allocate caps a short domain and gives the shortfall to the others", () => {
  const plan = E.allocate({ "domain-1": 2, "domain-2": 50, "domain-3": 50, "domain-4": 50 },
    { "domain-1": 30, "domain-2": 26, "domain-3": 24, "domain-4": 20 }, 65);
  assert.equal(plan["domain-1"], 2);
  assert.equal(D.reduce((n, d) => n + plan[d], 0), 65);
});

test("allocate returns fewer questions when the bank is smaller than the exam", () => {
  const plan = E.allocate({ "domain-1": 3, "domain-2": 3, "domain-3": 3, "domain-4": 3 },
    { "domain-1": 30, "domain-2": 26, "domain-3": 24, "domain-4": 20 }, 65);
  assert.equal(D.reduce((n, d) => n + plan[d], 0), 12);
});

test("drawExam falls back to an even draw while facts are unverified", () => {
  const q = bank(40);
  const drawn = E.drawExam(q, E.readFacts(realFacts), { rng: E.seededRng(1) });
  assert.equal(drawn.mode, "even");
  assert.equal(drawn.size, 65);
  const c = counts(drawn.ids, q);
  const vals = D.map((d) => c[d]);
  assert.ok(Math.max(...vals) - Math.min(...vals) <= 1, JSON.stringify(c));
});

test("drawExam never repeats a question", () => {
  const q = bank(40);
  [1, 2, 3].forEach((seed) => {
    const drawn = E.drawExam(q, E.readFacts(realFacts), { rng: E.seededRng(seed) });
    assert.equal(new Set(drawn.ids).size, drawn.ids.length);
  });
});

test("drawExam respects the weights within one question once every fact is verified", () => {
  const q = bank(40);
  const info = E.readFacts(verifiedCopy(realFacts));
  const drawn = E.drawExam(q, info, { rng: E.seededRng(7) });
  assert.equal(drawn.mode, "weighted");
  assert.equal(drawn.size, 65);
  const c = counts(drawn.ids, q);
  D.forEach((d) => assert.ok(Math.abs(c[d] - 65 * info.weights[d] / 100) < 1, d + " " + c[d]));
});

test("drawExam is repeatable for one seed and varies between seeds", () => {
  const q = bank(40), info = E.readFacts(realFacts);
  const a = E.drawExam(q, info, { rng: E.seededRng(5) }).ids;
  const b = E.drawExam(q, info, { rng: E.seededRng(5) }).ids;
  const c = E.drawExam(q, info, { rng: E.seededRng(6) }).ids;
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test("verified-only setting: all candidates give an empty draw", () => {
  const drawn = E.drawExam(bank(40), E.readFacts(realFacts), { verifiedOnly: true, rng: E.seededRng(1) });
  assert.equal(drawn.size, 0);
});

test("verified-only setting: only verified questions are drawn", () => {
  const q = bank(40);
  q.forEach((x, i) => { if (i % 5 === 0) x.status = "verified"; });
  const drawn = E.drawExam(q, E.readFacts(realFacts), { verifiedOnly: true, rng: E.seededRng(1) });
  assert.ok(drawn.size > 0);
  const by = {}; q.forEach((x) => { by[x.id] = x; });
  drawn.ids.forEach((id) => assert.equal(by[id].status, "verified"));
});

test("drawExam with a small bank draws what exists", () => {
  const drawn = E.drawExam(bank(2), E.readFacts(realFacts), { rng: E.seededRng(1) });
  assert.equal(drawn.size, 8);
  assert.equal(drawn.requested, 65);
});

test("drawExam ignores questions with an unknown domain", () => {
  const q = bank(5);
  q.push({ id: "odd", domain: "domain-9", status: "candidate", options: [], correct: 0 });
  const drawn = E.drawExam(q, E.readFacts(realFacts), { rng: E.seededRng(1) });
  assert.ok(!drawn.ids.includes("odd"));
});

test("formatClock formats minutes and hours and never goes negative", () => {
  assert.equal(E.formatClock(130 * 60000), "2:10:00");
  assert.equal(E.formatClock(59 * 60000 + 5000), "59:05");
  assert.equal(E.formatClock(-5), "00:00");
  assert.equal(E.formatClock(1), "00:01");
});

test("timer expires exactly at the time limit", () => {
  const s = E.newSession(["a"], 130 * 60000, 1000);
  assert.equal(E.remainingMs(s, 1000), 130 * 60000);
  assert.equal(E.isExpired(s, 1000 + 130 * 60000 - 1), false);
  assert.equal(E.isExpired(s, 1000 + 130 * 60000), true);
  assert.equal(E.remainingMs(s, 1000 + 999 * 60000), 0);
});

test("answers and flags are frozen after expiry and after submit", () => {
  let s = E.newSession(["a", "b"], 60000, 0);
  s = E.setAnswer(s, "a", 2, 1000);
  assert.equal(s.answers.a, 2);
  const late = E.setAnswer(s, "a", 3, 60000);
  assert.equal(late.answers.a, 2);
  assert.equal(E.toggleFlag(s, "b", 60000).flags.b, undefined);
  s = E.submit(s, 2000, "user");
  assert.equal(E.setAnswer(s, "b", 1, 2500).answers.b, undefined);
  assert.equal(E.toggleFlag(s, "b", 2500).flags.b, undefined);
});

test("answers can be changed, cleared and flags toggled before the end", () => {
  let s = E.newSession(["a", "b"], 60000, 0);
  s = E.setAnswer(s, "a", 1, 10);
  s = E.setAnswer(s, "a", 3, 20);
  assert.equal(s.answers.a, 3);
  s = E.setAnswer(s, "a", null, 30);
  assert.equal(s.answers.a, undefined);
  s = E.toggleFlag(s, "b", 40);
  assert.equal(s.flags.b, true);
  s = E.toggleFlag(s, "b", 50);
  assert.equal(s.flags.b, undefined);
  assert.equal(E.setAnswer(s, "zzz", 1, 60).answers.zzz, undefined);
});

test("submit keeps the first result and records why it ended", () => {
  let s = E.newSession(["a"], 60000, 0);
  s = E.submit(s, 100, "time");
  const again = E.submit(s, 200, "user");
  assert.equal(again.endedBy, "time");
  assert.equal(again.endMs, 100);
});

test("goTo stays inside the exam", () => {
  const s = E.newSession(["a", "b", "c"], 1000, 0);
  assert.equal(E.goTo(s, 2).current, 2);
  assert.equal(E.goTo(s, 3).current, 0);
  assert.equal(E.goTo(s, -1).current, 0);
});

test("reviewSummary lists unanswered and flagged question numbers", () => {
  let s = E.newSession(["a", "b", "c"], 1000, 0);
  s = E.setAnswer(s, "b", 0, 1);
  s = E.toggleFlag(s, "c", 1);
  assert.deepEqual(E.reviewSummary(s), { unanswered: [1, 3], flagged: [3] });
});

test("score counts correct answers per domain and treats unanswered as incorrect", () => {
  const q = bank(2);
  const byId = {}; q.forEach((x) => { byId[x.id] = x; });
  const ids = q.map((x) => x.id);
  let s = E.newSession(ids, 1000, 0);
  s = E.setAnswer(s, "q0_0", byId.q0_0.correct, 1);
  s = E.setAnswer(s, "q0_1", (byId.q0_1.correct + 1) % 4, 1);
  s = E.setAnswer(s, "q1_0", byId.q1_0.correct, 1);
  const r = E.score(s, byId);
  assert.equal(r.total, 8);
  assert.equal(r.correct, 2);
  assert.equal(r.unanswered, 5);
  assert.deepEqual(r.byDomain["domain-1"], { correct: 1, total: 2, unanswered: 0 });
  assert.deepEqual(r.byDomain["domain-2"], { correct: 1, total: 2, unanswered: 1 });
  assert.deepEqual(r.byDomain["domain-3"], { correct: 0, total: 2, unanswered: 2 });
  assert.equal(r.percent, 25);
});

test("the results note says the real pass mark is a scaled score and the raw percentage is no prediction", () => {
  const note = E.passMarkNote(E.readFacts(realFacts));
  assert.match(note, /scaled score/);
  assert.match(note, /720/);
  assert.match(note, /not yet verified/);
  assert.match(note, /not a prediction/);
  assert.match(note, /not a percentage/);
});

test("flattenQuestions skips files that failed to load", () => {
  const out = E.flattenQuestions([{ questions: [{ id: "a" }] }, null, { questions: [{ id: "b" }, { id: "c" }] }]);
  assert.deepEqual(out.map((x) => x.id), ["a", "b", "c"]);
});

test("guideLink encodes the guide path", () => {
  assert.equal(E.guideLink("content/saa-c03/06-VPC.md"), "#/learn/content/saa-c03/06-VPC.md");
  assert.match(E.guideLink("a b.md"), /a%20b\.md/);
});

test("settings store keeps verifiedOnly and survives broken storage", () => {
  const mem = {};
  const ok = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; } };
  const s1 = E.createStore(ok);
  assert.equal(s1.get().verifiedOnly, false);
  s1.set({ verifiedOnly: true });
  assert.equal(E.createStore(ok).get().verifiedOnly, true);
  const bad = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  const s2 = E.createStore(bad);
  assert.equal(s2.get().verifiedOnly, false);
  s2.set({ verifiedOnly: true });
  assert.equal(s2.get().verifiedOnly, true);
  assert.equal(s2.isPersistent(), false);
  mem[E.SETTINGS_KEY] = "{not json";
  assert.equal(E.createStore(ok).get().verifiedOnly, false);
});

test("the real question bank can fill a full exam of 65", () => {
  const dir = path.join(root, "data/saa-c03/mcq");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
  const q = E.flattenQuestions(files);
  const drawn = E.drawExam(q, E.readFacts(realFacts), { rng: E.seededRng(3) });
  assert.equal(drawn.size, 65);
  assert.equal(new Set(drawn.ids).size, 65);
});
