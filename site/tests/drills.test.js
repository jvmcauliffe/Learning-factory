const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const D = require("../drills.js");
const L = require("../reader-logic.js");

const root = path.resolve(__dirname, "..", "..");
const bank = JSON.parse(fs.readFileSync(path.join(root, "data/saa-c03/bank.json"), "utf8"));
const syllabus = JSON.parse(fs.readFileSync(path.join(root, "data/saa-c03/syllabus.json"), "utf8"));
const drills = D.buildDrills(bank, syllabus);

function fakeStorage(initial, failWrites) {
  const data = Object.assign({}, initial);
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { if (failWrites) throw new Error("blocked"); data[k] = String(v); },
  };
}

test("every bank question-pattern item is a drill, in bank order, unedited", () => {
  const items = bank.items.filter((i) => i.type === "question_pattern");
  assert.equal(drills.length, items.length);
  items.forEach((it, n) => {
    assert.equal(drills[n].id, it.id);
    assert.equal(drills[n].scenario, it.scenario);
    assert.equal(drills[n].answer, it.answer);
    assert.equal(drills[n].signal, it.signal || "");
    assert.equal(drills[n].guide, it.guide);
    assert.equal(drills[n].line, it.line);
  });
  assert.equal(new Set(drills.map((d) => d.id)).size, drills.length);
});

test("drill counts per guide match bank.json", () => {
  const expected = {};
  bank.items.filter((i) => i.type === "question_pattern").forEach((i) => { expected[i.guide] = (expected[i.guide] || 0) + 1; });
  assert.deepEqual(D.drillsPerGuide(drills), expected);
});

test("a fresh session lists every drill exactly once in bank order", () => {
  const q = D.startSession(drills, D.emptyState());
  assert.deepEqual(q, drills.map((d) => d.id));
});

test("right removes the item and records it as seen", () => {
  const q = D.startSession(drills, D.emptyState());
  const r = D.applyGrade(q, D.emptyState(), "right");
  assert.equal(r.queue.length, q.length - 1);
  assert.ok(!r.queue.includes(q[0]));
  assert.equal(r.state.seen[q[0]], 1);
  assert.equal(r.state.pending[q[0]], undefined);
});

test("wrong returns three places later and partly six, in the same session", () => {
  const q = D.startSession(drills, D.emptyState());
  const w = D.applyGrade(q, D.emptyState(), "wrong");
  assert.equal(w.queue.indexOf(q[0]), 3);
  assert.equal(w.queue.length, q.length);
  assert.equal(w.state.pending[q[0]], "wrong");
  const p = D.applyGrade(q, D.emptyState(), "partly");
  assert.equal(p.queue.indexOf(q[0]), 6);
  assert.equal(p.state.pending[q[0]], "partly");
});

test("a requeued item goes to the end when fewer places remain", () => {
  const r = D.applyGrade(["a", "b"], D.emptyState(), "partly");
  assert.deepEqual(r.queue, ["b", "a"]);
  assert.deepEqual(D.applyGrade(["a"], D.emptyState(), "wrong").queue, ["a"]);
});

test("answering right later clears an owed item", () => {
  let st = D.applyGrade(["a", "b"], D.emptyState(), "wrong").state;
  assert.equal(st.pending.a, "wrong");
  st = D.applyGrade(["a"], st, "right").state;
  assert.equal(st.pending.a, undefined);
});

test("next session: wrong first, then partly, then unseen, then seen and right", () => {
  const ids = drills.slice(0, 6).map((d) => d.id);
  const sub = drills.slice(0, 6);
  const st = { seen: { [ids[0]]: 1, [ids[1]]: 1, [ids[2]]: 1, [ids[3]]: 1 }, pending: { [ids[1]]: "partly", [ids[3]]: "wrong" } };
  assert.deepEqual(D.startSession(sub, st), [ids[3], ids[1], ids[4], ids[5], ids[0], ids[2]]);
});

test("applyGrade does not mutate its inputs and rejects an unknown grade", () => {
  const q = ["a", "b", "c"], st = D.emptyState();
  D.applyGrade(q, st, "wrong");
  assert.deepEqual(q, ["a", "b", "c"]);
  assert.deepEqual(st, { seen: {}, pending: {} });
  assert.throws(() => D.applyGrade(q, st, "maybe"));
});

test("highlighting marks only words that appear in the guide's own signal note", () => {
  const segs = D.highlightSegments("Run occasional SQL queries on logs stored in S3, minimal setup", "serverless SQL-on-S3");
  const hits = segs.filter((s) => s.hit).map((s) => s.text);
  assert.deepEqual(hits, ["SQL", "S3"]);
  assert.equal(segs.map((s) => s.text).join(""), "Run occasional SQL queries on logs stored in S3, minimal setup");
});

test("highlighting never invents a keyword and rebuilds every scenario exactly", () => {
  drills.forEach((d) => {
    const segs = D.highlightSegments(d.scenario, d.signal);
    assert.equal(segs.map((s) => s.text).join(""), d.scenario, d.id);
    const words = D.signalWords(d.signal);
    segs.filter((s) => s.hit).forEach((s) => assert.ok(words[s.text.toLowerCase()], d.id + " " + s.text));
  });
});

test("filler words and empty or punctuation-only notes highlight nothing", () => {
  assert.equal(D.highlightSegments("The app and the job", "the and for").filter((s) => s.hit).length, 0);
  assert.equal(D.highlightSegments("Anything at all", "").filter((s) => s.hit).length, 0);
  assert.equal(D.highlightSegments("Anything at all", ".").filter((s) => s.hit).length, 0);
});

test("source links point at a real guide file and a real Question patterns heading", () => {
  const files = new Set(L.lessonsInOrder(syllabus).map((l) => l.file));
  const headingSlug = {};
  files.forEach((f) => {
    const md = fs.readFileSync(path.join(root, f), "utf8");
    const h2 = md.split("\n").filter((l) => /^## /.test(l)).map((l) => l.replace(/^## /, ""));
    headingSlug[f] = new Set(L.uniqueSlugs(h2));
  });
  drills.forEach((d) => {
    assert.ok(files.has(d.guide), d.guide);
    const m = /^#\/learn\/(.+)#(.+)$/.exec(D.sourceLink(d));
    assert.equal(decodeURI(m[1]), d.guide);
    assert.ok(headingSlug[d.guide].has(m[2]), d.guide + " " + m[2]);
  });
});

test("store persists, tolerates blocked storage, and ignores corrupt data", () => {
  const st = fakeStorage();
  const a = D.createStore(st);
  a.set({ seen: { x: 1 }, pending: { x: "wrong" } });
  assert.deepEqual(D.createStore(st).get(), { seen: { x: 1 }, pending: { x: "wrong" } });
  const throwing = { getItem() { throw new Error("no"); }, setItem() { throw new Error("no"); } };
  const b = D.createStore(throwing);
  b.set({ seen: { y: 1 }, pending: {} });
  assert.equal(b.get().seen.y, 1);
  assert.equal(b.isPersistent(), false);
  assert.equal(D.createStore(null).isPersistent(), false);
  assert.deepEqual(D.createStore(fakeStorage({ [D.STATE_KEY]: "{oops" })).get(), D.emptyState());
  const mixed = JSON.stringify({ seen: { a: 1 }, pending: { a: "wrong", b: "right", c: 5 } });
  assert.deepEqual(D.createStore(fakeStorage({ [D.STATE_KEY]: mixed })).get(), { seen: { a: 1 }, pending: { a: "wrong" } });
});
