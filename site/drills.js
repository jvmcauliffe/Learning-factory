/* Scenario drills: show a question-pattern scenario, the learner commits to an
 * answer in a free-text box, then reveals the guide's answer and signal note and
 * self-grades. The free text is never marked and never stored.
 * Pure logic is exported for node --test (module.exports) and the browser
 * (window.Drills). The UI mounts itself on #/drills when a DOM exists.
 * Drill text is unedited from data/saa-c03/bank.json. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Drills = factory(root);
})(typeof self !== "undefined" ? self : this, function (win) {
  "use strict";

  var STATE_KEY = "lf.saa-c03.drills.v1";
  var GRADES = ["right", "partly", "wrong"];
  var REQUEUE_GAP = { wrong: 3, partly: 6 }; // cards later in the same session
  var STOPWORDS = {};
  ("the and for not only with that this from but are can too more one all any per its who why how " +
   "use uses than then into over via out has had was were you your our their them they when what which").split(" ")
    .forEach(function (w) { STOPWORDS[w] = true; });

  function buildDrills(bank, syllabus) {
    var groupOf = {};
    (syllabus.groups || []).forEach(function (g) {
      (g.guides || []).forEach(function (guide) { groupOf[guide.file] = g.name; });
    });
    return (bank.items || [])
      .filter(function (i) { return i.type === "question_pattern"; })
      .map(function (i) {
        return { id: i.id, guide: i.guide, group: groupOf[i.guide] || "Other", scenario: i.scenario,
                 answer: i.answer, signal: i.signal || "", line: i.line, section: i.section };
      });
  }

  function drillsPerGuide(drills) {
    var out = {};
    drills.forEach(function (d) { out[d.guide] = (out[d.guide] || 0) + 1; });
    return out;
  }

  function sectionSlug(text) {
    var s = String(text).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return s || "section";
  }
  /** Route to the guide section the drill came from. */
  function sourceLink(drill) {
    return "#/learn/" + encodeURI(drill.guide) + "#" + sectionSlug(drill.section || "Question patterns");
  }

  /** Words from the guide's own signal note worth marking: 3+ characters (or a short name with a digit, like S3), not filler or bare numbers. */
  function signalWords(signal) {
    var set = {};
    (String(signal).toLowerCase().match(/[a-z0-9]+/g) || []).forEach(function (w) {
      if (/[a-z]/.test(w) && (w.length >= 3 || /\d/.test(w)) && !STOPWORDS[w]) set[w] = true;
    });
    return set;
  }

  /** Split the scenario into [{text, hit}]; hit only for words that appear in the signal note. */
  function highlightSegments(scenario, signal) {
    var words = signalWords(signal);
    var out = [], last = 0, re = /[A-Za-z0-9]+/g, m;
    while ((m = re.exec(scenario))) {
      if (!words[m[0].toLowerCase()]) continue;
      if (m.index > last) out.push({ text: scenario.slice(last, m.index), hit: false });
      out.push({ text: m[0], hit: true });
      last = m.index + m[0].length;
    }
    if (last < scenario.length) out.push({ text: scenario.slice(last), hit: false });
    return out;
  }

  /** state = {seen:{id:1}, pending:{id:"wrong"|"partly"}}. */
  function emptyState() { return { seen: {}, pending: {} }; }

  /**
   * Order for a new session: items still owed from last time (wrong first, then
   * partly), then unseen items, then the rest, each group in bank order.
   */
  function startSession(drills, state) {
    var pending = state.pending || {}, seen = state.seen || {};
    var ids = drills.map(function (d) { return d.id; });
    var wrong = ids.filter(function (id) { return pending[id] === "wrong"; });
    var partly = ids.filter(function (id) { return pending[id] === "partly"; });
    var unseen = ids.filter(function (id) { return !pending[id] && !seen[id]; });
    var rest = ids.filter(function (id) { return !pending[id] && seen[id]; });
    return wrong.concat(partly, unseen, rest);
  }

  /** Grade the item at the head of the queue. Pure: returns {queue, state}. */
  function applyGrade(queue, state, grade) {
    if (GRADES.indexOf(grade) < 0) throw new Error("grade must be right, partly or wrong");
    if (!queue.length) return { queue: queue, state: state };
    var id = queue[0], rest = queue.slice(1);
    var seen = Object.assign({}, state.seen), pending = Object.assign({}, state.pending);
    seen[id] = 1;
    if (grade === "right") {
      delete pending[id];
    } else {
      pending[id] = grade;
      rest.splice(Math.min(REQUEUE_GAP[grade], rest.length), 0, id);
    }
    return { queue: rest, state: { seen: seen, pending: pending } };
  }

  function createStore(storage) {
    var memory = emptyState(), persistent = false;
    function clean(data) {
      var out = emptyState();
      if (data && typeof data === "object") {
        Object.keys(data.seen || {}).forEach(function (id) { if (data.seen[id]) out.seen[id] = 1; });
        Object.keys(data.pending || {}).forEach(function (id) {
          var g = data.pending[id];
          if (g === "wrong" || g === "partly") out.pending[id] = g;
        });
      }
      return out;
    }
    try {
      if (storage) {
        var raw = storage.getItem(STATE_KEY);
        persistent = true;
        if (raw) memory = clean(JSON.parse(raw));
      }
    } catch (e) { memory = emptyState(); persistent = false; }
    return {
      get: function () { return memory; },
      set: function (state) {
        memory = state;
        try { if (storage) { storage.setItem(STATE_KEY, JSON.stringify(state)); persistent = true; } }
        catch (e) { persistent = false; }
      },
      isPersistent: function () { return persistent; },
    };
  }

  var api = {
    STATE_KEY: STATE_KEY, GRADES: GRADES, REQUEUE_GAP: REQUEUE_GAP,
    buildDrills: buildDrills, drillsPerGuide: drillsPerGuide, sourceLink: sourceLink,
    signalWords: signalWords, highlightSegments: highlightSegments, emptyState: emptyState,
    startSession: startSession, applyGrade: applyGrade, createStore: createStore,
  };

  /* ---------------- browser UI (skipped under node) ---------------- */
  if (win && win.document && win.ReaderLogic) mount(win, api);
  return api;

  function mount(w, A) {
    var doc = w.document, R = w.ReaderLogic, main = doc.getElementById("main");
    var storage = null;
    try { storage = w.localStorage; } catch (e) { storage = null; }
    var store = A.createStore(storage);
    var data = null, observer = null;
    var ui = { queue: null, revealed: false, answered: 0, text: "" };

    function el(tag, attrs, kids) {
      var n = doc.createElement(tag);
      Object.keys(attrs || {}).forEach(function (k) {
        if (k === "text") n.textContent = attrs[k]; else if (k === "class") n.className = attrs[k]; else n.setAttribute(k, attrs[k]);
      });
      (kids || []).forEach(function (c) { n.appendChild(c); });
      return n;
    }
    function load() {
      if (data) return Promise.resolve(data);
      return Promise.all([
        fetch("../data/saa-c03/bank.json").then(function (r) { if (!r.ok) throw new Error("bank.json " + r.status); return r.json(); }),
        fetch("../data/saa-c03/syllabus.json").then(function (r) { if (!r.ok) throw new Error("syllabus.json " + r.status); return r.json(); }),
      ]).then(function (v) {
        var drills = A.buildDrills(v[0], v[1]), byId = {};
        drills.forEach(function (d) { byId[d.id] = d; });
        data = { drills: drills, byId: byId };
        return data;
      });
    }
    function focusEl(sel) { var n = doc.querySelector(sel); if (n) n.focus(); }
    function grade(g) {
      var r = A.applyGrade(ui.queue, store.get(), g);
      ui.queue = r.queue; store.set(r.state);
      ui.revealed = false; ui.text = ""; ui.answered += 1;
      draw(); focusEl("#dr-answer");
    }
    function draw() {
      var host = doc.getElementById("dr-root");
      if (!host) { host = el("div", { id: "dr-root" }); main.appendChild(host); }
      while (host.firstChild) host.removeChild(host.firstChild);
      var st = store.get();
      var owed = Object.keys(st.pending).length;
      host.appendChild(el("p", { class: "muted", text: data.drills.length + " scenarios · " + ui.queue.length + " left this session · " + owed + " to revisit" }));
      if (!store.isPersistent()) host.appendChild(el("p", { class: "notice", text: "Your browser is blocking storage, so drill progress will not be saved after you close this tab." }));
      var d = data.byId[ui.queue[0]];
      if (!d) {
        host.appendChild(el("div", { class: "panel" }, [el("p", { text: "Session finished. " + ui.answered + " answered." }),
          el("p", { class: "muted", text: owed ? owed + " scenario(s) marked partly or wrong will come back first next time." : "Nothing is owed." })]));
        var again = el("button", { type: "button", class: "btn", text: "Start another session" });
        again.addEventListener("click", function () { ui.queue = A.startSession(data.drills, store.get()); ui.answered = 0; draw(); focusEl("#dr-answer"); });
        host.appendChild(again);
        return;
      }
      var box = el("div", { class: "panel dr-scenario" });
      if (ui.revealed) {
        A.highlightSegments(d.scenario, d.signal).forEach(function (s) {
          box.appendChild(s.hit ? el("mark", { text: s.text }) : doc.createTextNode(s.text));
        });
      } else {
        box.appendChild(doc.createTextNode(d.scenario));
      }
      host.appendChild(box);
      if (!ui.revealed) {
        var ta = el("textarea", { id: "dr-answer", rows: "3", "aria-label": "Your answer", placeholder: "Which service or design, and why?" });
        ta.value = ui.text;
        ta.addEventListener("input", function () { ui.text = ta.value; });
        var reveal = el("button", { type: "button", class: "btn", text: "Reveal answer" });
        reveal.addEventListener("click", function () { ui.revealed = true; draw(); focusEl(".dr-grade button"); });
        host.appendChild(ta); host.appendChild(el("p", {}, [reveal]));
        host.appendChild(el("p", { class: "muted", text: "Your text is not marked. It only helps you commit before you look." }));
      } else {
        if (ui.text) host.appendChild(el("p", { class: "muted", text: "You wrote: " + ui.text }));
        host.appendChild(el("div", { class: "panel" }, [
          el("p", { class: "dr-label", text: "Answer" }), el("p", { class: "dr-answer", text: d.answer }),
          d.signal ? el("p", { class: "muted", text: "Signal: " + d.signal }) : el("span"),
          el("p", { class: "muted" }, [doc.createTextNode("Source: "), el("a", { href: A.sourceLink(d), text: d.guide.replace("content/saa-c03/", "") + ", line " + d.line })]),
        ]));
        var row = el("div", { class: "pager dr-grade" });
        [["wrong", "Wrong", "btn ghost"], ["partly", "Partly", "btn ghost"], ["right", "Right", "btn"]].forEach(function (g) {
          var b = el("button", { type: "button", class: g[2], text: g[1] });
          b.addEventListener("click", function () { grade(g[0]); });
          row.appendChild(b);
        });
        host.appendChild(row);
      }
    }
    function show() {
      if (observer) { observer.disconnect(); observer = null; }
      if (R.parseRoute(w.location.hash).view !== "drills") return;
      doc.title = "Scenario drills · SAA-C03 Study Site";
      // Hop one task so the shell's own "coming soon" render lands first.
      w.setTimeout(function () {
        load().then(function () {
          if (R.parseRoute(w.location.hash).view !== "drills") return;
          if (!ui.queue) ui.queue = A.startSession(data.drills, store.get());
          var paint = function () {
            while (main.firstChild) main.removeChild(main.firstChild);
            main.appendChild(el("h1", { text: "Scenario drills" }));
            draw();
          };
          paint();
          // If the shell re-renders over us (slow first load), draw again.
          observer = new w.MutationObserver(function () {
            if (R.parseRoute(w.location.hash).view === "drills" && !doc.getElementById("dr-root")) {
              observer.disconnect(); paint(); observer.observe(main, { childList: true });
            }
          });
          observer.observe(main, { childList: true });
        }).catch(function (e) {
          main.appendChild(el("p", { class: "notice", text: "Drills could not load (" + e.message + ")." }));
        });
      }, 0);
    }
    w.addEventListener("hashchange", show);
    show();
  }
});
