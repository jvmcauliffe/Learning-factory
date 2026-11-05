/* Flashcards with five-box Leitner spaced repetition.
 * Pure logic is exported for node --test (module.exports) and the browser
 * (window.Flashcards). The UI mounts itself on #/flashcards when a DOM exists.
 * Cards are the Pocket card rows in data/saa-c03/bank.json, unedited. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Flashcards = factory(root);
})(typeof self !== "undefined" ? self : this, function (win) {
  "use strict";

  var STATE_KEY = "lf.saa-c03.flashcards.v1";
  var DAY_MS = 86400000;
  var BOX_DAYS = [0, 1, 3, 7, 14]; // box 1..5 review intervals in days

  /** One card per Pocket card row. Front is the keyword cue, back the answer. */
  function buildCards(bank, syllabus) {
    var groupOf = {};
    (syllabus.groups || []).forEach(function (g) {
      (g.guides || []).forEach(function (guide) { groupOf[guide.file] = g.name; });
    });
    return (bank.items || [])
      .filter(function (i) { return i.type === "pocket_card"; })
      .map(function (i) {
        return {
          id: i.id,
          guide: i.guide,
          group: groupOf[i.guide] || "Other",
          front: i.keyword,
          back: i.answer,
          trap: !!i.is_trap,
          line: i.line,
          section: i.section,
        };
      });
  }

  function cardsPerGuide(cards) {
    var out = {};
    cards.forEach(function (c) { out[c.guide] = (out[c.guide] || 0) + 1; });
    return out;
  }

  /** filter: {guide, group, trapsOnly}; empty or "all" means no restriction. */
  function filterCards(cards, filter) {
    var f = filter || {};
    return cards.filter(function (c) {
      if (f.guide && f.guide !== "all" && c.guide !== f.guide) return false;
      if (f.group && f.group !== "all" && c.group !== f.group) return false;
      if (f.trapsOnly && !c.trap) return false;
      return true;
    });
  }

  /** state[id] = {box: 1..5, due: ms}. A card with no state is new and due. */
  function isDue(state, id, now) {
    var s = state[id];
    return !s || s.due <= now;
  }

  /** Due cards, lowest box first, then earliest due, then bank order. */
  function dueQueue(cards, state, now) {
    var due = cards.filter(function (c) { return isDue(state, c.id, now); });
    return due.map(function (c, idx) { return { c: c, idx: idx }; })
      .sort(function (a, b) {
        var sa = state[a.c.id], sb = state[b.c.id];
        var ba = sa ? sa.box : 1, bb = sb ? sb.box : 1;
        if (ba !== bb) return ba - bb;
        var da = sa ? sa.due : 0, db = sb ? sb.due : 0;
        if (da !== db) return da - db;
        return a.idx - b.idx;
      })
      .map(function (x) { return x.c; });
  }

  /** Knew it: up one box (capped at 5). Missed it: back to box 1. Pure. */
  function grade(state, id, knew, now) {
    var cur = state[id] ? state[id].box : 1;
    var box = knew ? Math.min(cur + 1, BOX_DAYS.length) : 1;
    // A first-time correct answer on a new card starts it in box 2.
    var next = Object.assign({}, state);
    next[id] = { box: box, due: now + BOX_DAYS[box - 1] * DAY_MS };
    return next;
  }

  function boxCounts(cards, state) {
    var out = [0, 0, 0, 0, 0];
    cards.forEach(function (c) { out[(state[c.id] ? state[c.id].box : 1) - 1] += 1; });
    return out;
  }

  /** localStorage-backed store; every access guarded, memory fallback. */
  function createStore(storage) {
    var memory = {};
    var persistent = false;
    function load() {
      try {
        if (!storage) return null;
        var raw = storage.getItem(STATE_KEY);
        persistent = true;
        if (!raw) return {};
        var data = JSON.parse(raw);
        return data && typeof data === "object" && !Array.isArray(data) ? clean(data) : {};
      } catch (e) { return null; }
    }
    function clean(data) {
      var out = {};
      Object.keys(data).forEach(function (id) {
        var s = data[id];
        if (s && Number.isInteger(s.box) && s.box >= 1 && s.box <= 5 && typeof s.due === "number") out[id] = { box: s.box, due: s.due };
      });
      return out;
    }
    var loaded = load();
    if (loaded) memory = loaded;
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
    STATE_KEY: STATE_KEY, BOX_DAYS: BOX_DAYS, DAY_MS: DAY_MS,
    buildCards: buildCards, cardsPerGuide: cardsPerGuide, filterCards: filterCards,
    isDue: isDue, dueQueue: dueQueue, grade: grade, boxCounts: boxCounts, createStore: createStore,
  };

  /* ---------------- browser UI (skipped under node) ---------------- */
  if (win && win.document && win.ReaderLogic) mount(win, api);
  return api;

  function mount(w, A) {
    var doc = w.document, R = w.ReaderLogic, main = doc.getElementById("main");
    var storage = null;
    try { storage = w.localStorage; } catch (e) { storage = null; }
    var store = A.createStore(storage);
    var data = null, observer = null, ui = { filter: { guide: "all", group: "all", trapsOnly: false }, flipped: false, queue: [], done: 0 };

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
        var lessons = R.lessonsInOrder(v[1]);
        data = { cards: A.buildCards(v[0], v[1]), lessons: lessons, groups: v[1].groups.map(function (g) { return g.name; }) };
        return data;
      });
    }
    function rebuildQueue() {
      var pool = A.filterCards(data.cards, ui.filter);
      ui.queue = A.dueQueue(pool, store.get(), Date.now());
      ui.flipped = false;
    }
    function select(label, value, options, onChange) {
      var s = el("select", { "aria-label": label });
      options.forEach(function (o) {
        var opt = el("option", { value: o[0], text: o[1] });
        if (o[0] === value) opt.selected = true;
        s.appendChild(opt);
      });
      s.addEventListener("change", function () { onChange(s.value); });
      return s;
    }
    function lessonLink(card) {
      var slug = R.sectionSlug(card.section || "Pocket card");
      return "#/learn/" + encodeURI(card.guide) + "#" + slug;
    }
    function answer(knew) {
      var card = ui.queue[0];
      if (!card) return;
      store.set(A.grade(store.get(), card.id, knew, Date.now()));
      ui.done += 1;
      rebuildQueue();
      draw();
      focusCard();
    }
    function draw() {
      var host = doc.getElementById("fc-root");
      if (!host) { host = el("div", { id: "fc-root" }); main.appendChild(host); }
      while (host.firstChild) host.removeChild(host.firstChild);
      var pool = A.filterCards(data.cards, ui.filter);
      var guideOpts = [["all", "All guides (" + data.cards.length + ")"]].concat(data.lessons.map(function (l) {
        var n = A.filterCards(data.cards, { guide: l.file }).length;
        return [l.file, l.number + " " + l.title + " (" + n + ")"];
      }));
      var groupOpts = [["all", "All topic groups"]].concat(data.groups.map(function (g) { return [g, g]; }));
      var bar = el("div", { class: "fc-filters" }, [
        select("Guide", ui.filter.guide, guideOpts, function (v) { ui.filter.guide = v; rebuildQueue(); draw(); }),
        select("Topic group", ui.filter.group, groupOpts, function (v) { ui.filter.group = v; rebuildQueue(); draw(); }),
      ]);
      var trap = el("input", { type: "checkbox", id: "fc-traps" });
      trap.checked = ui.filter.trapsOnly;
      trap.addEventListener("change", function () { ui.filter.trapsOnly = trap.checked; rebuildQueue(); draw(); });
      bar.appendChild(el("label", { class: "fc-traps" }, [trap, doc.createTextNode(" Traps only")]));
      host.appendChild(bar);

      var counts = A.boxCounts(pool, store.get());
      host.appendChild(el("p", { class: "muted", text: pool.length + " cards · " + ui.queue.length + " due · boxes 1–5: " + counts.join(" / ") }));
      if (!store.isPersistent()) host.appendChild(el("p", { class: "notice", text: "Your browser is blocking storage, so card progress will not be saved after you close this tab." }));

      var card = ui.queue[0];
      if (!pool.length) { host.appendChild(el("p", { class: "notice", text: "No cards match these filters." })); return; }
      if (!card) {
        host.appendChild(el("div", { class: "panel" }, [el("p", { text: "All caught up. Nothing is due in this selection." }), el("p", { class: "muted", text: "Cards you missed come back at once; others return after 1, 3, 7 or 14 days." })]));
        return;
      }
      var face = el("button", { type: "button", class: "fc-card" + (card.trap ? " trap" : ""), "aria-live": "polite" }, [
        card.trap ? el("span", { class: "fc-badge", text: "TRAP" }) : el("span"),
        el("span", { class: "fc-label", text: ui.flipped ? "Answer" : "Cue" }),
        el("span", { class: "fc-text", text: ui.flipped ? card.back : card.front }),
      ]);
      face.addEventListener("click", function () { ui.flipped = !ui.flipped; draw(); focusCard(); });
      host.appendChild(face);
      if (ui.flipped) {
        host.appendChild(el("p", { class: "muted" }, [doc.createTextNode("Source: "), el("a", { href: lessonLink(card), text: card.guide.replace("content/saa-c03/", "") + ", line " + card.line })]));
        var miss = el("button", { type: "button", class: "btn ghost", text: "Missed it (←)" });
        var knew = el("button", { type: "button", class: "btn", text: "Knew it (→)" });
        miss.addEventListener("click", function () { answer(false); });
        knew.addEventListener("click", function () { answer(true); });
        host.appendChild(el("div", { class: "pager" }, [miss, knew]));
      } else {
        host.appendChild(el("p", { class: "muted", text: "Tap the card or press Space to flip." }));
      }
    }
    function onKey(e) {
      if (R.parseRoute(w.location.hash).view !== "flashcards" || !ui.queue.length) return;
      var t = e.target && e.target.tagName;
      if (t === "SELECT" || t === "INPUT") return;
      // Space and Enter on the focused card button flip it natively; handle Space when nothing is focused.
      if (e.key === " " && (!t || t === "BODY")) { e.preventDefault(); ui.flipped = !ui.flipped; draw(); focusCard(); }
      else if (e.key === "ArrowRight" && ui.flipped) answer(true);
      else if (e.key === "ArrowLeft" && ui.flipped) answer(false);
    }
    function focusCard() { var c = doc.querySelector(".fc-card"); if (c) c.focus(); }
    function show() {
      if (observer) { observer.disconnect(); observer = null; }
      if (R.parseRoute(w.location.hash).view !== "flashcards") return;
      doc.title = "Flashcards · SAA-C03 Study Site";
      // Hop one task so the shell's own "coming soon" render lands first.
      w.setTimeout(function () {
        load().then(function () {
          if (R.parseRoute(w.location.hash).view !== "flashcards") return;
          while (main.firstChild) main.removeChild(main.firstChild);
          main.appendChild(el("h1", { text: "Flashcards" }));
          rebuildQueue();
          draw();
          // If the shell re-renders over us (slow first load), draw again.
          observer = new w.MutationObserver(function () {
            if (R.parseRoute(w.location.hash).view === "flashcards" && !doc.getElementById("fc-root")) {
              observer.disconnect();
              while (main.firstChild) main.removeChild(main.firstChild);
              main.appendChild(el("h1", { text: "Flashcards" }));
              draw();
              observer.observe(main, { childList: true });
            }
          });
          observer.observe(main, { childList: true });
        }).catch(function (e) {
          main.appendChild(el("p", { class: "notice", text: "Flashcards could not load (" + e.message + ")." }));
        });
      }, 0);
    }
    w.addEventListener("hashchange", show);
    doc.addEventListener("keydown", onKey);
    show();
  }
});
