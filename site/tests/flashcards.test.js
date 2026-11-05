const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const F = require("../flashcards.js");

const root = path.resolve(__dirname, "..", "..");
const bank = JSON.parse(fs.readFileSync(path.join(root, "data/saa-c03/bank.json"), "utf8"));
const syllabus = JSON.parse(fs.readFileSync(path.join(root, "data/saa-c03/syllabus.json"), "utf8"));
const cards = F.buildCards(bank, syllabus);
const T0 = Date.UTC(2026, 10, 5, 9, 0, 0);
const DAY = F.DAY_MS;

function fakeStorage(initial, failWrites) {
  const data = Object.assign({}, initial);
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { if (failWrites) throw new Error("blocked"); data[k] = String(v); },
    data,
  };
}

test("every bank pocket-card item is a card, in bank order, unedited", () => {
  const items = bank.items.filter((i) => i.type === "pocket_card");
  assert.equal(cards.length, items.length);
  items.forEach((it, n) => {
    assert.equal(cards[n].id, it.id);
    assert.equal(cards[n].front, it.keyword);
    assert.equal(cards[n].back, it.answer);
    assert.equal(cards[n].guide, it.guide);
    assert.equal(cards[n].line, it.line);
    assert.equal(cards[n].trap, it.is_trap);
  });
  assert.equal(new Set(cards.map((c) => c.id)).size, cards.length);
});

test("card counts per guide match bank.json", () => {
  const expected = {};
  bank.items.filter((i) => i.type === "pocket_card").forEach((i) => { expected[i.guide] = (expected[i.guide] || 0) + 1; });
  assert.deepEqual(F.cardsPerGuide(cards), expected);
  assert.equal(Object.keys(expected).length, 37);
});

test("every card has a topic group from the syllabus", () => {
  const groups = new Set(syllabus.groups.map((g) => g.name));
  cards.forEach((c) => assert.ok(groups.has(c.group), c.guide));
});

test("filter counts: guide, group, traps only, and combinations", () => {
  const traps = cards.filter((c) => c.trap);
  assert.ok(traps.length > 0);
  assert.equal(F.filterCards(cards, { trapsOnly: true }).length, traps.length);
  assert.equal(F.filterCards(cards, {}).length, cards.length);
  assert.equal(F.filterCards(cards, { guide: "all", group: "all" }).length, cards.length);
  const perGuide = F.cardsPerGuide(cards);
  const g = Object.keys(perGuide)[0];
  assert.equal(F.filterCards(cards, { guide: g }).length, perGuide[g]);
  const groupTotal = syllabus.groups.reduce((n, grp) => n + F.filterCards(cards, { group: grp.name }).length, 0);
  assert.equal(groupTotal, cards.length);
  const both = F.filterCards(cards, { guide: g, trapsOnly: true });
  assert.ok(both.every((c) => c.guide === g && c.trap));
});

test("box intervals are 0, 1, 3, 7 and 14 days", () => {
  assert.deepEqual(F.BOX_DAYS, [0, 1, 3, 7, 14]);
});

test("promotion: a new card answered right climbs one box at a time and caps at 5", () => {
  let s = {};
  const id = cards[0].id;
  const expectDays = [1, 3, 7, 14, 14, 14];
  expectDays.forEach((days, n) => {
    s = F.grade(s, id, true, T0);
    assert.equal(s[id].box, Math.min(n + 2, 5));
    assert.equal(s[id].due, T0 + days * DAY);
  });
});

test("demotion: a miss sends the card to box 1, due at once", () => {
  let s = {};
  const id = cards[0].id;
  s = F.grade(F.grade(F.grade(s, id, true, T0), id, true, T0), id, true, T0);
  assert.equal(s[id].box, 4);
  s = F.grade(s, id, false, T0 + DAY);
  assert.deepEqual(s[id], { box: 1, due: T0 + DAY });
  assert.ok(F.isDue(s, id, T0 + DAY));
});

test("grade does not mutate the previous state", () => {
  const s = {};
  const next = F.grade(s, cards[0].id, true, T0);
  assert.deepEqual(s, {});
  assert.notEqual(next, s);
});

test("due queue: new and overdue cards only, lowest box first, then earliest due, then bank order", () => {
  const [a, b, c, d, e] = cards;
  let s = {};
  s[a.id] = { box: 3, due: T0 - DAY };          // due, box 3
  s[b.id] = { box: 1, due: T0 - 2 * DAY };      // due, box 1, older
  s[c.id] = { box: 1, due: T0 - DAY };          // due, box 1, newer
  s[d.id] = { box: 2, due: T0 + DAY };          // not due yet
  const sub = [a, b, c, d, e];
  const q = F.dueQueue(sub, s, T0).map((x) => x.id);
  // e is new (treated as box 1, due 0), so it sorts ahead of b and c
  assert.deepEqual(q, [e.id, b.id, c.id, a.id]);
  assert.ok(!q.includes(d.id));
});

test("due queue is empty once everything is scheduled in the future, and refills later", () => {
  const sub = cards.slice(0, 3);
  let s = {};
  sub.forEach((c) => { s = F.grade(s, c.id, true, T0); });
  assert.equal(F.dueQueue(sub, s, T0).length, 0);
  assert.equal(F.dueQueue(sub, s, T0 + DAY).length, 3);
});

test("box counts treat new cards as box 1", () => {
  const sub = cards.slice(0, 4);
  const s = F.grade(F.grade({}, sub[0].id, true, T0), sub[0].id, true, T0);
  assert.deepEqual(F.boxCounts(sub, s), [3, 0, 1, 0, 0]);
});

test("store persists across instances", () => {
  const st = fakeStorage();
  const a = F.createStore(st);
  a.set(F.grade({}, "b0011", true, T0));
  const b = F.createStore(st);
  assert.deepEqual(b.get()["b0011"], { box: 2, due: T0 + DAY });
  assert.ok(b.isPersistent());
});

test("blocked storage: still works in memory and reports not persistent", () => {
  const throwing = { getItem() { throw new Error("no"); }, setItem() { throw new Error("no"); } };
  const a = F.createStore(throwing);
  a.set(F.grade({}, "x", true, T0));
  assert.equal(a.get().x.box, 2);
  assert.equal(a.isPersistent(), false);
  const noStorage = F.createStore(null);
  noStorage.set({ y: { box: 1, due: 0 } });
  assert.equal(noStorage.isPersistent(), false);
  const failingWrite = F.createStore(fakeStorage({}, true));
  failingWrite.set({ z: { box: 1, due: 0 } });
  assert.equal(failingWrite.isPersistent(), false);
  assert.equal(failingWrite.get().z.box, 1);
});

test("corrupt or hostile stored data is ignored, valid entries kept", () => {
  assert.deepEqual(F.createStore(fakeStorage({ [F.STATE_KEY]: "{not json" })).get(), {});
  assert.deepEqual(F.createStore(fakeStorage({ [F.STATE_KEY]: "[1,2]" })).get(), {});
  const mixed = JSON.stringify({ ok: { box: 2, due: 5 }, bad1: { box: 9, due: 5 }, bad2: { box: 2 }, bad3: "x" });
  assert.deepEqual(F.createStore(fakeStorage({ [F.STATE_KEY]: mixed })).get(), { ok: { box: 2, due: 5 } });
});
