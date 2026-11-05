"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const B = require("../bookmarks.js");
const Progress = require("../progress.js");

const G = "content/saa-c03/01-IAM.md";

function fakeStorage(seed, throws) {
  const m = Object.assign({}, seed || {});
  return {
    m,
    getItem(k) { if (throws) throw new Error("denied"); return k in m ? m[k] : null; },
    setItem(k, v) { if (throws) throw new Error("denied"); m[k] = String(v); },
  };
}
const lesson = (slug, at) => B.make("lesson", G + "#" + slug, G, "Section " + slug, slug, at);

test("make builds a valid bookmark and rejects bad pieces", () => {
  const b = lesson("roles", 5);
  assert.equal(b.id, "lesson:" + G + "#roles");
  assert.equal(b.anchor, "roles");
  assert.equal(B.make("card", "b0001", G, "IAM → identity", "pocket-card", 1).kind, "card");
  assert.equal(B.make("nope", "x", G, "t", "", 1), null);
  assert.equal(B.make("card", "b1", "elsewhere/x.md", "t", "", 1), null);
  assert.equal(B.make("card", "b1", G, "   ", "", 1), null);
  assert.equal(B.make("card", "", G, "t", "", 1), null);
  assert.equal(B.make("card", "b1", G, "t", "", NaN), null);
  assert.equal(B.make("card", "b1", G, "t", "Bad Anchor!", 1), null);
});

test("long titles are cut to 300 characters", () => {
  assert.equal(B.make("question", "q0001", G, "x".repeat(900), "", 1).title.length, 300);
});

test("add is idempotent and remove is exact", () => {
  const a = lesson("a", 1), b = lesson("b", 2);
  let list = B.add([], a);
  assert.deepEqual(list, [a]);
  assert.equal(B.add(list, a), list);
  list = B.add(list, b);
  assert.equal(list.length, 2);
  assert.equal(B.remove(list, "nope"), list);
  assert.deepEqual(B.remove(list, a.id), [b]);
  assert.equal(B.add(list, null), list);
});

test("toggle adds then removes", () => {
  const a = lesson("a", 1);
  const on = B.toggle([], a);
  assert.equal(B.has(on, a.id), true);
  assert.equal(B.has(B.toggle(on, a), a.id), false);
});

test("the list stops at the maximum", () => {
  let list = [];
  for (let i = 0; i < B.MAX; i++) list = B.add(list, B.make("question", "q" + i, G, "t" + i, "", i));
  assert.equal(list.length, B.MAX);
  const full = B.add(list, B.make("question", "extra", G, "t", "", 1));
  assert.equal(full, list);
});

test("sorted is newest first with a stable tie break, and does not mutate", () => {
  const a = lesson("a", 1), b = lesson("b", 3), c = lesson("c", 3);
  const list = [a, c, b];
  assert.deepEqual(B.sorted(list).map((x) => x.ref.split("#")[1]), ["b", "c", "a"]);
  assert.deepEqual(list, [a, c, b]);
});

test("grouped keeps kind order and skips empty kinds", () => {
  const q = B.make("question", "q1", G, "Q", "", 1);
  const g = B.grouped([q, lesson("a", 2)]);
  assert.deepEqual(g.map((x) => x.kind), ["lesson", "question"]);
  assert.equal(g[0].label, "Lesson sections");
});

test("href links to the guide, with the section when there is one", () => {
  assert.equal(B.href(lesson("roles", 1)), "#/learn/" + encodeURI(G) + "#roles");
  assert.equal(B.href(B.make("question", "q1", G, "Q", "", 1)), "#/learn/" + encodeURI(G));
});

test("clean accepts good data and copies it", () => {
  const a = lesson("a", 1);
  const out = B.clean([a]);
  assert.deepEqual(out, [a]);
  assert.notEqual(out[0], a);
  assert.deepEqual(B.clean([]), []);
});

test("clean rejects anything malformed instead of repairing it", () => {
  const a = lesson("a", 1);
  const bad = [
    "x", null, {}, [null], [a, a],
    [Object.assign({}, a, { id: "lesson:other" })],
    [Object.assign({}, a, { kind: "video" })],
    [Object.assign({}, a, { guide: "../etc/passwd" })],
    [Object.assign({}, a, { title: "" })],
    [Object.assign({}, a, { title: "t".repeat(301) })],
    [Object.assign({}, a, { at: "1" })],
    [Object.assign({}, a, { at: Infinity })],
    [Object.assign({}, a, { anchor: "<b>" })],
    [Object.assign({}, a, { ref: 5 })],
    new Array(B.MAX + 1).fill(a),
  ];
  bad.forEach((x, i) => assert.equal(B.clean(x), null, "case " + i));
});

test("clean drops unknown extra properties", () => {
  const a = Object.assign({}, lesson("a", 1), { extra: "<script>" });
  assert.equal("extra" in B.clean([a])[0], false);
});

test("read and write survive missing, throwing and corrupt storage", () => {
  assert.deepEqual(B.read(null), []);
  assert.equal(B.write(null, []), false);
  assert.deepEqual(B.read(fakeStorage({}, true)), []);
  assert.equal(B.write(fakeStorage({}, true), []), false);
  assert.deepEqual(B.read(fakeStorage({ [B.KEY]: "{nope" })), []);
  assert.deepEqual(B.read(fakeStorage({ [B.KEY]: JSON.stringify([{ id: "x" }]) })), []);
  const st = fakeStorage();
  const a = lesson("a", 1);
  assert.equal(B.write(st, [a]), true);
  assert.deepEqual(B.read(st), [a]);
});

function patched(st) {
  const P = Object.assign({}, Progress);
  assert.equal(B.install(P, st), true);
  return P;
}

test("install patches once and refuses a bad target", () => {
  const P = Object.assign({}, Progress);
  assert.equal(B.install(P, null), true);
  assert.equal(B.install(P, null), false);
  assert.equal(B.install(null, null), false);
  assert.equal(B.install({}, null), false);
});

test("the export carries the bookmarks and the import restores them", () => {
  const src = fakeStorage();
  const a = lesson("a", 1), q = B.make("question", "q0001", G, "Which?", "", 2);
  B.write(src, [a, q]);
  const P = patched(src);
  const text = P.serialize(P.emptySnapshot(), "2026-11-05T10:00:00.000Z");
  assert.deepEqual(JSON.parse(text).data.bookmarks, [a, q]);
  const res = P.parseImport(text);
  assert.equal(res.ok, true);
  assert.deepEqual(res.snapshot.bookmarks, [a, q]);
  const dest = fakeStorage();
  assert.equal(P.writeSnapshot(dest, res.snapshot), true);
  assert.deepEqual(B.read(dest), [a, q]);
});

test("an old export without bookmarks still imports and leaves bookmarks alone", () => {
  const dest = fakeStorage();
  const keep = lesson("keep", 9);
  B.write(dest, [keep]);
  const P = patched(dest);
  const old = Progress.serialize(Progress.emptySnapshot(), "x");
  assert.equal("bookmarks" in JSON.parse(old).data, false);
  const res = P.parseImport(old);
  assert.equal(res.ok, true);
  assert.equal("bookmarks" in res.snapshot, false);
  assert.equal(P.writeSnapshot(dest, res.snapshot), true);
  assert.deepEqual(B.read(dest), [keep]);
});

test("a malformed bookmarks section rejects the whole import", () => {
  const P = patched(fakeStorage());
  const doc = JSON.parse(P.serialize(P.emptySnapshot(), "x"));
  doc.data.bookmarks = [{ id: "x" }];
  const res = P.parseImport(JSON.stringify(doc));
  assert.equal(res.ok, false);
  assert.match(res.error, /bookmarks/);
  doc.data.bookmarks = "nope";
  assert.equal(P.parseImport(JSON.stringify(doc)).ok, false);
});

test("an export that Progress itself rejects is still rejected", () => {
  const P = patched(fakeStorage());
  assert.equal(P.parseImport("{nope").ok, false);
  assert.equal(P.parseImport("[]").ok, false);
});

test("writeSnapshot reports failure when the bookmarks cannot be saved", () => {
  const P = patched(fakeStorage());
  const snap = P.emptySnapshot();
  snap.bookmarks = [lesson("a", 1)];
  assert.equal(P.writeSnapshot(fakeStorage({}, true), snap), false);
});
