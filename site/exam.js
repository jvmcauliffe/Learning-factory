/* Timed practice exam. Questions come from data/saa-c03/mcq/*.json, unedited.
 * The number of questions, the time limit and the domain weights come from
 * data/saa-c03/exam-facts.json. While ANY fact there is unverified, the draw falls
 * back to an even split across the four domains and a banner says so.
 * Pure logic is exported for node --test (module.exports) and the browser
 * (window.Exam). The UI mounts itself on #/exam when a DOM exists.
 * Questions are candidates until the owner verifies them; they carry a badge. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Exam = factory(root);
})(typeof self !== "undefined" ? self : this, function (win) {
  "use strict";

  var SETTINGS_KEY = "lf.saa-c03.exam.v1";
  var DOMAINS = ["domain-1", "domain-2", "domain-3", "domain-4"];
  var SCORE_NOTE_RAW = "This is a raw score, the share of questions answered correctly. It is not a prediction of whether you would pass.";

  /* ---------------- exam facts ---------------- */

  function factValue(facts, id) {
    var f = (facts.facts || []).filter(function (x) { return x.id === id; })[0];
    if (!f || !f.value) throw new Error("exam-facts.json has no fact '" + id + "'");
    return f;
  }

  /** Read the numbers the exam needs. Throws if a needed fact is missing rather than inventing one. */
  function readFacts(facts) {
    var weights = {}, unverified = [], sum = 0;
    DOMAINS.forEach(function (d) {
      var w = factValue(facts, d).value.weight_percent;
      if (typeof w !== "number" || !(w > 0)) throw new Error("exam-facts.json has no weight for " + d);
      weights[d] = w; sum += w;
    });
    var total = factValue(facts, "question-count").value.total;
    var minutes = factValue(facts, "time-limit").value.minutes;
    var pass = factValue(facts, "pass-mark").value;
    if (!(total > 0) || !(minutes > 0)) throw new Error("exam-facts.json has no usable question count or time limit");
    (facts.facts || []).forEach(function (f) { if (f.status !== "verified") unverified.push(f.id); });
    return {
      weights: weights, weightSum: sum, total: total, minutes: minutes,
      passMark: { scaled: pass.scaled_score, min: pass.scale_min, max: pass.scale_max },
      unverified: unverified, allVerified: unverified.length === 0,
    };
  }

  /** Text for the results screen. The numbers are shown as the facts file has them. */
  function passMarkNote(info) {
    var pm = info.passMark || {};
    var scale = pm.scaled ? "The real pass mark is a scaled score (" + pm.scaled + " on a scale of " + pm.min + " to " + pm.max +
      (info.allVerified ? "" : ", not yet verified") + "), not a percentage. " : "The real pass mark is a scaled score, not a percentage. ";
    return scale + SCORE_NOTE_RAW;
  }

  /* ---------------- drawing an exam ---------------- */

  /** mulberry32: a small seeded generator so tests can repeat a draw. */
  function seededRng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(list, rng) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /**
   * How many questions to take from each domain. Largest-remainder rounding, so each
   * count is within one question of total * weight / sum(weights); a domain with too
   * few questions gives its shortfall to the others, again by weight.
   */
  function allocate(avail, weights, total) {
    var plan = {}, wsum = 0;
    DOMAINS.forEach(function (d) { plan[d] = 0; wsum += weights[d]; });
    var capacity = DOMAINS.reduce(function (n, d) { return n + (avail[d] || 0); }, 0);
    var want = Math.min(total, capacity);
    var active = DOMAINS.slice();
    var left = want;
    while (left > 0 && active.length) {
      var asum = active.reduce(function (n, d) { return n + weights[d]; }, 0);
      var quotas = active.map(function (d, k) {
        var q = left * weights[d] / asum;
        return { d: d, base: Math.floor(q), frac: q - Math.floor(q), k: k };
      });
      var given = quotas.reduce(function (n, x) { return n + x.base; }, 0);
      quotas.slice().sort(function (a, b) { return b.frac - a.frac || a.k - b.k; })
        .slice(0, left - given).forEach(function (x) { x.base += 1; });
      var capped = false, used = 0;
      quotas.forEach(function (x) {
        var room = (avail[x.d] || 0) - plan[x.d];
        var take = Math.min(x.base, room);
        plan[x.d] += take; used += take;
        if (take < x.base) capped = true;
      });
      left -= used;
      if (!capped) break;
      active = active.filter(function (d) { return plan[d] < (avail[d] || 0); });
    }
    return plan;
  }

  function isVerified(q) { return q.status === "verified"; }

  /**
   * Draw an exam. opts.rng (default Math.random), opts.verifiedOnly.
   * Returns {ids, plan, mode: "weighted"|"even", size, requested, available}.
   */
  function drawExam(questions, info, opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random;
    var pool = questions.filter(function (q) { return DOMAINS.indexOf(q.domain) >= 0 && (!opts.verifiedOnly || isVerified(q)); });
    var byDomain = {}, avail = {};
    DOMAINS.forEach(function (d) { byDomain[d] = []; });
    pool.forEach(function (q) { byDomain[q.domain].push(q); });
    DOMAINS.forEach(function (d) { avail[d] = byDomain[d].length; });
    var mode = info.allVerified ? "weighted" : "even";
    var weights = {};
    DOMAINS.forEach(function (d) { weights[d] = mode === "weighted" ? info.weights[d] : 1; });
    var plan = allocate(avail, weights, info.total);
    var chosen = [];
    DOMAINS.forEach(function (d) { chosen = chosen.concat(shuffle(byDomain[d], rng).slice(0, plan[d])); });
    var ids = shuffle(chosen, rng).map(function (q) { return q.id; });
    return { ids: ids, plan: plan, mode: mode, size: ids.length, requested: info.total, available: avail };
  }

  /* ---------------- timer ---------------- */

  function remainingMs(session, now) {
    return Math.max(0, session.startMs + session.durationMs - now);
  }
  function isExpired(session, now) { return remainingMs(session, now) <= 0; }
  function formatClock(ms) {
    var s = Math.ceil(Math.max(0, ms) / 1000);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return h ? h + ":" + p(m) + ":" + p(r) : p(m) + ":" + p(r);
  }

  /* ---------------- session state (pure) ---------------- */

  function newSession(ids, durationMs, startMs) {
    return { order: ids.slice(), answers: {}, flags: {}, current: 0, startMs: startMs, durationMs: durationMs,
             submitted: false, endedBy: null, endMs: null };
  }
  function open(session, now) {
    return !session.submitted && (now === undefined || !isExpired(session, now));
  }
  function copy(session, patch) { return Object.assign({}, session, patch); }

  /** Record a choice. Ignored once the exam is submitted or time is up. */
  function setAnswer(session, id, choice, now) {
    if (!open(session, now) || session.order.indexOf(id) < 0) return session;
    var answers = Object.assign({}, session.answers);
    if (choice === null || choice === undefined) delete answers[id]; else answers[id] = choice;
    return copy(session, { answers: answers });
  }
  function toggleFlag(session, id, now) {
    if (!open(session, now) || session.order.indexOf(id) < 0) return session;
    var flags = Object.assign({}, session.flags);
    if (flags[id]) delete flags[id]; else flags[id] = true;
    return copy(session, { flags: flags });
  }
  function goTo(session, index) {
    if (index < 0 || index >= session.order.length) return session;
    return copy(session, { current: index });
  }
  /** reason is "user" or "time". Submitting twice keeps the first result. */
  function submit(session, now, reason) {
    if (session.submitted) return session;
    return copy(session, { submitted: true, endedBy: reason || "user", endMs: now });
  }
  /** Question numbers (1-based) still unanswered and flagged, for the submit check. */
  function reviewSummary(session) {
    var unanswered = [], flagged = [];
    session.order.forEach(function (id, i) {
      if (session.answers[id] === undefined) unanswered.push(i + 1);
      if (session.flags[id]) flagged.push(i + 1);
    });
    return { unanswered: unanswered, flagged: flagged };
  }

  /* ---------------- scoring ---------------- */

  /** Unanswered questions count as incorrect, as the exam-facts scoring note states. */
  function score(session, byId) {
    var byDomain = {}, correct = 0, unanswered = 0;
    DOMAINS.forEach(function (d) { byDomain[d] = { correct: 0, total: 0, unanswered: 0 }; });
    session.order.forEach(function (id) {
      var q = byId[id], b = byDomain[q.domain];
      b.total += 1;
      var a = session.answers[id];
      if (a === undefined) { b.unanswered += 1; unanswered += 1; }
      else if (a === q.correct) { b.correct += 1; correct += 1; }
    });
    var total = session.order.length;
    return { correct: correct, total: total, unanswered: unanswered, byDomain: byDomain,
             percent: total ? Math.round(1000 * correct / total) / 10 : 0 };
  }

  /* ---------------- questions and settings ---------------- */

  /** Join the question files into one list, keeping file order. Files that failed to load are null. */
  function flattenQuestions(files) {
    var out = [];
    files.forEach(function (f) { if (f && Array.isArray(f.questions)) out = out.concat(f.questions); });
    return out;
  }
  function guideLink(guide) { return "#/learn/" + encodeURI(guide); }

  function createStore(storage) {
    var memory = { verifiedOnly: false }, persistent = false;
    try {
      if (storage) {
        var raw = storage.getItem(SETTINGS_KEY);
        persistent = true;
        if (raw) { var d = JSON.parse(raw); memory = { verifiedOnly: !!(d && d.verifiedOnly) }; }
      }
    } catch (e) { memory = { verifiedOnly: false }; persistent = false; }
    return {
      get: function () { return memory; },
      set: function (s) {
        memory = { verifiedOnly: !!s.verifiedOnly };
        try { if (storage) { storage.setItem(SETTINGS_KEY, JSON.stringify(memory)); persistent = true; } }
        catch (e) { persistent = false; }
      },
      isPersistent: function () { return persistent; },
    };
  }

  var api = {
    SETTINGS_KEY: SETTINGS_KEY, DOMAINS: DOMAINS, SCORE_NOTE_RAW: SCORE_NOTE_RAW,
    readFacts: readFacts, passMarkNote: passMarkNote, seededRng: seededRng, allocate: allocate, drawExam: drawExam,
    remainingMs: remainingMs, isExpired: isExpired, formatClock: formatClock,
    newSession: newSession, setAnswer: setAnswer, toggleFlag: toggleFlag, goTo: goTo, submit: submit,
    reviewSummary: reviewSummary, score: score, flattenQuestions: flattenQuestions, guideLink: guideLink,
    isVerified: isVerified, createStore: createStore,
  };

  /* ---------------- browser UI (skipped under node) ---------------- */
  if (win && win.document && win.ReaderLogic) mount(win, api);
  return api;

  function mount(w, A) {
    var doc = w.document, R = w.ReaderLogic, main = doc.getElementById("main");
    var storage = null;
    try { storage = w.localStorage; } catch (e) { storage = null; }
    var store = A.createStore(storage);
    var data = null, observer = null, tickId = null;
    var ui = { exam: null, session: null, confirming: false, announced: {}, titles: {} };

    function el(tag, attrs, kids) {
      var n = doc.createElement(tag);
      Object.keys(attrs || {}).forEach(function (k) {
        if (k === "text") n.textContent = attrs[k]; else if (k === "class") n.className = attrs[k]; else n.setAttribute(k, attrs[k]);
      });
      (kids || []).forEach(function (c) { n.appendChild(c); });
      return n;
    }
    function onExamRoute() { return R.parseRoute(w.location.hash).view === "exam"; }
    function focusEl(sel) { var n = doc.querySelector(sel); if (n) n.focus(); }
    function jget(url) {
      return fetch(url).then(function (r) { if (!r.ok) throw new Error(url.split("/").pop() + " " + r.status); return r.json(); });
    }

    function load() {
      if (data) return Promise.resolve(data);
      return Promise.all([jget("../data/saa-c03/exam-facts.json"), jget("../data/saa-c03/syllabus.json")]).then(function (v) {
        var info = A.readFacts(v[0]);
        var files = [];
        v[1].groups.forEach(function (g) { g.guides.forEach(function (x) { files.push(x.file); }); });
        return Promise.all(files.map(function (f) {
          var name = f.replace("content/saa-c03/", "").replace(/\.md$/, ".json");
          return jget("../data/saa-c03/mcq/" + name).then(function (d) { ui.titles[f] = f.replace("content/saa-c03/", ""); return d; },
                                                          function () { return null; });
        })).then(function (parts) {
          var questions = A.flattenQuestions(parts), byId = {};
          questions.forEach(function (q) { byId[q.id] = q; });
          if (!questions.length) throw new Error("no question files could be loaded");
          data = { info: info, questions: questions, byId: byId };
          return data;
        });
      });
    }

    /* ----- timer ----- */
    function announce(text) {
      var n = doc.getElementById("ex-live");
      if (n) n.textContent = text;
    }
    function stopTick() { if (tickId) { w.clearInterval(tickId); tickId = null; } }
    function tick() {
      var s = ui.session;
      if (!s || s.submitted) { stopTick(); return; }
      var now = Date.now(), left = A.remainingMs(s, now);
      if (left <= 0) { finish("time"); return; }
      var t = doc.getElementById("ex-timer");
      if (t) t.textContent = A.formatClock(left);
      [10, 5, 1].forEach(function (m) {
        if (left <= m * 60000 && !ui.announced[m]) { ui.announced[m] = true; announce(m + (m === 1 ? " minute" : " minutes") + " left."); }
      });
    }
    function finish(reason) {
      ui.session = A.submit(ui.session, Date.now(), reason);
      ui.confirming = false;
      stopTick();
      if (onExamRoute()) { draw(); focusEl("#ex-results-h"); }
    }

    /* ----- actions ----- */
    function start() {
      var drawn = A.drawExam(data.questions, data.info, { verifiedOnly: store.get().verifiedOnly });
      if (!drawn.ids.length) return;
      ui.exam = drawn; ui.announced = {}; ui.confirming = false;
      ui.session = A.newSession(drawn.ids, data.info.minutes * 60000, Date.now());
      stopTick(); tickId = w.setInterval(tick, 1000);
      draw(); focusEl("#ex-question");
    }
    function update(next, keepFocus) {
      ui.session = next; draw();
      if (keepFocus) focusEl(keepFocus);
    }

    /* ----- screens ----- */
    function banner(host) {
      if (data.info.allVerified) return;
      host.appendChild(el("p", { class: "notice", role: "note", text:
        "Exam facts are unverified, so this practice exam splits the questions evenly across the four domains instead of using the published weights. " +
        "The question count, time limit and pass mark below are also unverified. Unverified: " + data.info.unverified.join(", ") + "." }));
    }
    function badge(q) {
      return q.status === "verified" ? el("span") : el("span", { class: "ex-badge", text: "Candidate" });
    }
    function drawStart(host) {
      var st = store.get(), info = data.info;
      host.appendChild(el("p", { text: "A timed practice exam drawn from the question bank: " + info.total + " questions in " + info.minutes + " minutes." }));
      banner(host);
      var pool = data.questions.filter(function (q) { return !st.verifiedOnly || A.isVerified(q); });
      var verifiedCount = data.questions.filter(A.isVerified).length;
      host.appendChild(el("p", { class: "muted", text: data.questions.length + " questions in the bank, " + verifiedCount + " verified; " +
        pool.length + " available with your setting." }));
      if (!store.isPersistent()) host.appendChild(el("p", { class: "notice", text: "Your browser is blocking storage, so this setting will not be remembered." }));
      var box = el("input", { type: "checkbox", id: "ex-verified" });
      box.checked = !!st.verifiedOnly;
      box.addEventListener("change", function () { store.set({ verifiedOnly: box.checked }); draw(); focusEl("#ex-verified"); });
      host.appendChild(el("label", { class: "ex-setting", for: "ex-verified" }, [box, doc.createTextNode(" Use verified questions only")]));
      if (st.verifiedOnly && !pool.length) {
        host.appendChild(el("p", { class: "notice", text: "No question has been verified yet, so there is nothing to draw. Turn the setting off to use candidate questions." }));
      }
      var go = el("button", { type: "button", class: "btn", id: "ex-start", text: "Start exam" });
      if (!pool.length) go.setAttribute("disabled", "disabled");
      go.addEventListener("click", start);
      host.appendChild(el("p", {}, [go]));
      host.appendChild(el("p", { class: "muted", text: "Unanswered questions score as incorrect. Your answers are not stored." }));
    }

    function drawRun(host) {
      var s = ui.session, id = s.order[s.current], q = data.byId[id];
      var head = el("div", { class: "ex-head" }, [
        el("span", { class: "muted", text: "Question " + (s.current + 1) + " of " + s.order.length }),
        el("span", { class: "ex-timer", id: "ex-timer", role: "timer", "aria-label": "Time remaining", text: A.formatClock(A.remainingMs(s, Date.now())) }),
      ]);
      host.appendChild(head);
      host.appendChild(el("div", { id: "ex-live", class: "sr-only", role: "status", "aria-live": "polite" }));
      banner(host);

      var nav = el("ol", { class: "ex-nav", "aria-label": "Question navigator" });
      s.order.forEach(function (qid, i) {
        var answered = s.answers[qid] !== undefined, flagged = !!s.flags[qid];
        var label = "Question " + (i + 1) + (answered ? ", answered" : ", not answered") + (flagged ? ", flagged for review" : "") + (i === s.current ? ", current" : "");
        var b = el("button", { type: "button", "aria-label": label, text: String(i + 1),
          class: "ex-n" + (answered ? " done" : "") + (flagged ? " flag" : "") + (i === s.current ? " cur" : "") });
        if (i === s.current) b.setAttribute("aria-current", "true");
        b.addEventListener("click", function () { ui.confirming = false; update(A.goTo(s, i), "#ex-question"); });
        nav.appendChild(el("li", {}, [b]));
      });
      host.appendChild(nav);

      var fs = el("fieldset", { class: "panel ex-q" });
      var lg = el("legend", { id: "ex-question", tabindex: "-1", text: q.stem });
      fs.appendChild(lg); fs.appendChild(badge(q));
      q.options.forEach(function (o, i) {
        var inp = el("input", { type: "radio", name: "ex-opt", id: "ex-o" + i, value: String(i) });
        inp.checked = s.answers[id] === i;
        inp.addEventListener("change", function () { update(A.setAnswer(ui.session, id, i, Date.now()), "#ex-o" + i); });
        fs.appendChild(el("label", { class: "ex-opt", for: "ex-o" + i }, [inp, el("span", { text: o.text })]));
      });
      host.appendChild(fs);

      var flag = el("input", { type: "checkbox", id: "ex-flag" });
      flag.checked = !!s.flags[id];
      flag.addEventListener("change", function () { update(A.toggleFlag(ui.session, id, Date.now()), "#ex-flag"); });
      host.appendChild(el("label", { class: "ex-setting", for: "ex-flag" }, [flag, doc.createTextNode(" Flag for review")]));

      var row = el("div", { class: "pager" });
      var prev = el("button", { type: "button", class: "btn ghost", text: "← Previous" });
      if (s.current === 0) prev.setAttribute("disabled", "disabled");
      prev.addEventListener("click", function () { update(A.goTo(s, s.current - 1), "#ex-question"); });
      var next = el("button", { type: "button", class: "btn", text: "Next →" });
      if (s.current === s.order.length - 1) next.setAttribute("disabled", "disabled");
      next.addEventListener("click", function () { update(A.goTo(s, s.current + 1), "#ex-question"); });
      row.appendChild(prev); row.appendChild(next);
      host.appendChild(row);

      if (!ui.confirming) {
        var sub = el("button", { type: "button", class: "btn ghost", text: "Review and submit" });
        sub.addEventListener("click", function () { ui.confirming = true; draw(); focusEl("#ex-confirm"); });
        host.appendChild(el("p", {}, [sub]));
      } else {
        var rs = A.reviewSummary(s);
        var panel = el("div", { class: "panel", id: "ex-confirm", tabindex: "-1" });
        panel.appendChild(el("p", { text: rs.unanswered.length ? rs.unanswered.length + " unanswered (they will score as incorrect): " + rs.unanswered.join(", ") + "." : "Every question is answered." }));
        if (rs.flagged.length) panel.appendChild(el("p", { text: "Flagged for review: " + rs.flagged.join(", ") + "." }));
        var yes = el("button", { type: "button", class: "btn", text: "Submit exam now" });
        yes.addEventListener("click", function () { finish("user"); });
        var no = el("button", { type: "button", class: "btn ghost", text: "Keep working" });
        no.addEventListener("click", function () { ui.confirming = false; draw(); focusEl("#ex-question"); });
        panel.appendChild(el("div", { class: "pager" }, [no, yes]));
        host.appendChild(panel);
      }
    }

    function drawResults(host) {
      var s = ui.session, sc = A.score(s, data.byId), info = data.info;
      host.appendChild(el("h2", { id: "ex-results-h", tabindex: "-1", text: "Results" }));
      if (s.endedBy === "time") host.appendChild(el("p", { class: "notice", text: "Time ran out, so the exam was submitted automatically." }));
      host.appendChild(el("p", { class: "ex-total", text: sc.correct + " of " + sc.total + " correct (" + sc.percent + "%). " + sc.unanswered + " unanswered." }));
      host.appendChild(el("p", { class: "muted", text: A.passMarkNote(info) }));
      banner(host);

      var tbl = el("table", { class: "ex-table" });
      tbl.appendChild(el("caption", { text: "Raw score per domain" }));
      tbl.appendChild(el("thead", {}, [el("tr", {}, ["Domain", "Correct", "Questions", "Unanswered"].map(function (t) { return el("th", { scope: "col", text: t }); }))]));
      var body = el("tbody");
      A.DOMAINS.forEach(function (d) {
        var b = sc.byDomain[d];
        body.appendChild(el("tr", {}, [el("th", { scope: "row", text: d.replace("domain-", "Domain ") }),
          el("td", { text: String(b.correct) }), el("td", { text: String(b.total) }), el("td", { text: String(b.unanswered) })]));
      });
      tbl.appendChild(body); host.appendChild(tbl);

      host.appendChild(el("h2", { text: "Every question" }));
      s.order.forEach(function (id, n) {
        var q = data.byId[id], a = s.answers[id];
        var status = a === undefined ? "Unanswered" : (a === q.correct ? "Correct" : "Incorrect");
        var card = el("section", { class: "panel ex-review" });
        card.appendChild(el("h3", { text: (n + 1) + ". " + status }));
        card.appendChild(el("p", { text: q.stem }));
        card.appendChild(badge(q));
        var ul = el("ul", { class: "ex-options" });
        q.options.forEach(function (o, i) {
          var tags = [];
          if (i === q.correct) tags.push("Correct answer");
          if (i === a) tags.push("Your answer");
          var li = el("li", { class: i === q.correct ? "right" : (i === a ? "wrong" : "") });
          li.appendChild(el("strong", { text: o.text + (tags.length ? " (" + tags.join(", ") + ")" : "") }));
          li.appendChild(el("p", { class: "muted", text: o.explanation }));
          ul.appendChild(li);
        });
        card.appendChild(ul);
        card.appendChild(el("p", { class: "muted" }, [doc.createTextNode("Guide: "),
          el("a", { href: A.guideLink(q.guide), text: q.guide.replace("content/saa-c03/", "") })]));
        host.appendChild(card);
      });
      var again = el("button", { type: "button", class: "btn", text: "Back to start" });
      again.addEventListener("click", function () { ui.session = null; ui.exam = null; draw(); focusEl("#ex-start"); });
      host.appendChild(el("p", {}, [again]));
    }

    function draw() {
      var host = doc.getElementById("ex-root");
      if (!host) { host = el("div", { id: "ex-root" }); main.appendChild(host); }
      while (host.firstChild) host.removeChild(host.firstChild);
      if (!ui.session) drawStart(host);
      else if (ui.session.submitted) drawResults(host);
      else drawRun(host);
    }

    function show() {
      if (observer) { observer.disconnect(); observer = null; }
      if (!onExamRoute()) return;
      doc.title = "Practice exam · SAA-C03 Study Site";
      // Hop one task so the shell's own "coming soon" render lands first.
      w.setTimeout(function () {
        load().then(function () {
          if (!onExamRoute()) return;
          var paint = function () {
            while (main.firstChild) main.removeChild(main.firstChild);
            main.appendChild(el("h1", { text: "Practice exam" }));
            draw();
          };
          paint();
          observer = new w.MutationObserver(function () {
            if (onExamRoute() && !doc.getElementById("ex-root")) {
              observer.disconnect(); paint(); observer.observe(main, { childList: true });
            }
          });
          observer.observe(main, { childList: true });
        }).catch(function (e) {
          while (main.firstChild) main.removeChild(main.firstChild);
          main.appendChild(el("h1", { text: "Practice exam" }));
          main.appendChild(el("p", { class: "notice", text: "The practice exam could not load (" + e.message + ")." }));
        });
      }, 0);
    }
    w.addEventListener("hashchange", show);
    show();
  }
});
