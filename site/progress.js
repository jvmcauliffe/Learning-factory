/* Progress dashboard: readiness per guide and topic group from lesson reads,
 * flashcard boxes, drill results and practice-exam scores, the weakest five
 * guides with a next activity each, and export / import of progress as JSON.
 * Everything stays in this browser's localStorage; nothing is sent anywhere.
 * Pure logic is exported for node --test (module.exports) and the browser
 * (window.Progress). The UI mounts itself on #/progress when a DOM exists.
 *
 * Exam scores: exam.js keeps a session in memory only. This file records a
 * submitted exam's per-guide result in its own key by wrapping Exam.score,
 * which exam.js calls through its exported object when it shows the result. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Progress = factory(root);
})(typeof self !== "undefined" ? self : this, function (win) {
  "use strict";

  var KEYS = {
    lessons: "lf.saa-c03.progress.v1",
    flashcards: "lf.saa-c03.flashcards.v1",
    drills: "lf.saa-c03.drills.v1",
    exams: "lf.saa-c03.exam-results.v1",
  };
  var FORMAT = "lf-saa-c03-progress";
  var VERSION = 1;
  var WEIGHTS = { lessons: 0.3, flashcards: 0.25, drills: 0.25, exam: 0.2 };
  var KIND_ORDER = ["lessons", "flashcards", "drills", "exam"];
  var EXAM_RECENT = 3; // attempts counted per guide
  var EXAM_KEEP = 20; // attempts stored
  var WEAKEST = 5;
  var MAX_IMPORT_BYTES = 2 * 1024 * 1024;

  function isObj(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }
  function pct(x) { return Math.round(100 * x); }

  /* ---------------- snapshot: the four stored sections ---------------- */

  function emptySnapshot() {
    return { lessons: {}, flashcards: {}, drills: { seen: {}, pending: {} }, exams: [] };
  }

  /* Each cleaner returns the section if it is well formed, or null if not. Used strictly on import. */
  function cleanLessons(d) {
    if (!isObj(d)) return null;
    var out = {};
    for (var file in d) {
      var e = d[file];
      if (!isObj(e) || !isObj(e.done) || !(Number.isInteger(e.total) && e.total >= 0)) return null;
      var done = {};
      for (var slug in e.done) { if (e.done[slug] !== 1) return null; done[slug] = 1; }
      out[file] = { total: e.total, done: done };
    }
    return out;
  }
  function cleanFlashcards(d) {
    if (!isObj(d)) return null;
    var out = {};
    for (var id in d) {
      var s = d[id];
      if (!isObj(s) || !Number.isInteger(s.box) || s.box < 1 || s.box > 5 || typeof s.due !== "number" || !isFinite(s.due)) return null;
      out[id] = { box: s.box, due: s.due };
    }
    return out;
  }
  function cleanDrills(d) {
    if (!isObj(d) || !isObj(d.seen) || !isObj(d.pending)) return null;
    var out = { seen: {}, pending: {} }, id;
    for (id in d.seen) { if (d.seen[id] !== 1) return null; out.seen[id] = 1; }
    for (id in d.pending) {
      if (d.pending[id] !== "wrong" && d.pending[id] !== "partly") return null;
      out.pending[id] = d.pending[id];
    }
    return out;
  }
  function cleanExams(d) {
    if (!Array.isArray(d) || d.length > EXAM_KEEP) return null;
    var out = [], ids = {};
    for (var i = 0; i < d.length; i++) {
      var r = d[i];
      if (!isObj(r) || typeof r.id !== "string" || !r.id || ids[r.id] || typeof r.at !== "number" || !isFinite(r.at) || !isObj(r.perGuide)) return null;
      ids[r.id] = true;
      var pg = {};
      for (var g in r.perGuide) {
        var c = r.perGuide[g];
        if (!isObj(c) || !Number.isInteger(c.correct) || !Number.isInteger(c.total) || c.total < 1 || c.correct < 0 || c.correct > c.total) return null;
        pg[g] = { correct: c.correct, total: c.total };
      }
      out.push({ id: r.id, at: r.at, perGuide: pg });
    }
    return out;
  }
  var CLEANERS = { lessons: cleanLessons, flashcards: cleanFlashcards, drills: cleanDrills, exams: cleanExams };

  /** Read all four sections; a missing, blocked or corrupt one reads as empty. Never throws. */
  function readSnapshot(storage) {
    var snap = emptySnapshot();
    Object.keys(CLEANERS).forEach(function (k) {
      try {
        var raw = storage && storage.getItem(KEYS[k]);
        if (!raw) return;
        var clean = CLEANERS[k](JSON.parse(raw));
        if (clean) snap[k] = clean;
      } catch (e) { /* leave empty */ }
    });
    return snap;
  }
  /** Write all four sections. Returns true only if every write succeeded. */
  function writeSnapshot(storage, snap) {
    if (!storage) return false;
    try {
      Object.keys(KEYS).forEach(function (k) { storage.setItem(KEYS[k], JSON.stringify(snap[k])); });
      return true;
    } catch (e) { return false; }
  }

  /* ---------------- model: what there is to learn, per guide ---------------- */

  /** Guides in syllabus order with the number of cards and drills each owns. */
  function buildModel(bank, syllabus) {
    var guides = [], index = {};
    (syllabus.groups || []).forEach(function (g) {
      (g.guides || []).forEach(function (x) {
        index[x.file] = guides.length;
        guides.push({ file: x.file, title: x.title, number: x.guide_number, group: g.name, cards: 0, drills: 0 });
      });
    });
    (bank.items || []).forEach(function (it) {
      var i = index[it.guide];
      if (i === undefined) return;
      if (it.type === "pocket_card") guides[i].cards += 1;
      else if (it.type === "question_pattern") guides[i].drills += 1;
    });
    return { guides: guides, groups: (syllabus.groups || []).map(function (g) { return g.name; }),
             cardIds: idsByGuide(bank, "pocket_card"), drillIds: idsByGuide(bank, "question_pattern") };
  }
  function idsByGuide(bank, type) {
    var out = {};
    (bank.items || []).forEach(function (it) {
      if (it.type !== type) return;
      (out[it.guide] = out[it.guide] || []).push(it.id);
    });
    return out;
  }

  /* ---------------- scoring ---------------- */

  function lessonScore(snap, guide) {
    var e = snap.lessons[guide.file];
    var total = e ? e.total : 0, done = e ? Object.keys(e.done).length : 0;
    // A guide not yet opened has no known section count: it is unread.
    if (!total) return { score: 0, detail: "not opened yet" };
    var d = Math.min(done, total);
    return { score: d / total, detail: d + " of " + total + " sections read" };
  }
  function cardScore(model, snap, guide) {
    var ids = model.cardIds[guide.file] || [];
    if (!ids.length) return null;
    var sum = 0, seen = 0;
    ids.forEach(function (id) {
      var s = snap.flashcards[id];
      if (s) { seen += 1; sum += s.box / 5; }
    });
    return { score: sum / ids.length, detail: seen + " of " + ids.length + " cards started, box average counted" };
  }
  function drillScore(model, snap, guide) {
    var ids = model.drillIds[guide.file] || [];
    if (!ids.length) return null;
    var sum = 0, seen = 0, owed = 0;
    ids.forEach(function (id) {
      var p = snap.drills.pending[id];
      if (p === "wrong") { seen += 1; owed += 1; }
      else if (p === "partly") { seen += 1; owed += 1; sum += 0.5; }
      else if (snap.drills.seen[id]) { seen += 1; sum += 1; }
    });
    return { score: sum / ids.length, detail: seen + " of " + ids.length + " drills seen, " + owed + " to revisit" };
  }
  function examScore(snap, guide) {
    var recent = snap.exams.filter(function (r) { return r.perGuide[guide.file]; })
      .sort(function (a, b) { return b.at - a.at; }).slice(0, EXAM_RECENT);
    if (!recent.length) return null;
    var c = 0, t = 0;
    recent.forEach(function (r) { c += r.perGuide[guide.file].correct; t += r.perGuide[guide.file].total; });
    return { score: c / t, detail: c + " of " + t + " exam questions right (last " + recent.length + " exam" + (recent.length === 1 ? "" : "s") + ")" };
  }

  /** Next activity for a guide: the weakest component, ties going to lessons first. */
  function nextStep(guide, comps) {
    var best = null;
    KIND_ORDER.forEach(function (k) {
      var c = comps[k];
      if (c && (best === null || c.score < comps[best].score)) best = k;
    });
    var enc = encodeURI(guide.file);
    var steps = {
      lessons: { label: "Read the lesson", href: "#/learn/" + enc },
      flashcards: { label: "Review flashcards for this guide", href: "#/flashcards" },
      drills: { label: "Practise scenario drills for this guide", href: "#/drills" },
      exam: { label: "Take a practice exam and revisit this guide's lesson", href: "#/exam" },
    };
    return { kind: best, label: steps[best].label, href: steps[best].href, reason: comps[best].detail };
  }

  /**
   * The dashboard: readiness 0 to 1 per guide as the weighted mean of the
   * components that exist for that guide, group means, overall mean, and the
   * weakest five guides with a next step. Same inputs always give the same output.
   */
  function computeDashboard(model, snap) {
    var guides = model.guides.map(function (g, order) {
      var comps = { lessons: lessonScore(snap, g), flashcards: cardScore(model, snap, g), drills: drillScore(model, snap, g), exam: examScore(snap, g) };
      var wsum = 0, sum = 0;
      KIND_ORDER.forEach(function (k) { if (comps[k]) { wsum += WEIGHTS[k]; sum += WEIGHTS[k] * comps[k].score; } });
      return { file: g.file, title: g.title, number: g.number, group: g.group, order: order, components: comps,
               readiness: wsum ? sum / wsum : 0, next: nextStep(g, comps) };
    });
    var groups = model.groups.map(function (name) {
      var gs = guides.filter(function (g) { return g.group === name; });
      var avg = gs.length ? gs.reduce(function (a, g) { return a + g.readiness; }, 0) / gs.length : 0;
      return { name: name, guides: gs.length, readiness: avg };
    });
    var overall = guides.length ? guides.reduce(function (a, g) { return a + g.readiness; }, 0) / guides.length : 0;
    var weakest = guides.slice().sort(function (a, b) { return a.readiness - b.readiness || a.order - b.order; }).slice(0, WEAKEST);
    return { guides: guides, groups: groups, overall: overall, weakest: weakest };
  }

  /* ---------------- exam results ---------------- */

  /** Per-guide result of a submitted session. byId maps question id to {guide, correct}. Unanswered counts as wrong. */
  function examResultFromSession(session, byId) {
    if (!session || !session.submitted) return null;
    var perGuide = {};
    session.order.forEach(function (id) {
      var q = byId[id];
      if (!q) return;
      var c = perGuide[q.guide] || (perGuide[q.guide] = { correct: 0, total: 0 });
      c.total += 1;
      if (session.answers[id] === q.correct) c.correct += 1;
    });
    if (!Object.keys(perGuide).length) return null;
    return { id: String(session.startMs), at: typeof session.endMs === "number" ? session.endMs : session.startMs, perGuide: perGuide };
  }
  /** Add a result once; the same exam seen again changes nothing. Keeps the newest EXAM_KEEP. */
  function addExamResult(exams, result) {
    if (!result || exams.some(function (r) { return r.id === result.id; })) return exams;
    return exams.concat([result]).sort(function (a, b) { return a.at - b.at; }).slice(-EXAM_KEEP);
  }

  /* ---------------- export and import ---------------- */

  function buildExport(snap, nowIso) {
    return { format: FORMAT, version: VERSION, exportedAt: nowIso,
             data: { lessons: snap.lessons, flashcards: snap.flashcards, drills: snap.drills, exams: snap.exams } };
  }
  function serialize(snap, nowIso) { return JSON.stringify(buildExport(snap, nowIso), null, 2); }

  /** Validate a file's text. Returns {ok:true, snapshot} or {ok:false, error}. Nothing is repaired: a bad file is rejected whole. */
  function parseImport(text) {
    if (typeof text !== "string" || !text.trim()) return { ok: false, error: "The file is empty." };
    if (text.length > MAX_IMPORT_BYTES) return { ok: false, error: "The file is too large to be a progress export." };
    var doc;
    try { doc = JSON.parse(text); } catch (e) { return { ok: false, error: "The file is not valid JSON." }; }
    if (!isObj(doc) || doc.format !== FORMAT) return { ok: false, error: "This is not a progress export from this site." };
    if (doc.version !== VERSION) {
      return { ok: false, error: "Unsupported version " + String(doc.version) + ". This site reads version " + VERSION + "." };
    }
    if (!isObj(doc.data)) return { ok: false, error: "The file has no data section." };
    var snap = {};
    for (var i = 0; i < Object.keys(CLEANERS).length; i++) {
      var k = Object.keys(CLEANERS)[i];
      if (!(k in doc.data)) return { ok: false, error: "The file is missing the " + k + " section." };
      var clean = CLEANERS[k](doc.data[k]);
      if (clean === null) return { ok: false, error: "The " + k + " section is not in the expected form." };
      snap[k] = clean;
    }
    return { ok: true, snapshot: snap };
  }

  var api = {
    KEYS: KEYS, FORMAT: FORMAT, VERSION: VERSION, WEIGHTS: WEIGHTS, EXAM_RECENT: EXAM_RECENT, EXAM_KEEP: EXAM_KEEP, WEAKEST: WEAKEST,
    emptySnapshot: emptySnapshot, readSnapshot: readSnapshot, writeSnapshot: writeSnapshot,
    buildModel: buildModel, computeDashboard: computeDashboard, pct: pct,
    examResultFromSession: examResultFromSession, addExamResult: addExamResult,
    buildExport: buildExport, serialize: serialize, parseImport: parseImport,
  };

  /* ---------------- browser UI (skipped under node) ---------------- */
  if (win && win.document && win.ReaderLogic) mount(win, api);
  return api;

  function mount(w, A) {
    var doc = w.document, R = w.ReaderLogic, main = doc.getElementById("main");
    var storage = null;
    try { storage = w.localStorage; } catch (e) { storage = null; }
    var model = null, observer = null, message = null;

    function el(tag, attrs, kids) {
      var n = doc.createElement(tag);
      Object.keys(attrs || {}).forEach(function (k) {
        if (k === "text") n.textContent = attrs[k]; else if (k === "class") n.className = attrs[k]; else n.setAttribute(k, attrs[k]);
      });
      (kids || []).forEach(function (c) { n.appendChild(c); });
      return n;
    }
    function onRoute() { return R.parseRoute(w.location.hash).view === "progress"; }
    function jget(url) {
      return fetch(url).then(function (r) { if (!r.ok) throw new Error(url.split("/").pop() + " " + r.status); return r.json(); });
    }
    function load() {
      if (model) return Promise.resolve(model);
      return Promise.all([jget("../data/saa-c03/bank.json"), jget("../data/saa-c03/syllabus.json")]).then(function (v) {
        model = A.buildModel(v[0], v[1]);
        return model;
      });
    }

    /* Record each submitted exam's per-guide result. exam.js calls A.score(session, byId) on its result page. */
    function hookExam() {
      var E = w.Exam;
      if (!E || typeof E.score !== "function" || E.score.__lfProgress) return;
      var original = E.score;
      var wrapped = function (session, byId) {
        var out = original.apply(this, arguments);
        try {
          var result = A.examResultFromSession(session, byId);
          if (result && storage) {
            var snap = A.readSnapshot(storage);
            var next = A.addExamResult(snap.exams, result);
            if (next !== snap.exams) storage.setItem(A.KEYS.exams, JSON.stringify(next));
          }
        } catch (e) { /* recording must never break the exam result page */ }
        return out;
      };
      wrapped.__lfProgress = true;
      E.score = wrapped;
    }

    function bar(fraction, label) {
      var p = A.pct(fraction);
      var wrap = el("div", { class: "pg-bar", role: "img", "aria-label": label + ": " + p + " percent" });
      var fill = el("div", { class: "pg-fill" });
      fill.style.width = p + "%";
      wrap.appendChild(fill);
      return wrap;
    }
    function download(text, name) {
      var url = w.URL.createObjectURL(new w.Blob([text], { type: "application/json" }));
      var a = el("a", { href: url, download: name });
      doc.body.appendChild(a); a.click(); doc.body.removeChild(a);
      w.setTimeout(function () { w.URL.revokeObjectURL(url); }, 1000);
    }

    function render() {
      var snap = A.readSnapshot(storage);
      var dash = A.computeDashboard(model, snap);
      while (main.firstChild) main.removeChild(main.firstChild);
      doc.title = "Progress · SAA-C03 Study Site";
      main.appendChild(el("h1", { text: "Progress" }));
      if (!storage) main.appendChild(el("p", { class: "notice", text: "Your browser is blocking storage, so there is no saved progress to show." }));
      main.appendChild(el("div", { class: "panel" }, [
        el("p", { class: "pg-big", text: "Overall readiness: " + A.pct(dash.overall) + "%" }),
        bar(dash.overall, "Overall readiness"),
        el("p", { class: "muted", text: "A self-check from your own activity in this browser: lessons read, flashcard boxes, drills and practice exams. It is not a prediction of the real exam. Exam questions are candidates." }),
      ]));

      main.appendChild(el("h2", { text: "Weakest five guides" }));
      var ol = el("ol", { class: "pg-weak" });
      dash.weakest.forEach(function (g) {
        ol.appendChild(el("li", {}, [
          el("strong", { text: g.number + ". " + g.title + ": " + A.pct(g.readiness) + "%" }),
          el("br"),
          el("a", { href: g.next.href, text: g.next.label }),
          el("span", { class: "muted", text: " (" + g.next.reason + ")" }),
        ]));
      });
      main.appendChild(ol);

      main.appendChild(el("h2", { text: "By topic group" }));
      var gl = el("ul", { class: "pg-list" });
      dash.groups.forEach(function (g) {
        gl.appendChild(el("li", {}, [el("span", { text: g.name + ": " + A.pct(g.readiness) + "% (" + g.guides + " guides)" }), bar(g.readiness, g.name)]));
      });
      main.appendChild(gl);

      main.appendChild(el("h2", { text: "By guide" }));
      var table = el("table", { class: "pg-table" }, [el("caption", { class: "sr-only", text: "Readiness by guide" })]);
      var head = el("tr");
      ["Guide", "Lessons", "Flashcards", "Drills", "Exam", "Readiness"].forEach(function (h) { head.appendChild(el("th", { scope: "col", text: h })); });
      table.appendChild(el("thead", {}, [head]));
      var body = el("tbody");
      dash.guides.forEach(function (g) {
        var tr = el("tr", {}, [el("th", { scope: "row" }, [el("a", { href: "#/learn/" + encodeURI(g.file), text: g.number + ". " + g.title })])]);
        KIND_ORDER.forEach(function (k) {
          var c = g.components[k];
          var td = el("td", { text: c ? A.pct(c.score) + "%" : "none" });
          if (c) td.setAttribute("title", c.detail);
          tr.appendChild(td);
        });
        tr.appendChild(el("td", { text: A.pct(g.readiness) + "%" }));
        body.appendChild(tr);
      });
      table.appendChild(body);
      main.appendChild(el("div", { class: "pg-scroll" }, [table]));

      main.appendChild(el("h2", { text: "Back up or move your progress" }));
      var panel = el("div", { class: "panel" });
      panel.appendChild(el("p", { text: "Download a file with your lessons, flashcards, drills and exam results, or restore one. Restoring replaces the progress in this browser." }));
      var exp = el("button", { type: "button", class: "btn", id: "pg-export", text: "Download progress" });
      exp.addEventListener("click", function () {
        download(A.serialize(A.readSnapshot(storage), new Date().toISOString()), "saa-c03-progress.json");
        message = { ok: true, text: "Progress downloaded." }; showMessage();
      });
      panel.appendChild(exp);
      panel.appendChild(el("p", {}, [el("label", { for: "pg-file", text: "Restore from a file " }),
        el("input", { type: "file", id: "pg-file", accept: "application/json,.json" })]));
      panel.appendChild(el("p", { id: "pg-msg", role: "status", "aria-live": "polite" }));
      main.appendChild(panel);
      showMessage();
      doc.getElementById("pg-file").addEventListener("change", onFile);
    }
    function showMessage() {
      var n = doc.getElementById("pg-msg");
      if (!n) return;
      n.textContent = message ? message.text : "";
      n.className = message && !message.ok ? "notice" : "";
    }
    function onFile(ev) {
      var f = ev.target.files && ev.target.files[0];
      if (!f) return;
      if (f.size > MAX_IMPORT_BYTES) { message = { ok: false, text: "The file is too large to be a progress export." }; showMessage(); return; }
      f.text().then(function (text) {
        var res = A.parseImport(text);
        if (!res.ok) { message = { ok: false, text: "Not restored. " + res.error }; showMessage(); return; }
        if (!A.writeSnapshot(storage, res.snapshot)) { message = { ok: false, text: "Not restored. Your browser would not save it." }; showMessage(); return; }
        message = { ok: true, text: "Progress restored. Reloading." }; showMessage();
        w.setTimeout(function () { w.location.reload(); }, 300);
      }, function () { message = { ok: false, text: "Not restored. The file could not be read." }; showMessage(); });
    }

    function paint() {
      if (!onRoute()) return Promise.resolve();
      return load().then(function () {
        if (!onRoute()) return;
        render();
      }, function (e) {
        while (main.firstChild) main.removeChild(main.firstChild);
        main.appendChild(el("h1", { text: "Progress" }));
        main.appendChild(el("p", { class: "notice", text: "The dashboard could not load (" + e.message + ")." }));
      });
    }
    function show() {
      if (observer) { observer.disconnect(); observer = null; }
      if (!onRoute()) return;
      message = null;
      // Hop one task so the shell's own "coming soon" render lands first, then replace it.
      w.setTimeout(function () {
        paint().then(function () {
          if (!onRoute()) return;
          observer = new w.MutationObserver(function () {
            if (onRoute() && !doc.querySelector(".pg-big")) {
              observer.disconnect(); paint().then(function () { if (observer) observer.observe(main, { childList: true }); });
            }
          });
          observer.observe(main, { childList: true });
        });
      }, 0);
    }
    hookExam();
    w.addEventListener("hashchange", show);
    show();
  }
});
