"use strict";
/* After one visit the site must work with the network off, and a content change must
 * replace the old cache. The pinned marked build is served in place of the CDN. */
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = "1";
const test = require("node:test");
const assert = require("node:assert/strict");
const { chromium, startServer, newContext } = require("./helpers.js");
const SW = require("../../site/sw.js");

let srv, browser;
test.before(async () => { srv = await startServer(); browser = await chromium.launch(); });
test.after(async () => { await browser.close(); await srv.close(); });

async function firstVisit(ctx) {
  const page = await ctx.newPage();
  await page.goto(srv.base + "/site/index.html#/learn");
  await page.waitForSelector("ul.lessons li a");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
  return page;
}

test("the worker caches everything under a versioned name", async () => {
  const ctx = await newContext(browser, { width: 390, height: 800 });
  try {
    const page = await firstVisit(ctx);
    const cached = await page.evaluate(async () => {
      const names = await caches.keys();
      const out = {};
      for (const n of names) out[n] = (await (await caches.open(n)).keys()).map((r) => r.url);
      return out;
    });
    assert.deepEqual(Object.keys(cached), [SW.CACHE_NAME]);
    const urls = cached[SW.CACHE_NAME];
    SW.CONTENT_FILES.forEach((f) => assert.ok(urls.includes(srv.base + "/" + f), f));
    SW.SHELL_FILES.filter((f) => f !== "./").forEach((f) => assert.ok(urls.includes(srv.base + "/site/" + f), f));
    assert.ok(urls.includes(SW.MARKED_URL), "markdown library cached");
  } finally { await ctx.close(); }
});

test("every section and a lesson work offline after one visit", async () => {
  const ctx = await newContext(browser, { width: 1280, height: 900 });
  try {
    const page = await firstVisit(ctx);
    await ctx.setOffline(true);
    await page.reload();
    await page.waitForSelector("ul.lessons li a");
    const checks = [
      ["#/learn/" + encodeURI("content/saa-c03/01-IAM.md"), "article.lesson h2[id]"],
      ["#/flashcards", "#fc-root .fc-card"],
      ["#/drills", "#dr-root .dr-scenario"],
      ["#/exam", "#ex-start"],
      ["#/technique", "#tq-root"],
      ["#/progress", ".pg-big"],
      ["#/glossary", ".gl-entry"],
    ];
    for (const [hash, sel] of checks) {
      await page.evaluate((h) => { location.hash = h; }, hash);
      await page.waitForSelector(sel, { timeout: 10000 });
    }
    // A fresh navigation to a deep link also works offline.
    await page.goto(srv.base + "/site/index.html#/glossary");
    await page.waitForSelector(".gl-entry", { timeout: 10000 });
  } finally { await ctx.close(); }
});

test("the manifest is linked and parses", async () => {
  const ctx = await newContext(browser, { width: 390, height: 800 });
  try {
    const page = await ctx.newPage();
    await page.goto(srv.base + "/site/index.html");
    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    const res = await page.request.get(new URL(href, srv.base + "/site/index.html").href);
    assert.equal(res.status(), 200);
    assert.equal((await res.json()).display, "standalone");
  } finally { await ctx.close(); }
});
