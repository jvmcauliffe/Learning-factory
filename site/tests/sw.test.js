"use strict";
/* The service worker's cache lists must match the files on disk, and the content version
 * in the cache name must match a hash of those files. If this fails after a content change,
 * update CONTENT_FILES / CONTENT_HASH in site/sw.js to the values reported here. */
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..");
const SW = require("../sw.js");

function contentHash(files) {
  const h = crypto.createHash("sha256");
  files.slice().sort().forEach((f) => { h.update(f + "\0"); h.update(fs.readFileSync(path.join(ROOT, f))); h.update("\0"); });
  return h.digest("hex").slice(0, 8);
}

test("every listed content file exists, once", () => {
  assert.equal(new Set(SW.CONTENT_FILES).size, SW.CONTENT_FILES.length);
  SW.CONTENT_FILES.forEach((f) => assert.ok(fs.existsSync(path.join(ROOT, f)), f));
});

test("every listed shell file exists, once", () => {
  assert.equal(new Set(SW.SHELL_FILES).size, SW.SHELL_FILES.length);
  SW.SHELL_FILES.filter((f) => f !== "./").forEach((f) => assert.ok(fs.existsSync(path.join(ROOT, "site", f)), f));
});

test("every script the page loads is cached", () => {
  const html = fs.readFileSync(path.join(ROOT, "site", "index.html"), "utf8");
  const local = [...html.matchAll(/<script src="([^":]+)"/g)].map((m) => m[1]);
  assert.ok(local.length >= 10);
  local.forEach((f) => assert.ok(SW.SHELL_FILES.includes(f), f + " is not in SHELL_FILES"));
  [...html.matchAll(/<link [^>]*href="([^":]+)"/g)].map((m) => m[1]).forEach((f) => assert.ok(SW.SHELL_FILES.includes(f), f + " is not in SHELL_FILES"));
});

test("it covers every guide, every question file and the data the pages fetch", () => {
  const syl = JSON.parse(fs.readFileSync(path.join(ROOT, "data/saa-c03/syllabus.json"), "utf8"));
  const guides = [];
  syl.groups.forEach((g) => g.guides.forEach((x) => guides.push(x.file)));
  assert.equal(guides.length, 37);
  guides.forEach((g) => {
    assert.ok(SW.CONTENT_FILES.includes(g), g);
    assert.ok(SW.CONTENT_FILES.includes("data/saa-c03/mcq/" + path.basename(g).replace(/\.md$/, ".json")), g);
  });
  ["syllabus.json", "bank.json", "glossary.json", "exam-facts.json"].forEach((f) => assert.ok(SW.CONTENT_FILES.includes("data/saa-c03/" + f), f));
  assert.ok(SW.CONTENT_FILES.includes("content/saa-c03/ATTRIBUTION.md"));
  const mcq = fs.readdirSync(path.join(ROOT, "data/saa-c03/mcq")).filter((f) => f.endsWith(".json") && f !== "schema.json");
  assert.equal(mcq.length, guides.length);
  mcq.forEach((f) => assert.ok(SW.CONTENT_FILES.includes("data/saa-c03/mcq/" + f), f));
});

test("every fetched url in the site code is in the content list", () => {
  const seen = new Set();
  fs.readdirSync(path.join(ROOT, "site")).filter((f) => f.endsWith(".js") && f !== "sw.js").forEach((f) => {
    const src = fs.readFileSync(path.join(ROOT, "site", f), "utf8");
    for (const m of src.matchAll(/"\.\.\/(data\/saa-c03\/[a-z0-9-]+\.json)"/g)) seen.add(m[1]);
  });
  assert.ok(seen.size >= 4);
  seen.forEach((f) => assert.ok(SW.CONTENT_FILES.includes(f), f));
});

test("the cache name carries the upstream commit and a hash of the content", () => {
  assert.equal(SW.CACHE_NAME, "lf-saa-c03-" + SW.UPSTREAM_COMMIT + "-" + SW.CONTENT_HASH);
  const attribution = fs.readFileSync(path.join(ROOT, "content/saa-c03/ATTRIBUTION.md"), "utf8");
  assert.ok(attribution.includes("a71e466f02702fe01a6fe414c0b49cb8a673d205".slice(0, SW.UPSTREAM_COMMIT.length)));
  assert.equal(SW.CONTENT_HASH, contentHash(SW.CONTENT_FILES), "content changed: set CONTENT_HASH to " + contentHash(SW.CONTENT_FILES));
});

test("the manifest is complete and points at real files", () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, "site/manifest.json"), "utf8"));
  assert.ok(m.name && m.short_name && m.start_url && m.display === "standalone");
  assert.ok(m.icons.length >= 2);
  m.icons.forEach((i) => { assert.ok(i.sizes && i.type); assert.ok(fs.existsSync(path.join(ROOT, "site", i.src)), i.src); assert.ok(SW.SHELL_FILES.includes(i.src), i.src); });
  assert.ok(fs.existsSync(path.join(ROOT, "site", m.start_url)));
});

test("the service worker is registered only on https or localhost", () => {
  const src = fs.readFileSync(path.join(ROOT, "site/pwa.js"), "utf8");
  assert.match(src, /https:/);
  assert.match(src, /localhost/);
  assert.match(src, /register\("sw\.js"\)/);
});
