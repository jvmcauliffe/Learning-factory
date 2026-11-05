"use strict";
/* Smoke tests at phone and desktop width: open every section, complete one card, one drill
 * and a short exam, and use the keyboard alone. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { chromium, startServer, newContext, openSection, SECTIONS, WIDTHS } = require("./helpers.js");

let srv, browser;
test.before(async () => { srv = await startServer(); browser = await chromium.launch(); });
test.after(async () => { await browser.close(); await srv.close(); });

async function withPage(size, fn, opts) {
  const ctx = await newContext(browser, size, opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  try { await fn(page, errors); } finally { await ctx.close(); }
  assert.deepEqual(errors, [], "uncaught page errors");
}

for (const [wname, size] of Object.entries(WIDTHS)) {
  test(`every section opens (${wname})`, () => withPage(size, async (page) => {
    for (const name of Object.keys(SECTIONS)) {
      await openSection(page, srv.base, name);
      assert.ok(await page.locator("main h1, main h2").first().isVisible(), name);
    }
  }));

  test(`no sideways page scroll (${wname})`, () => withPage(size, async (page) => {
    for (const name of Object.keys(SECTIONS)) {
      await openSection(page, srv.base, name);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(over <= 1, name + " overflows by " + over + "px");
    }
  }));

  test(`complete one flashcard (${wname})`, () => withPage(size, async (page) => {
    await openSection(page, srv.base, "flashcards");
    const cue = await page.locator(".fc-card .fc-text").innerText();
    await page.locator(".fc-card").click();
    assert.equal(await page.locator(".fc-card .fc-label").textContent(), "Answer");
    await page.getByRole("button", { name: /Knew it/ }).click();
    await page.waitForFunction((c) => { const t = document.querySelector(".fc-card .fc-text"); return !t || t.textContent !== c; }, cue);
    const saved = await page.evaluate(() => Object.keys(localStorage).filter((k) => k === "lf.saa-c03.flashcards.v1"));
    assert.ok(saved.length >= 1, "card progress was saved");
  }));

  test(`complete one drill (${wname})`, () => withPage(size, async (page) => {
    await openSection(page, srv.base, "drills");
    const scenario = await page.locator("#dr-root .dr-scenario").first().innerText();
    await page.locator("#dr-answer").fill("A managed service, because it keeps the operations to a minimum.");
    await page.getByRole("button", { name: "Reveal answer" }).click();
    await page.locator(".dr-grade button").first().click();
    await page.waitForFunction((s) => { const n = document.querySelector("#dr-root .dr-scenario"); return !n || n.textContent !== s; }, scenario);
  }));

  test(`take a short exam (${wname})`, () => withPage(size, async (page) => {
    await openSection(page, srv.base, "exam");
    const box = page.locator("#ex-verified");
    if (await box.isChecked()) await box.uncheck();
    await page.locator("#ex-start").click();
    await page.waitForSelector(".ex-n");
    await page.locator("main input[type=radio], main input[type=checkbox]").first().check();
    const dots = page.locator(".ex-n");
    await dots.nth((await dots.count()) - 1).click();
    await page.getByRole("button", { name: "Review and submit" }).click();
    await page.getByRole("button", { name: "Submit exam now" }).click();
    await page.waitForSelector("#ex-results-h", { timeout: 10000 });
    assert.ok(await page.locator("#ex-results-h").isVisible());
  }));

  test(`lesson opens, a section can be ticked read (${wname})`, () => withPage(size, async (page) => {
    await openSection(page, srv.base, "lesson");
    const first = page.locator("article.lesson h2 input[type=checkbox]").first();
    await first.check();
    assert.ok(await first.isChecked());
    await page.reload();
    await page.waitForSelector("article.lesson h2[id]");
    assert.ok(await page.locator("article.lesson h2 input[type=checkbox]").first().isChecked(), "tick survives a reload");
  }));
}

test("keyboard only: skip link, navigation and a flashcard", () => withPage(WIDTHS.desktop, async (page) => {
  await openSection(page, srv.base, "home");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.className), "skip");
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => document.activeElement.id), "main");

  // Reach the Flashcards link with Tab alone and follow it with Enter.
  let reached = false;
  for (let i = 0; i < 20 && !reached; i++) {
    await page.keyboard.press("Tab");
    reached = await page.evaluate(() => document.activeElement.getAttribute("data-nav") === "flashcards");
  }
  if (!reached) { // focus moved on from main; start again from the top
    await page.evaluate(() => document.activeElement.blur());
    for (let i = 0; i < 20 && !reached; i++) {
      await page.keyboard.press("Tab");
      reached = await page.evaluate(() => document.activeElement.getAttribute("data-nav") === "flashcards");
    }
  }
  assert.ok(reached, "Flashcards link is reachable by Tab");
  await page.keyboard.press("Enter");
  await page.waitForSelector("#fc-root .fc-card");

  const card = page.locator(".fc-card");
  await card.focus();
  await page.keyboard.press("Space");
  assert.equal(await page.locator(".fc-card .fc-label").textContent(), "Answer");
  await page.getByRole("button", { name: /Knew it/ }).focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => { const l = document.querySelector(".fc-card .fc-label"); return !l || l.textContent === "Cue"; });
}));

test("keyboard only: start an exam and answer a question", () => withPage(WIDTHS.phone, async (page) => {
  await openSection(page, srv.base, "exam");
  const box = page.locator("#ex-verified");
  if (await box.isChecked()) await box.uncheck();
  await page.locator("#ex-start").focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector(".ex-n");
  const input = page.locator("main input[type=radio], main input[type=checkbox]").first();
  await input.focus();
  await page.keyboard.press("Space");
  assert.ok(await input.isChecked());
}));
