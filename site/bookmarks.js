/* Bookmarks for lesson sections, flashcards, drills and exam questions.
 * Stored in localStorage (always behind try/catch), listed on #/bookmarks, and
 * added to the progress export as a "bookmarks" section by wrapping the
 * Progress export functions at runtime (progress.js itself is unchanged).
 * Lesson text is adapted from RonitSachdev/aws-saa-c03-guides (CC BY 4.0).
 * Pure logic is exported for node --test (module.exports) and the browser
 * (window.Bookmarks). The UI mounts itself when a DOM exists. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Bookmarks = factory(root);
})(typeof self !== "undefined" ? self : this, function (win) {
  "use strict";

  var KEY = "lf.saa-c03.bookmarks.v1";
  var KINDS = ["lesson", "card", "drill", "question"];
  var KIND_LABEL = { lesson: "Lesson sections", card: "Flashcards", drill: "Drills", question: "Exam questions" };
  var MAX = 500;
  var MAX_TITLE = 300;

  function isObj(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }
  function str(x) { return typeof x === "string"; }

  function sectionSlug(text) {
    var s = String(text).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return s || "section";
  }

  /** Build one bookmark. Returns null when the pieces do not make a valid one. */
  function make(kind, ref, guide, title, anchor, nowMs) {
    var b = { id: kind + ":" + ref, kind: kind, ref: ref, guide: guide, title: String(title || "").trim().slice(0, MAX_TITLE), at: nowMs };
    if (anchor) b.anchor = anchor;
    return cleanOne(b) ? b : null;
  }

  function cleanOne(b) {
    if (!isObj(b)) return false;
    if (KINDS.indexOf(b.kind) < 0 || !str(b.ref) || !b.ref || !str(b.id) || b.id !== b.kind + ":" + b.ref) return false;
    if (!str(b.guide) || b.guide.indexOf("content/saa-c03/") !== 0) return false;
    if (!str(b.title) || !b.title || b.title.length > MAX_TITLE) return false;
    if (typeof b.at !== "number" || !isFinite(b.at)) return false;
    if ("anchor" in b && (!str(b.anchor) || !/^[a-z0-9-]+$/.test(b.anchor))) return false;
    return true;
  }

  /** Strict: the list, copied, or null if anything is malformed. Nothing is repaired. */
  function clean(list) {
    if (!Array.isArray(list) || list.length > MAX) return null;
    var seen = {}, out = [];
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (!cleanOne(b) || seen[b.id]) return null;
      seen[b.id] = 1;
      var copy = { id: b.id, kind: b.kind, ref: b.ref, guide: b.guide, title: b.title, at: b.at };
      if ("anchor" in b) copy.anchor = b.anchor;
      out.push(copy);
    }
    return out;
  }

  function has(list, id) { return list.some(function (b) { return b.id === id; }); }
  /** Add once; a bookmark already there changes nothing. A full list refuses. Returns the same array when nothing changed. */
  function add(list, bm) {
    if (!bm || has(list, bm.id) || list.length >= MAX) return list;
    return list.concat([bm]);
  }
  function remove(list, id) {
    return has(list, id) ? list.filter(function (b) { return b.id !== id; }) : list;
  }
  function toggle(list, bm) { return has(list, bm.id) ? remove(list, bm.id) : add(list, bm); }
  /** Newest first, ties by id, so the page order never wobbles. */
  function sorted(list) {
    return list.slice().sort(function (a, b) { return b.at - a.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); });
  }
  function grouped(list) {
    return KINDS.map(function (k) {
      return { kind: k, label: KIND_LABEL[k], items: sorted(list.filter(function (b) { return b.kind === k; })) };
    }).filter(function (g) { return g.items.length; });
  }
  function href(b) {
    return "#/learn/" + encodeURI(b.guide) + (b.anchor ? "#" + b.anchor : "");
  }

  /* ---------------- storage ---------------- */

  function read(storage) {
    try {
      var raw = storage && storage.getItem(KEY);
      if (!raw) return [];
      return clean(JSON.parse(raw)) || [];
    } catch (e) { return []; }
  }
  function write(storage, list) {
    try { if (!storage) return false; storage.setItem(KEY, JSON.stringify(list)); return true; } catch (e) { return false; }
  }

  /* ---------------- progress export ---------------- */

  /** Put the bookmarks into the progress export, and accept them back on import.
   * Wraps serialize, parseImport and writeSnapshot on the Progress API once. Files
   * without a bookmarks section still import and leave the bookmarks alone. */
  function install(P, storage) {
    if (!P || P.__lfBookmarks || typeof P.serialize !== "function" || typeof P.parseImport !== "function" || typeof P.writeSnapshot !== "function") return false;
    var serialize = P.serialize, parseImport = P.parseImport, writeSnapshot = P.writeSnapshot;
    P.serialize = function (snap, nowIso) {
      var doc = JSON.parse(serialize(snap, nowIso));
      doc.data.bookmarks = read(storage);
      return JSON.stringify(doc, null, 2);
    };
    P.parseImport = function (text) {
      var res = parseImport(text);
      if (!res.ok) return res;
      var doc = JSON.parse(text);
      if (isObj(doc.data) && "bookmarks" in doc.data) {
        var list = clean(doc.data.bookmarks);
        if (list === null) return { ok: false, error: "The bookmarks section is not in the expected form." };
        res.snapshot.bookmarks = list;
      }
      return res;
    };
    P.writeSnapshot = function (st, snap) {
      if (snap && Array.isArray(snap.bookmarks) && !write(st, snap.bookmarks)) return false;
      return writeSnapshot(st, snap);
    };
    P.__lfBookmarks = true;
    return true;
  }

  var api = {
    KEY: KEY, KINDS: KINDS, KIND_LABEL: KIND_LABEL, MAX: MAX, sectionSlug: sectionSlug,
    make: make, clean: clean, has: has, add: add, remove: remove, toggle: toggle, sorted: sorted, grouped: grouped, href: href,
    read: read, write: write, install: install,
  };

  /* ---------------- browser UI (skipped under node) ---------------- */
  if (win && win.document && win.ReaderLogic) mount(win, api);
  return api;

  function mount(w, A) {
    var doc = w.document, main = doc.getElementById("main");
    var storage = null;
    try { storage = w.localStorage; } catch (e) { storage = null; }
    if (w.Progress) A.install(w.Progress, storage);
    var data = null, finder = { kind: "card", q: "", pool: null, loading: false, error: "" };
    var observer = null;

    function el(tag, attrs, kids) {
      var n = doc.createElement(tag);
      Object.keys(attrs || {}).forEach(function (k) {
        if (k === "text") n.textContent = attrs[k]; else if (k === "class") n.className = attrs[k]; else n.setAttribute(k, attrs[k]);
      });
      (kids || []).forEach(function (c) { n.appendChild(c); });
      return n;
    }
    function route() { return String(w.location.hash || ""); }
    function onBookmarks() { return /^#\/bookmarks(\/|$|#)/.test(route()); }
    function lessonGuide() {
      var m = /^#\/learn\/([^#]+)/.exec(route());
      if (!m) return "";
      try { return decodeURI(m[1]); } catch (e) { return ""; }
    }
    function current() { return A.read(storage); }
    function save(list) { return A.write(storage, list); }

    /* ---- lesson section buttons ---- */
    function markButton(btn, on, title) {
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.textContent = on ? "★ Bookmarked" : "☆ Bookmark";
      btn.setAttribute("aria-label", (on ? "Remove bookmark: " : "Bookmark this section: ") + title);
    }
    function decorateLesson() {
      var guide = lessonGuide();
      if (!guide || !main) return;
      var heads = main.querySelectorAll("h2[id], h3[id]");
      Array.prototype.forEach.call(heads, function (h) {
        if (h.querySelector(".bm-btn")) return;
        var own = h.firstChild && h.firstChild.nodeType === 3 ? h.firstChild.textContent : h.textContent;
        var title = own.replace(/\s+/g, " ").trim();
        if (!title) return;
        var id = "lesson:" + guide + "#" + h.id;
        var btn = el("button", { type: "button", class: "btn ghost bm-btn" });
        markButton(btn, A.has(current(), id), title);
        btn.addEventListener("click", function () {
          var list = current();
          var next = A.toggle(list, A.make("lesson", guide + "#" + h.id, guide, title, h.id, Date.now()));
          if (next === list) { btn.setAttribute("title", "The bookmark list is full."); return; }
          if (!save(next)) { btn.setAttribute("title", "Your browser would not save this."); return; }
          markButton(btn, A.has(next, id), title);
        });
        h.appendChild(doc.createTextNode(" "));
        h.appendChild(btn);
      });
    }
    function watchLesson() {
      if (!w.MutationObserver || !main) return;
      new w.MutationObserver(function () { if (lessonGuide()) decorateLesson(); }).observe(main, { childList: true, subtree: true });
    }

    /* ---- bookmarks page ---- */
    function fetchJson(url) {
      return fetch(url).then(function (r) { if (!r.ok) throw new Error(url + " " + r.status); return r.json(); });
    }
    function loadPool(kind) {
      finder.loading = true; finder.error = "";
      var done = function (pool) { finder.pool = pool; finder.loading = false; if (onBookmarks()) render(); };
      var fail = function () { finder.loading = false; finder.error = "That list could not be loaded."; finder.pool = []; if (onBookmarks()) render(); };
      if (kind === "question") {
        fetchJson("../data/saa-c03/syllabus.json").then(function (syl) {
          var files = [];
          syl.groups.forEach(function (g) { g.guides.forEach(function (x) { files.push(x.file); }); });
          return Promise.all(files.map(function (f) {
            var base = f.split("/").pop().replace(/\.md$/, "");
            return fetchJson("../data/saa-c03/mcq/" + base + ".json").then(function (d) { return d.questions || []; }, function () { return []; });
          }));
        }).then(function (all) {
          var pool = [];
          all.forEach(function (qs) { qs.forEach(function (q) { pool.push({ kind: "question", ref: q.id, guide: q.guide, title: q.stem, anchor: "", text: q.stem }); }); });
          done(pool);
        }, fail);
        return;
      }
      fetchJson("../data/saa-c03/bank.json").then(function (bank) {
        var want = kind === "card" ? "pocket_card" : "question_pattern";
        var pool = bank.items.filter(function (i) { return i.type === want; }).map(function (i) {
          var title = kind === "card" ? i.keyword + " → " + i.answer : i.scenario;
          return { kind: kind, ref: i.id, guide: i.guide, title: title, anchor: A.sectionSlug(i.section), text: title };
        });
        done(pool);
      }, fail);
    }
    function ensurePool() { if (!finder.pool && !finder.loading) loadPool(finder.kind); }

    function listNode() {
      var list = current();
      var box = el("div", { id: "bm-list" });
      if (!list.length) { box.appendChild(el("p", { class: "muted", text: "No bookmarks yet. Use the Bookmark button on a lesson section, or find a flashcard, drill or question below." })); return box; }
      A.grouped(list).forEach(function (g) {
        box.appendChild(el("h2", { text: g.label }));
        var ul = el("ul", { class: "bm-items" });
        g.items.forEach(function (b) {
          var rm = el("button", { type: "button", class: "btn ghost", text: "Remove", "aria-label": "Remove bookmark: " + b.title });
          rm.addEventListener("click", function () { save(A.remove(current(), b.id)); render(); });
          ul.appendChild(el("li", {}, [el("a", { href: A.href(b), text: b.title }), doc.createTextNode(" "), rm]));
        });
        box.appendChild(ul);
      });
      return box;
    }
    function finderNode() {
      ensurePool();
      var panel = el("section", { class: "panel", "aria-labelledby": "bm-find-h" }, [el("h2", { id: "bm-find-h", text: "Find something to bookmark" })]);
      var sel = el("select", { id: "bm-kind" });
      [["card", "Flashcards"], ["drill", "Drills"], ["question", "Exam questions"]].forEach(function (o) {
        var opt = el("option", { value: o[0], text: o[1] });
        if (finder.kind === o[0]) opt.setAttribute("selected", "selected");
        sel.appendChild(opt);
      });
      sel.addEventListener("change", function () { finder.kind = sel.value; finder.pool = null; finder.q = ""; render(); });
      var q = el("input", { id: "bm-q", type: "search", autocomplete: "off" });
      q.value = finder.q;
      var holder = el("div", { id: "bm-results", "aria-live": "polite" });
      function fill() {
        holder.textContent = "";
        if (finder.error) { holder.appendChild(el("p", { class: "notice", role: "alert", text: finder.error })); return; }
        if (!finder.pool) { holder.appendChild(el("p", { class: "muted", text: "Loading…" })); return; }
        var needle = finder.q.trim().toLowerCase();
        var hits = finder.pool.filter(function (p) { return !needle || p.text.toLowerCase().indexOf(needle) >= 0; });
        holder.appendChild(el("p", { class: "muted", text: hits.length + " found" + (hits.length > 20 ? ", showing 20. Type to narrow it." : ".") }));
        var ul = el("ul", { class: "bm-items" });
        hits.slice(0, 20).forEach(function (p) {
          var id = p.kind + ":" + p.ref, on = A.has(current(), id);
          var b = el("button", { type: "button", class: "btn ghost", text: on ? "★ Bookmarked" : "☆ Bookmark", "aria-pressed": on ? "true" : "false", "aria-label": (on ? "Remove bookmark: " : "Bookmark: ") + p.title });
          b.addEventListener("click", function () {
            var next = A.toggle(current(), A.make(p.kind, p.ref, p.guide, p.title, p.anchor, Date.now()));
            if (save(next)) { var l = doc.getElementById("bm-list"); if (l) l.parentNode.replaceChild(listNode(), l); fill(); }
          });
          ul.appendChild(el("li", {}, [doc.createTextNode(p.title + " "), b]));
        });
        holder.appendChild(ul);
      }
      q.addEventListener("input", function () { finder.q = q.value; fill(); });
      fill();
      panel.appendChild(el("label", { for: "bm-kind", text: "Kind" }));
      panel.appendChild(sel);
      panel.appendChild(el("label", { for: "bm-q", text: "Search" }));
      panel.appendChild(q);
      panel.appendChild(holder);
      return panel;
    }
    function render() {
      if (!onBookmarks() || !main) return;
      if (observer) observer.disconnect();
      var wrap = el("div", { class: "bm" }, [
        el("h1", { text: "Bookmarks" }),
        el("p", { class: "muted", text: "Saved in this browser only. They are included when you export your progress and come back when you restore it." }),
        listNode(), finderNode(),
      ]);
      main.textContent = "";
      main.appendChild(wrap);
      if (w.MutationObserver) {
        observer = new w.MutationObserver(function () {
          if (onBookmarks() && !doc.querySelector(".bm")) { observer.disconnect(); setTimeout(render, 0); }
        });
        observer.observe(main, { childList: true });
      }
    }
    function go() {
      if (observer && !onBookmarks()) observer.disconnect();
      setTimeout(function () {
        if (onBookmarks()) render();
        else if (lessonGuide()) decorateLesson();
      }, 0);
    }
    watchLesson();
    w.addEventListener("hashchange", go);
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", go); else go();
  }
});
