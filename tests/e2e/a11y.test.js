"use strict";
/* axe-core (pinned in package.json) on every section, light and dark theme, at
 * phone and desktop width. Serious and critical issues fail the test. */
const test = require("node:test");
const assert = require("node:assert/strict");
const axePath = require.resolve("axe-core");
const { chromium, startServer, newContext, openSection, SECTIONS, WIDTHS } = require("./helpers.js");

let srv, browser;
test.before(async () => { srv = await startServer(); browser = await chromium.launch(); });
test.after(async () => { await browser.close(); await srv.close(); });

for (const scheme of ["light", "dark"]) {
  for (const [wname, size] of Object.entries(WIDTHS)) {
    for (const name of Object.keys(SECTIONS)) {
      test(`axe: ${name} (${wname}, ${scheme})`, async () => {
        const ctx = await newContext(browser, size, { colorScheme: scheme });
        const page = await ctx.newPage();
        try {
          await openSection(page, srv.base, name);
          await page.addScriptTag({ path: axePath });
          const result = await page.evaluate(() => axe.run(document));
          const bad = result.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
          assert.deepEqual(
            bad.map((v) => v.id + " [" + v.impact + "]: " + v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")),
            []);
        } finally { await ctx.close(); }
      });
    }
  }
}
