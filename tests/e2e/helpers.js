"use strict";
/* Shared helpers for the browser tests: a static server for the repository
 * root, a browser launcher, and a page opener that serves the pinned marked
 * 12.0.2 from node_modules in place of the CDN (same bytes, so the site's
 * integrity check still passes). */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..", "..");
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
};
const MARKED = path.join(__dirname, "node_modules", "marked", "marked.min.js");

const SECTIONS = {
  home: { hash: "#/", ready: ".panel a.btn" },
  learn: { hash: "#/learn", ready: "ul.lessons li a" },
  lesson: { hash: "#/learn/" + encodeURI("content/saa-c03/01-IAM.md"), ready: "article.lesson h2[id]" },
  flashcards: { hash: "#/flashcards", ready: "#fc-root .fc-card" },
  drills: { hash: "#/drills", ready: "#dr-root .dr-scenario" },
  exam: { hash: "#/exam", ready: "#ex-start" },
  technique: { hash: "#/technique", ready: "#tq-root" },
  progress: { hash: "#/progress", ready: ".pg-big" },
  glossary: { hash: "#/glossary", ready: ".gl-entry" },
  bookmarks: { hash: "#/bookmarks", ready: "#bm-results li" },
};
const WIDTHS = { phone: { width: 390, height: 800 }, desktop: { width: 1280, height: 900 } };

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    let file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
    if (!file.startsWith(ROOT) || /[\\/](node_modules|\.git)[\\/]/.test(file)) { res.writeHead(403); res.end("no"); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); res.end("not found"); return; }
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-cache" });
      res.end(buf);
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({
    server, base: "http://127.0.0.1:" + server.address().port,
    close: () => new Promise((r) => server.close(r)),
  })));
}

async function newContext(browser, size, opts) {
  const ctx = await browser.newContext(Object.assign({ viewport: size, acceptDownloads: true }, opts || {}));
  await ctx.route("**/cdnjs.cloudflare.com/**", (r) => r.fulfill({
    contentType: "application/javascript", headers: { "access-control-allow-origin": "*" }, body: fs.readFileSync(MARKED),
  }));
  return ctx;
}

async function openSection(page, base, name) {
  const s = SECTIONS[name];
  await page.goto(base + "/site/index.html" + s.hash);
  await page.waitForSelector(s.ready, { timeout: 10000 });
}

module.exports = { chromium, startServer, newContext, openSection, SECTIONS, WIDTHS, ROOT };
