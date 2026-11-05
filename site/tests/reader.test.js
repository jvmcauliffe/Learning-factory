const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const L = require("../reader-logic.js");

const root = path.resolve(__dirname, "..", "..");
const syllabus = JSON.parse(fs.readFileSync(path.join(root, "data/saa-c03/syllabus.json"), "utf8"));

function fakeStorage(initial) {
  const data = Object.assign({}, initial);
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    data,
  };
}
const blocked = {
  getItem() { throw new Error("blocked"); },
  setItem() { throw new Error("blocked"); },
};

test("37 lessons in syllabus order, each exactly once", () => {
  const lessons = L.lessonsInOrder(syllabus);
  assert.equal(lessons.length, 37);
  assert.deepEqual(lessons.map((l) => l.order), Array.from({ length: 37 }, (_, i) => i + 1));
  assert.equal(new Set(lessons.map((l) => l.file)).size, 37);
  assert.equal(lessons[0].number, "06");
  assert.equal(lessons[36].number, "36");
});

test("every lesson file exists on disk", () => {
  for (const l of L.lessonsInOrder(syllabus)) {
    assert.ok(fs.existsSync(path.join(root, l.file)), l.file);
  }
});

test("grouped lessons keep the 8 groups and total 37", () => {
  const groups = L.groupedLessons(syllabus);
  assert.equal(groups.length, 8);
  assert.equal(groups.reduce((n, g) => n + g.lessons.length, 0), 37);
});

test("section slugs are stable and unique", () => {
  assert.equal(L.sectionSlug("The idea"), "the-idea");
  assert.equal(L.sectionSlug("Pocket card"), "pocket-card");
  assert.equal(L.sectionSlug("Storage classes and THE 3-filter algorithm"), "storage-classes-and-the-3-filter-algorithm");
  assert.equal(L.sectionSlug("EBS, EFS & Instance Store"), "ebs-efs-and-instance-store");
  assert.deepEqual(L.uniqueSlugs(["The idea", "Notes", "Notes"]), ["the-idea", "notes", "notes-2"]);
});

test("every guide has the four standard anchors or a documented gap", () => {
  const gaps = [];
  for (const l of L.lessonsInOrder(syllabus)) {
    const text = fs.readFileSync(path.join(root, l.file), "utf8");
    const slugs = text.split("\n").filter((x) => /^## /.test(x)).map((x) => L.sectionSlug(x.slice(3)));
    for (const need of ["the-idea", "question-patterns", "pocket-card"]) {
      if (!slugs.includes(need)) gaps.push(l.file + " lacks " + need);
    }
  }
  // Guide 36 (traps) is the one upstream guide without the standard pattern.
  assert.ok(gaps.length <= 1, gaps.join("; "));
});

test("neighbours at the ends and in the middle", () => {
  const lessons = L.lessonsInOrder(syllabus);
  assert.equal(L.neighbours(lessons, lessons[0].file).prev, null);
  assert.equal(L.neighbours(lessons, lessons[36].file).next, null);
  const mid = L.neighbours(lessons, lessons[5].file);
  assert.equal(mid.prev.order, 5);
  assert.equal(mid.next.order, 7);
  assert.deepEqual(L.neighbours(lessons, "nope.md"), { prev: null, next: null });
});

test("progress marks sections, completes a guide, and persists", () => {
  const s = fakeStorage();
  const p = L.createProgress(s);
  p.setTotal("g.md", 2);
  assert.deepEqual(p.summary("g.md"), { done: 0, total: 2, complete: false });
  p.mark("g.md", "the-idea", true);
  assert.equal(p.isRead("g.md", "the-idea"), true);
  p.mark("g.md", "pocket-card", true);
  assert.equal(p.summary("g.md").complete, true);
  assert.equal(p.completeCount(["g.md", "h.md"]), 1);
  p.mark("g.md", "pocket-card", false);
  assert.equal(p.summary("g.md").complete, false);
  const again = L.createProgress(s);
  assert.equal(again.isRead("g.md", "the-idea"), true);
  assert.equal(again.isPersistent(), true);
});

test("blocked storage never throws and progress works in memory", () => {
  const p = L.createProgress(blocked);
  p.setTotal("g.md", 1);
  p.mark("g.md", "the-idea", true);
  assert.equal(p.summary("g.md").complete, true);
  assert.equal(p.isPersistent(), false);
  assert.equal(L.readTheme(blocked), null);
  L.writeTheme(blocked, "dark");
  const none = L.createProgress(null);
  none.mark("g.md", "x", true);
  assert.equal(none.isRead("g.md", "x"), true);
});

test("corrupt stored progress is ignored", () => {
  for (const bad of ["{not json", "[]", "42", "null"]) {
    const p = L.createProgress(fakeStorage({ [L.PROGRESS_KEY]: bad }));
    p.mark("g.md", "a", true);
    assert.equal(p.isRead("g.md", "a"), true, bad);
  }
});

test("route parsing", () => {
  assert.deepEqual(L.parseRoute(""), { view: "home" });
  assert.deepEqual(L.parseRoute("#/"), { view: "home" });
  assert.deepEqual(L.parseRoute("#/learn"), { view: "learn", anchor: null });
  assert.deepEqual(L.parseRoute("#/exam"), { view: "exam", anchor: null });
  const r = L.parseRoute("#/learn/content/saa-c03/02-S3.md#pocket-card");
  assert.deepEqual(r, { view: "lesson", file: "content/saa-c03/02-S3.md", anchor: "pocket-card" });
});
