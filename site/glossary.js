/* Glossary: an A to Z search page over data/saa-c03/glossary.json.
 * Every entry is a bold term plus the guide's own introducing sentence, quoted
 * as the guide wrote it, with a link to the guide section. Nothing is defined
 * here. Adapted from RonitSachdev/aws-saa-c03-guides (CC BY 4.0).
 * Pure logic is exported for node --test (module.exports) and the browser
 * (window.Glossary). The UI mounts itself on #/glossary when a DOM exists. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Glossary = factory(root);
})(typeof self !== "undefined" ? self : this, function (win) {
  "use strict";

  var MAX_SHOWN = 400;

  /** Show a sentence without its markdown emphasis marks; the words are untouched. */
  function plain(text) { return String(text).replace(/[*`]/g, ""); }

  /** The letter an entry files under: A to Z, or "#" for anything else. */
  function letterOf(term) {
    var c = String(term).replace(/^[^A-Za-z0-9]+/, "").charAt(0).toUpperCase();
    return /[A-Z]/.test(c) ? c : "#";
  }

  /** Entries grouped by letter, in A to Z order with "#" last. Empty letters are left out. */
  function groupByLetter(entries) {
    var map = {};
    entries.forEach(function (e) { (map[letterOf(e.term)] = map[letterOf(e.term)] || []).push(e); });
    return Object.keys(map).sort(function (a, b) {
      if (a === "#") return 1;
      if (b === "#") return -1;
      return a < b ? -1 : 1;
    }).map(function (l) { return { letter: l, entries: map[l] }; });
  }

  function guideNumber(guide) {
    var m = /\/(\d\d)-[^/]+\.md$/.exec(String(guide));
    return m ? m[1] : "";
  }

  function link(entry) {
    return "#/learn/" + encodeURI(entry.guide) + (entry.section_slug ? "#" + entry.section_slug : "");
  }

  /** Terms that start with the query first, then terms that contain it, then sentences that contain it. */
  function search(entries, query) {
    var q = String(query || "").trim().toLowerCase();
    if (!q) return entries.slice();
    var starts = [], inTerm = [], inText = [];
    entries.forEach(function (e) {
      var t = e.term.toLowerCase();
      if (t.indexOf(q) === 0) starts.push(e);
      else if (t.indexOf(q) >= 0) inTerm.push(e);
      else if (plain(e.sentence).toLowerCase().indexOf(q) >= 0) inText.push(e);
    });
    return starts.concat(inTerm, inText);
  }

  /** Only the shape the page relies on; anything else means the data file is wrong. */
  function validEntries(doc) {
    if (!doc || !Array.isArray(doc.entries)) return null;
    for (var i = 0; i < doc.entries.length; i++) {
      var e = doc.entries[i];
      if (!e || typeof e.term !== "string" || typeof e.sentence !== "string" || typeof e.guide !== "string" ||
          typeof e.line !== "number" || !e.term || !e.sentence) return null;
    }
    return doc.entries;
  }

  var api = {
    MAX_SHOWN: MAX_SHOWN, plain: plain, letterOf: letterOf, groupByLetter: groupByLetter,
    guideNumber: guideNumber, link: link, search: search, validEntries: validEntries,
  };

  /* ---------------- browser UI (skipped under node) ---------------- */
  if (win && win.document && win.ReaderLogic) mount(win, api);
  return api;

  function mount(w, A) {
    var doc = w.document, main = doc.getElementById("main");
    var entries = null, failed = false, query = "", letter = "", observer = null;

    function el(tag, attrs, kids) {
      var n = doc.createElement(tag);
      Object.keys(attrs || {}).forEach(function (k) {
        if (k === "text") n.textContent = attrs[k]; else if (k === "class") n.className = attrs[k]; else n.setAttribute(k, attrs[k]);
      });
      (kids || []).forEach(function (c) { n.appendChild(c); });
      return n;
    }
    function active() { return /^#\/glossary(\/|$|#)/.test(w.location.hash || ""); }
    function load() {
      if (entries || failed) return Promise.resolve(entries);
      return fetch("../data/saa-c03/glossary.json").then(function (r) {
        if (!r.ok) throw new Error("glossary.json " + r.status);
        return r.json();
      }).then(function (d) {
        entries = A.validEntries(d);
        if (!entries) failed = true;
        return entries;
      }, function () { failed = true; return null; });
    }

    function entryNode(e) {
      var num = A.guideNumber(e.guide);
      return el("li", { class: "gl-entry" }, [
        el("strong", { class: "gl-term", text: e.term }),
        el("p", { class: "gl-def", text: A.plain(e.sentence) }),
        el("p", { class: "muted gl-src" }, [
          el("a", { href: A.link(e), text: "Guide " + num + (e.section ? ", " + e.section : "") }),
          doc.createTextNode(" · line " + e.line + " · candidate, unverified"),
        ]),
      ]);
    }

    function results() {
      var list = A.search(entries, query);
      if (letter) list = list.filter(function (e) { return A.letterOf(e.term) === letter; });
      var shown = list.slice(0, A.MAX_SHOWN);
      var box = el("div", { id: "gl-results", "aria-live": "polite" });
      box.appendChild(el("p", { class: "muted", text: list.length + (list.length === 1 ? " entry" : " entries") +
        (list.length > shown.length ? ", showing the first " + shown.length + ". Type more to narrow it." : ".") }));
      if (!query && !letter) {
        A.groupByLetter(shown).forEach(function (g) {
          box.appendChild(el("h2", { class: "gl-letter", id: "gl-" + (g.letter === "#" ? "other" : g.letter), text: g.letter }));
          var ul = el("ul", { class: "gl-list" });
          g.entries.forEach(function (e) { ul.appendChild(entryNode(e)); });
          box.appendChild(ul);
        });
      } else {
        var ul2 = el("ul", { class: "gl-list" });
        shown.forEach(function (e) { ul2.appendChild(entryNode(e)); });
        box.appendChild(ul2);
      }
      return box;
    }

    function render() {
      if (!active() || !main) return;
      if (observer) observer.disconnect();
      var h = el("h1", { text: "Glossary" });
      var wrap = el("div", { class: "gl" }, [h]);
      if (failed || !entries) {
        wrap.appendChild(el("p", { class: "notice", role: "alert", text: failed ? "The glossary could not be loaded." : "Loading the glossary…" }));
      } else {
        wrap.appendChild(el("p", { class: "muted", text: "Each entry is a term in bold in the guides, with the guide's own sentence that introduces it, unchanged. Terms with no such sentence are not listed." }));
        var label = el("label", { for: "gl-q", text: "Search terms and sentences" });
        var input = el("input", { id: "gl-q", type: "search", autocomplete: "off", value: query });
        input.value = query;
        var nav = el("nav", { "aria-label": "Jump to letter", class: "gl-az" });
        var all = el("button", { type: "button", class: "btn ghost", text: "All", "aria-pressed": letter ? "false" : "true" });
        all.addEventListener("click", function () { letter = ""; render(); });
        nav.appendChild(all);
        var present = {};
        entries.forEach(function (e) { present[A.letterOf(e.term)] = true; });
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("").forEach(function (l) {
          if (!present[l]) return;
          var b = el("button", { type: "button", class: "btn ghost", text: l, "aria-pressed": letter === l ? "true" : "false", "aria-label": "Terms starting with " + (l === "#" ? "a digit or symbol" : l) });
          b.addEventListener("click", function () { letter = letter === l ? "" : l; render(); });
          nav.appendChild(b);
        });
        wrap.appendChild(el("div", { class: "panel" }, [label, input, nav]));
        var holder = el("div", { id: "gl-holder" }, [results()]);
        wrap.appendChild(holder);
        input.addEventListener("input", function () {
          query = input.value;
          holder.replaceChild(results(), holder.firstChild);
        });
        wrap.appendChild(el("p", { class: "muted" }, [
          doc.createTextNode("Terms and sentences adapted from "),
          el("a", { href: "https://github.com/RonitSachdev/aws-saa-c03-guides", text: "aws-saa-c03-guides" }),
          doc.createTextNode(" by RonitSachdev, CC BY 4.0."),
        ]));
      }
      main.textContent = "";
      main.appendChild(wrap);
      watch();
    }
    function watch() {
      if (!w.MutationObserver || !main) return;
      observer = new w.MutationObserver(function () {
        if (active() && !doc.querySelector(".gl")) { observer.disconnect(); setTimeout(render, 0); }
      });
      observer.observe(main, { childList: true });
    }
    function go() {
      if (!active()) { if (observer) observer.disconnect(); return; }
      setTimeout(function () {
        if (!active()) return;
        render();
        load().then(function () { if (active()) render(); });
      }, 0);
    }
    w.addEventListener("hashchange", go);
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", go); else go();
  }
});
