"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = require("../progress.js");

const ROOT = path.join(__dirname, "..", "..");
const bank = JSON.parse(fs.readFileSync(path.join(ROOT, "data/saa-c03/bank.json"), "utf8"));
const syllabus = JSON.parse(fs.readFileSync(path.join(ROOT, "data/saa-c03/syllabus.json"), "utf8"));
const model = P.buildModel(bank, syllabus);

function fakeStorage(init, failWrite) {
  const m = Object.assign({}, init);
  return {
    getItem: (k) => (k in m ? m[k] : null),
    setItem: (k, v) => { if (failWrite) throw new Error("full"); m[k] = String(v); },
    dump: () => m,
  };
}
const G1 = model.guides[0], G2 = model.guides[1];
const card = (g, n) => model.cardIds[g.file][n];
const drill = (g, n) => model.drillIds[g.file][n];

function sampleSnapshot() {
  const s = P.emptySnapshot();
  s.lessons[G1.file] = { total: 4, done: { a: 1, b: 1 } };
  s.flashcards[card(G1, 0)] = { box: 3, due: 1000 };
  s.flashcards[card(G1, 1)] = { box: 1, due: 2000 };
  s.drills.seen[drill(G1, 0)] = 1;
  s.drills.pending[drill(G1, 1)] = "wrong";
  s.exams = [{ id: "1", at: 5000, perGuide: { [G1.file]: { correct: 3, total: 4 } } }];
  return s;
}

test("the model lists every syllabus guide in order with its card and drill counts", () => {
  assert.equal(model.guides.length, syllabus.guide_count);
  assert.equal(model.guides.reduce((a, g) => a + g.cards, 0), bank.items.filter((i) => i.type === "pocket_card").length);
  assert.equal(model.guides.reduce((a, g) => a + g.drills, 0), bank.items.filter((i) => i.type === "question_pattern").length);
  assert.equal(model.groups.length, syllabus.groups.length);
});

test("a new learner has zero readiness everywhere and still gets five next steps", () => {
  const d = P.computeDashboard(model, P.emptySnapshot());
  assert.equal(d.overall, 0);
  assert.equal(d.guides.length, model.guides.length);
  assert.equal(d.weakest.length, 5);
  d.guides.forEach((g) => assert.equal(g.readiness, 0));
  d.weakest.forEach((g) => { assert.equal(g.next.kind, "lessons"); assert.ok(g.next.href.startsWith("#/learn/")); });
  assert.deepEqual(d.weakest.map((g) => g.file), model.guides.slice(0, 5).map((g) => g.file));
});

test("lesson, card, drill and exam scores combine by weight", () => {
  const d = P.computeDashboard(model, sampleSnapshot());
  const g = d.guides[0], c = g.components;
  assert.equal(c.lessons.score, 0.5);
  const cards = G1.cards;
  assert.ok(Math.abs(c.flashcards.score - (3 / 5 + 1 / 5) / cards) < 1e-12);
  const drills = G1.drills;
  assert.ok(Math.abs(c.drills.score - 1 / drills) < 1e-12);
  assert.equal(c.exam.score, 0.75);
  const w = P.WEIGHTS;
  const want = (w.lessons * c.lessons.score + w.flashcards * c.flashcards.score + w.drills * c.drills.score + w.exam * c.exam.score) /
    (w.lessons + w.flashcards + w.drills + w.exam);
  assert.ok(Math.abs(g.readiness - want) < 1e-12);
  assert.equal(d.guides[1].components.exam, null);
});

test("a component with nothing to measure is left out of the mean", () => {
  const m = { guides: [{ file: "g", title: "G", number: 1, group: "A", cards: 0, drills: 0 }], groups: ["A"], cardIds: {}, drillIds: {} };
  const s = P.emptySnapshot();
  s.lessons.g = { total: 2, done: { x: 1, y: 1 } };
  const d = P.computeDashboard(m, s);
  assert.equal(d.guides[0].components.flashcards, null);
  assert.equal(d.guides[0].components.drills, null);
  assert.equal(d.guides[0].readiness, 1);
});

test("partly and wrong drills count less than clean ones", () => {
  const s = P.emptySnapshot();
  const [a, b, c] = model.drillIds[G1.file];
  s.drills.seen[a] = 1;
  s.drills.pending[b] = "partly"; s.drills.seen[b] = 1;
  s.drills.pending[c] = "wrong"; s.drills.seen[c] = 1;
  const sc = P.computeDashboard(model, s).guides[0].components.drills;
  assert.ok(Math.abs(sc.score - 1.5 / G1.drills) < 1e-12);
});

test("exam score uses the last three attempts that covered the guide", () => {
  const s = P.emptySnapshot();
  const r = (id, at, c, t) => ({ id, at, perGuide: { [G1.file]: { correct: c, total: t } } });
  s.exams = [r("old", 1, 0, 10), r("a", 2, 5, 10), r("b", 3, 6, 10), r("c", 4, 7, 10)];
  const sc = P.computeDashboard(model, s).guides[0].components.exam;
  assert.equal(sc.score, 18 / 30);
});

test("groups average their guides and the overall figure averages all guides", () => {
  const d = P.computeDashboard(model, sampleSnapshot());
  d.groups.forEach((g) => {
    const gs = d.guides.filter((x) => x.group === g.name);
    assert.equal(g.guides, gs.length);
    assert.ok(Math.abs(g.readiness - gs.reduce((a, x) => a + x.readiness, 0) / gs.length) < 1e-12);
  });
  assert.ok(Math.abs(d.overall - d.guides.reduce((a, x) => a + x.readiness, 0) / d.guides.length) < 1e-12);
});

test("the weakest five are the lowest readiness, ties broken by syllabus order", () => {
  const s = P.emptySnapshot();
  // Read every guide fully except guides 3, 5, 7, 9, 11, 13 and 15; guide 1 and 2 are strong.
  model.guides.forEach((g) => { s.lessons[g.file] = { total: 2, done: { a: 1, b: 1 } }; });
  const weak = [2, 4, 6, 8, 10, 12];
  weak.forEach((i) => { s.lessons[model.guides[i].file] = { total: 2, done: i === 2 ? { a: 1 } : {} }; });
  const d = P.computeDashboard(model, s);
  assert.equal(d.weakest.length, 5);
  assert.deepEqual(d.weakest.map((g) => g.order), [4, 6, 8, 10, 12]);
  assert.equal(d.weakest[0].next.kind, "lessons");
  for (let i = 1; i < d.weakest.length; i++) assert.ok(d.weakest[i].readiness >= d.weakest[i - 1].readiness);
});

test("the next step is the weakest component and links to its page", () => {
  const s = P.emptySnapshot();
  s.lessons[G1.file] = { total: 2, done: { a: 1, b: 1 } };
  model.cardIds[G1.file].forEach((id) => { s.flashcards[id] = { box: 5, due: 0 }; });
  const d1 = P.computeDashboard(model, s).guides[0];
  assert.equal(d1.next.kind, "drills");
  assert.equal(d1.next.href, "#/drills");
  model.drillIds[G1.file].forEach((id) => { s.drills.seen[id] = 1; });
  s.exams = [{ id: "e", at: 1, perGuide: { [G1.file]: { correct: 1, total: 4 } } }];
  const d2 = P.computeDashboard(model, s).guides[0];
  assert.equal(d2.next.kind, "exam");
  assert.equal(d2.next.href, "#/exam");
  assert.equal(P.computeDashboard(model, P.emptySnapshot()).guides[0].next.href, "#/learn/" + encodeURI(G1.file));
});

test("exam results come from a submitted session and count unanswered as wrong", () => {
  const byId = {
    q1: { guide: G1.file, correct: 0 }, q2: { guide: G1.file, correct: 1 }, q3: { guide: G2.file, correct: 2 },
  };
  const session = { order: ["q1", "q2", "q3"], answers: { q1: 0, q2: 3 }, submitted: true, startMs: 100, endMs: 900 };
  const r = P.examResultFromSession(session, byId);
  assert.deepEqual(r, { id: "100", at: 900, perGuide: { [G1.file]: { correct: 1, total: 2 }, [G2.file]: { correct: 0, total: 1 } } });
  assert.equal(P.examResultFromSession(Object.assign({}, session, { submitted: false }), byId), null);
  assert.equal(P.examResultFromSession(null, byId), null);
});

test("recording the same exam twice changes nothing and old attempts are capped", () => {
  const r = { id: "1", at: 1, perGuide: { g: { correct: 1, total: 1 } } };
  const once = P.addExamResult([], r);
  assert.equal(P.addExamResult(once, r), once);
  let list = [];
  for (let i = 0; i < P.EXAM_KEEP + 5; i++) list = P.addExamResult(list, { id: "x" + i, at: i, perGuide: { g: { correct: 1, total: 1 } } });
  assert.equal(list.length, P.EXAM_KEEP);
  assert.equal(list[0].id, "x5");
});

test("snapshots read from storage, skipping corrupt or invalid sections", () => {
  const good = sampleSnapshot();
  const st = fakeStorage({
    [P.KEYS.lessons]: JSON.stringify(good.lessons),
    [P.KEYS.flashcards]: "{not json",
    [P.KEYS.drills]: JSON.stringify({ seen: { a: 1 }, pending: { a: "bogus" } }),
    [P.KEYS.exams]: JSON.stringify(good.exams),
  });
  const snap = P.readSnapshot(st);
  assert.deepEqual(snap.lessons, good.lessons);
  assert.deepEqual(snap.flashcards, {});
  assert.deepEqual(snap.drills, { seen: {}, pending: {} });
  assert.deepEqual(snap.exams, good.exams);
  const throwing = { getItem() { throw new Error("blocked"); } };
  assert.deepEqual(P.readSnapshot(throwing), P.emptySnapshot());
  assert.deepEqual(P.readSnapshot(null), P.emptySnapshot());
});

test("writeSnapshot reports failure instead of throwing", () => {
  assert.equal(P.writeSnapshot(null, P.emptySnapshot()), false);
  assert.equal(P.writeSnapshot(fakeStorage({}, true), P.emptySnapshot()), false);
  const st = fakeStorage({});
  assert.equal(P.writeSnapshot(st, sampleSnapshot()), true);
  assert.deepEqual(P.readSnapshot(st), sampleSnapshot());
});

test("an exported file re-imports to the same dashboard", () => {
  const snap = sampleSnapshot();
  const text = P.serialize(snap, "2026-11-05T10:00:00.000Z");
  const doc = JSON.parse(text);
  assert.equal(doc.format, P.FORMAT);
  assert.equal(doc.version, 1);
  assert.equal(doc.exportedAt, "2026-11-05T10:00:00.000Z");
  const res = P.parseImport(text);
  assert.ok(res.ok, res.error);
  assert.deepEqual(res.snapshot, snap);
  assert.deepEqual(P.computeDashboard(model, res.snapshot), P.computeDashboard(model, snap));
  // through storage as well
  const st = fakeStorage({});
  assert.ok(P.writeSnapshot(st, res.snapshot));
  assert.deepEqual(P.computeDashboard(model, P.readSnapshot(st)), P.computeDashboard(model, snap));
});

test("an empty snapshot also round-trips", () => {
  const res = P.parseImport(P.serialize(P.emptySnapshot(), "x"));
  assert.ok(res.ok);
  assert.deepEqual(res.snapshot, P.emptySnapshot());
});

test("bad files are rejected whole with a reason", () => {
  const good = JSON.parse(P.serialize(sampleSnapshot(), "x"));
  const mutate = (fn) => { const d = JSON.parse(JSON.stringify(good)); fn(d); return JSON.stringify(d); };
  const bad = {
    "empty": "",
    "blank": "   \n",
    "not json": "{nope",
    "array": "[]",
    "null": "null",
    "wrong format": mutate((d) => { d.format = "other"; }),
    "future version": mutate((d) => { d.version = 2; }),
    "no version": mutate((d) => { delete d.version; }),
    "no data": mutate((d) => { delete d.data; }),
    "missing section": mutate((d) => { delete d.data.drills; }),
    "box out of range": mutate((d) => { d.data.flashcards[Object.keys(d.data.flashcards)[0]].box = 9; }),
    "due not a number": mutate((d) => { d.data.flashcards[Object.keys(d.data.flashcards)[0]].due = "soon"; }),
    "bad drill grade": mutate((d) => { d.data.drills.pending[Object.keys(d.data.drills.pending)[0]] = "right"; }),
    "lesson total negative": mutate((d) => { d.data.lessons[Object.keys(d.data.lessons)[0]].total = -1; }),
    "lesson done not object": mutate((d) => { d.data.lessons[Object.keys(d.data.lessons)[0]].done = []; }),
    "exam correct above total": mutate((d) => { d.data.exams[0].perGuide[Object.keys(d.data.exams[0].perGuide)[0]].correct = 99; }),
    "exam duplicate id": mutate((d) => { d.data.exams.push(JSON.parse(JSON.stringify(d.data.exams[0]))); }),
    "exams not a list": mutate((d) => { d.data.exams = {}; }),
  };
  Object.keys(bad).forEach((name) => {
    const r = P.parseImport(bad[name]);
    assert.equal(r.ok, false, name + " should be rejected");
    assert.ok(typeof r.error === "string" && r.error.length > 5, name + " needs an error message");
  });
  assert.equal(P.parseImport(undefined).ok, false);
  assert.equal(P.parseImport("x".repeat(3 * 1024 * 1024)).ok, false);
});

test("a rejected import leaves storage untouched", () => {
  const st = fakeStorage({ [P.KEYS.lessons]: JSON.stringify(sampleSnapshot().lessons) });
  const before = JSON.stringify(st.dump());
  const r = P.parseImport("{nope");
  assert.equal(r.ok, false);
  assert.equal(JSON.stringify(st.dump()), before);
});

test("percent rounds to a whole number", () => {
  assert.equal(P.pct(0), 0);
  assert.equal(P.pct(0.666), 67);
  assert.equal(P.pct(1), 100);
});
