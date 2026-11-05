/* Exam technique trainer: the six rules from the upstream README (RonitSachdev,
 * aws-saa-c03-guides, CC BY 4.0; copied in content/saa-c03/ATTRIBUTION.md), a
 * poison-qualifier drill and a trap review deck built from guide 36 and the
 * TRAP rows of data/saa-c03/bank.json. No technique advice is added to the source.
 * Pure logic is exported for node --test (module.exports) and the browser
 * (window.Technique). The UI mounts itself on #/technique when a DOM exists.
 * Routes: #/technique, #/technique/rule/1 .. 6, #/technique/drill, #/technique/traps. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Technique = factory(root);
})(typeof self !== "undefined" ? self : this, function (win) {
  "use strict";

  var GUIDE36 = "content/saa-c03/36-Exam-Traps-KeyPatterns.md";
  var TRAP_SECTION = "The greatest-hits trap list";

  /* Copied unchanged from the upstream README, "Exam-technique rules", lines 31 to 36. */
  var RULES = [
    { n: 1, readmeLine: 31, raw: "**Read the last sentence of the question first** — \"MOST cost-effective\" vs \"LEAST operational overhead\" vs \"highly available\" decides between the two plausible finalists." },
    { n: 2, readmeLine: 32, raw: "**Count the requirements** — \"X *as well as* Y\" is a checklist; the right answer ticks every box. Half-solutions are planted for people who stop at the first match." },
    { n: 3, readmeLine: 33, raw: "**Scan options for poison qualifiers** — *serverless, automatically, at no cost, immediately, directly, cannot/always* — a true fact welded to one false word is the exam's favorite distractor." },
    { n: 4, readmeLine: 34, raw: "**When two options are twins**, the entire question lives in the differing clause." },
    { n: 5, readmeLine: 35, raw: "**Requirements are eliminators, not decoration** — a stated number (retrieval time, IOPS, RPO/RTO) exists to kill specific options. Eliminate first, then pick the cheapest/most-managed survivor." },
    { n: 6, readmeLine: 36, raw: "**When every familiar option is wrong-scope, the unfamiliar one is the answer** — real-but-unknown features sound specific and boring; fabricated ones sound grand and vague." },
  ];

  /* The list in rule 3, split at the slash. The drill checks against these and nothing else. */
  var QUALIFIERS = ["serverless", "automatically", "at no cost", "immediately", "directly", "cannot", "always"];

  /* Lines of guide 36 that state the same idea as a rule; shown beside it, unedited. */
  var GUIDE_NOTES = {
    1: [
      { line: 48, text: "**Read the last sentence first** — that's where the actual question and qualifier live; the story above it is scenery." },
      { line: 50, text: "**The qualifier decides** between two working answers: **cost** → cheapest that still works; **least operational overhead** → most managed/serverless; **highly available** → Multi-AZ; **survive region failure** → multi-region." },
    ],
  };

  /** Markdown emphasis removed, for display with textContent. */
  function plain(md) {
    return String(md).replace(/\*\*/g, "").replace(/\*/g, "").replace(/\s+/g, " ").trim();
  }
  function ruleParts(rule) {
    var m = /^\*\*(.+?)\*\*(.*)$/.exec(rule.raw);
    return { title: plain(m[1]), body: plain(m[2]).replace(/^,\s*/, "") };
  }

  function sectionSlug(text) {
    var s = String(text).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return s || "section";
  }
  function guideLink(guide, section) {
    return "#/learn/" + encodeURI(guide) + (section ? "#" + sectionSlug(section) : "");
  }

  /** Route within the technique view. Anything unknown is the landing page. */
  function parseRoute(hash) {
    var h = String(hash || "").replace(/^#\/?/, "").split("#")[0];
    var p = h.split("/").filter(Boolean);
    if (p[0] !== "technique") return { page: "none" };
    if (p[1] === "rule") {
      var n = parseInt(p[2], 10);
      if (n >= 1 && n <= RULES.length && String(n) === p[2]) return { page: "rule", n: n };
    }
    if (p[1] === "drill") return { page: "drill" };
    if (p[1] === "traps") return { page: "traps" };
    return { page: "home" };
  }
  function ruleHref(n) { return "#/technique/rule/" + n; }

  /* ---------------- poison qualifiers ---------------- */

  function qualifierRegex() {
    var alt = QUALIFIERS.map(function (q) { return q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|");
    return new RegExp("\\b(?:" + alt + ")\\b", "gi");
  }
  /** Where the README's qualifier words occur in a text: [{start, end, term}]. */
  function findQualifiers(text) {
    var re = qualifierRegex(), out = [], m;
    text = String(text);
    while ((m = re.exec(text))) out.push({ start: m.index, end: m.index + m[0].length, term: m[0].toLowerCase() });
    return out;
  }
  /**
   * Split a text into pieces that rebuild it exactly: [{text, word, qualifier}].
   * A word is a qualifier when it overlaps a qualifier match, so each word of "at no cost" counts.
   */
  function segments(text) {
    text = String(text);
    var spans = findQualifiers(text), out = [], last = 0, m;
    var wre = /[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g;
    while ((m = wre.exec(text))) {
      if (m.index > last) out.push({ text: text.slice(last, m.index), word: false, qualifier: false });
      var s = m.index, e = m.index + m[0].length;
      var q = spans.some(function (sp) { return s < sp.end && e > sp.start; });
      out.push({ text: m[0], word: true, qualifier: q });
      last = e;
    }
    if (last < text.length) out.push({ text: text.slice(last), word: false, qualifier: false });
    return out;
  }

  /** Multiple-choice questions whose stem or options use a README qualifier word. In bank order. */
  function buildQualifierDrills(questions) {
    var out = [];
    questions.forEach(function (q) {
      var parts = [{ kind: "stem", label: "Question", text: q.stem }];
      q.options.forEach(function (o, i) { parts.push({ kind: "option", label: "Option " + "ABCD".charAt(i), text: o.text }); });
      var total = 0;
      parts.forEach(function (p) {
        p.segments = segments(p.text);
        p.segments.forEach(function (s) { if (s.qualifier) total += 1; });
      });
      if (total > 0) out.push({ id: q.id, guide: q.guide, parts: parts, expected: total });
    });
    return out;
  }
  /** Keys "part:segment" of every tappable word in a drill. */
  function drillWords(drill) {
    var out = [];
    drill.parts.forEach(function (p, pi) {
      p.segments.forEach(function (s, si) { if (s.word) out.push({ key: pi + ":" + si, text: s.text, qualifier: s.qualifier }); });
    });
    return out;
  }
  /** Compare the learner's tapped keys with the README list. */
  function checkTaps(drill, tapped) {
    var set = {};
    (tapped || []).forEach(function (k) { set[k] = true; });
    var hit = [], missed = [], wrong = [];
    drillWords(drill).forEach(function (w) {
      if (w.qualifier && set[w.key]) hit.push(w);
      else if (w.qualifier) missed.push(w);
      else if (set[w.key]) wrong.push(w);
    });
    return { expected: hit.length + missed.length, hit: hit, missed: missed, wrong: wrong, perfect: missed.length === 0 && wrong.length === 0 };
  }

  /* ---------------- trap review deck ---------------- */

  /** Rows of the guide-36 trap table: [{trap, truth, line}], text without Markdown marks. */
  function parseTrapTable(md) {
    var lines = String(md).split("\n"), rows = [], inside = false;
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (/^##\s+/.test(l)) {
        if (inside) break;
        inside = plain(l.replace(/^##\s+/, "")) === TRAP_SECTION;
        continue;
      }
      if (!inside || l.charAt(0) !== "|") continue;
      var cells = l.replace(/^\|/, "").replace(/\|\s*$/, "").split("|").map(function (c) { return c.trim(); });
      if (cells.length !== 2 || /^-+$/.test(cells[0]) || cells[0] === "THE trap") continue;
      rows.push({ trap: plain(cells[0]), truth: plain(cells[1]), line: i + 1 });
    }
    return rows;
  }
  function isTrapRow(item) {
    return item.type === "pocket_card" && (item.is_trap === true || /\bTRAP\b/.test(String(item.answer)));
  }
  /** Every guide-36 table row, then every TRAP row of bank.json, each with its source. */
  function buildTrapDeck(guideMd, bank) {
    var cards = [];
    parseTrapTable(guideMd).forEach(function (r, i) {
      cards.push({ id: "g36-" + (i + 1), front: r.trap, back: r.truth, guide: GUIDE36, line: r.line, section: TRAP_SECTION,
        label: "Guide 36, the greatest-hits trap list, line " + r.line });
    });
    (bank.items || []).filter(isTrapRow).forEach(function (it) {
      cards.push({ id: it.id, front: it.keyword, back: plain(it.answer), guide: it.guide, line: it.line, section: it.section,
        label: it.guide.replace("content/saa-c03/", "") + ", " + String(it.section).toLowerCase() + ", line " + it.line });
    });
    return cards;
  }

  var api = {
    GUIDE36: GUIDE36, RULES: RULES, QUALIFIERS: QUALIFIERS, GUIDE_NOTES: GUIDE_NOTES,
    plain: plain, ruleParts: ruleParts, sectionSlug: sectionSlug, guideLink: guideLink, parseRoute: parseRoute, ruleHref: ruleHref,
    findQualifiers: findQualifiers, segments: segments, buildQualifierDrills: buildQualifierDrills,
    drillWords: drillWords, checkTaps: checkTaps, parseTrapTable: parseTrapTable, isTrapRow: isTrapRow, buildTrapDeck: buildTrapDeck,
  };

  /* ---------------- browser UI (skipped under node) ---------------- */
  if (win && win.document && win.ReaderLogic) mount(win, api);
  return api;

  function mount(w, A) {
    var doc = w.document, main = doc.getElementById("main");
    var cache = {}, observer = null;
    var ui = { drills: null, di: 0, taps: {}, checked: false, deck: null, ci: 0, shown: false };

    function el(tag, attrs, kids) {
      var n = doc.createElement(tag);
      Object.keys(attrs || {}).forEach(function (k) {
        if (k === "text") n.textContent = attrs[k]; else if (k === "class") n.className = attrs[k]; else n.setAttribute(k, attrs[k]);
      });
      (kids || []).forEach(function (c) { n.appendChild(c); });
      return n;
    }
    function link(href, text, cls) { return el("a", { href: href, class: cls || "", text: text }); }
    function focusEl(sel) { var n = doc.querySelector(sel); if (n) n.focus(); }
    function jget(url, text) {
      return fetch(url).then(function (r) { if (!r.ok) throw new Error(url.split("/").pop() + " " + r.status); return text ? r.text() : r.json(); });
    }
    function once(key, make) { if (!cache[key]) cache[key] = make(); return cache[key]; }

    function loadDeck() {
      return once("deck", function () {
        return Promise.all([jget("../" + A.GUIDE36, true), jget("../data/saa-c03/bank.json")]).then(function (v) { return A.buildTrapDeck(v[0], v[1]); });
      });
    }
    function loadDrills() {
      return once("drills", function () {
        return jget("../data/saa-c03/syllabus.json").then(function (syl) {
          var files = [];
          syl.groups.forEach(function (g) { g.guides.forEach(function (x) { files.push(x.file); }); });
          return Promise.all(files.map(function (f) {
            return jget("../data/saa-c03/mcq/" + f.replace("content/saa-c03/", "").replace(/\.md$/, ".json")).then(function (d) { return d.questions || []; }, function () { return []; });
          }));
        }).then(function (parts) {
          var all = [];
          parts.forEach(function (p) { all = all.concat(p); });
          return A.buildQualifierDrills(all);
        });
      });
    }

    function credit(host) {
      host.appendChild(el("p", { class: "muted" }, [
        doc.createTextNode("Rules from the README of "),
        link("https://github.com/RonitSachdev/aws-saa-c03-guides", "aws-saa-c03-guides"),
        doc.createTextNode(" by RonitSachdev, "),
        link("https://creativecommons.org/licenses/by/4.0/", "CC BY 4.0"),
        doc.createTextNode(". "),
        link("../content/saa-c03/ATTRIBUTION.md", "Attribution record"),
        doc.createTextNode("."),
      ]));
    }

    /* ----- pages ----- */
    function pageHome(host) {
      host.appendChild(el("h1", { text: "Exam technique" }));
      host.appendChild(el("p", { text: "Six rules for reading exam questions, a drill for spotting poison qualifiers, and a deck of the classic traps." }));
      var ol = el("ol", { class: "tq-rules" });
      A.RULES.forEach(function (r) {
        var p = A.ruleParts(r);
        ol.appendChild(el("li", {}, [link(A.ruleHref(r.n), p.title)]));
      });
      host.appendChild(ol);
      host.appendChild(el("div", { class: "panel" }, [
        el("h2", { text: "Practise" }),
        el("p", {}, [link("#/technique/drill", "Poison-qualifier drill", "btn")]),
        el("p", {}, [link("#/technique/traps", "Trap review deck", "btn ghost")]),
      ]));
      credit(host);
    }

    function pageRule(host, n) {
      var r = A.RULES[n - 1], p = A.ruleParts(r);
      host.appendChild(el("p", {}, [link("#/technique", "← All techniques")]));
      host.appendChild(el("h1", { text: "Rule " + n + " of " + A.RULES.length + ": " + p.title }));
      if (p.body) host.appendChild(el("p", { class: "tq-body", text: p.body }));
      var notes = A.GUIDE_NOTES[n];
      if (notes) {
        var box = el("div", { class: "panel" }, [el("h2", { text: "What the Exam Traps guide says" })]);
        var ul = el("ul");
        notes.forEach(function (nt) { ul.appendChild(el("li", { text: A.plain(nt.text) + " (line " + nt.line + ")" })); });
        box.appendChild(ul);
        box.appendChild(el("p", {}, [link(A.guideLink(A.GUIDE36, "Exam technique (the meta-game)"), "Open the guide section")]));
        host.appendChild(box);
      }
      if (n === 3) {
        host.appendChild(el("p", { class: "notice", text: "The README's list: " + A.QUALIFIERS.join(", ") + "." }));
        host.appendChild(el("p", {}, [link("#/technique/drill", "Try the poison-qualifier drill", "btn")]));
      }
      var row = el("div", { class: "pager" });
      row.appendChild(n > 1 ? link(A.ruleHref(n - 1), "← Rule " + (n - 1), "btn ghost") : el("span"));
      row.appendChild(n < A.RULES.length ? link(A.ruleHref(n + 1), "Rule " + (n + 1) + " →", "btn") : link("#/technique/traps", "Trap review deck →", "btn"));
      host.appendChild(row);
      credit(host);
    }

    function wordButton(key, text) {
      var b = el("button", { type: "button", class: "tq-w", "aria-pressed": ui.taps[key] ? "true" : "false", text: text });
      if (ui.taps[key]) b.className += " on";
      b.addEventListener("click", function () {
        if (ui.checked) return;
        if (ui.taps[key]) delete ui.taps[key]; else ui.taps[key] = true;
        var on = !!ui.taps[key];
        b.setAttribute("aria-pressed", on ? "true" : "false");
        b.className = "tq-w" + (on ? " on" : "");
      });
      return b;
    }
    function pageDrill(host) {
      host.appendChild(el("p", {}, [link("#/technique", "← All techniques")]));
      host.appendChild(el("h1", { text: "Poison-qualifier drill" }));
      var ds = ui.drills;
      if (!ds || !ds.length) { host.appendChild(el("p", { class: "notice", text: "No questions with a qualifier word could be loaded." })); return; }
      var d = ds[ui.di % ds.length];
      host.appendChild(el("p", { text: "Tap every word that could be a poison qualifier in the question and the four options, then check. Checked only against the README list: " + A.QUALIFIERS.join(", ") + "." }));
      host.appendChild(el("p", { class: "muted", text: "Question " + (ui.di % ds.length + 1) + " of " + ds.length + ". Questions are candidates." }));
      var result = ui.checked ? A.checkTaps(d, Object.keys(ui.taps)) : null;
      var resKeys = {};
      if (result) {
        result.hit.forEach(function (w) { resKeys[w.key] = "hit"; });
        result.missed.forEach(function (w) { resKeys[w.key] = "missed"; });
        result.wrong.forEach(function (w) { resKeys[w.key] = "wrong"; });
      }
      d.parts.forEach(function (p, pi) {
        var para = el("p", { class: "tq-part" }, [el("strong", { text: p.label + ": " })]);
        p.segments.forEach(function (s, si) {
          if (!s.word) { para.appendChild(doc.createTextNode(s.text)); return; }
          var key = pi + ":" + si;
          if (!result) { para.appendChild(wordButton(key, s.text)); return; }
          var tag = resKeys[key], mark = { hit: " (found)", missed: " (missed)", wrong: " (not on the list)" }[tag] || "";
          para.appendChild(el("span", { class: "tq-w done " + (tag || ""), text: s.text + mark }));
        });
        host.appendChild(para);
      });
      var row = el("div", { class: "pager" });
      if (!result) {
        var chk = el("button", { type: "button", class: "btn", id: "tq-check", text: "Check" });
        chk.addEventListener("click", function () { ui.checked = true; draw(); focusEl("#tq-result"); });
        row.appendChild(chk);
      } else {
        var panel = el("div", { class: "panel", id: "tq-result", tabindex: "-1" }, [
          el("p", { text: result.perfect ? "All " + result.expected + " qualifier word" + (result.expected === 1 ? "" : "s") + " found, none extra."
            : "Found " + result.hit.length + " of " + result.expected + ". Missed: " + (result.missed.map(function (w) { return w.text; }).join(", ") || "none") +
              ". Not on the list: " + (result.wrong.map(function (w) { return w.text; }).join(", ") || "none") + "." }),
          el("p", { class: "muted", text: "Qualifier words are not always wrong; they are the words to check against the facts." }),
        ]);
        host.appendChild(panel);
      }
      var nx = el("button", { type: "button", class: result ? "btn" : "btn ghost", text: result ? "Next question →" : "Skip →" });
      nx.addEventListener("click", function () { ui.di += 1; ui.taps = {}; ui.checked = false; draw(); focusEl("#tq-check"); });
      row.appendChild(nx);
      host.appendChild(row);
    }

    function pageTraps(host) {
      host.appendChild(el("p", {}, [link("#/technique", "← All techniques")]));
      host.appendChild(el("h1", { text: "Trap review deck" }));
      var deck = ui.deck;
      if (!deck || !deck.length) { host.appendChild(el("p", { class: "notice", text: "The trap deck could not be built." })); return; }
      var c = deck[ui.ci];
      host.appendChild(el("p", { class: "muted", text: "Card " + (ui.ci + 1) + " of " + deck.length + ": the traps in guide 36 and every TRAP row of the question bank." }));
      var card = el("section", { class: "panel tq-card", "aria-label": "Trap card " + (ui.ci + 1) }, [
        el("p", { class: "dr-label", text: "The trap" }),
        el("h2", { id: "tq-front", tabindex: "-1", text: c.front }),
      ]);
      if (ui.shown) {
        card.appendChild(el("p", { class: "dr-label", text: "The truth" }));
        card.appendChild(el("p", { class: "dr-answer", text: c.back }));
        card.appendChild(el("p", { class: "muted" }, [doc.createTextNode(c.label + ". "), link(A.guideLink(c.guide, c.section), "Open in the guide")]));
      } else {
        var sh = el("button", { type: "button", class: "btn", id: "tq-show", text: "Show the truth" });
        sh.addEventListener("click", function () { ui.shown = true; draw(); focusEl("#tq-front"); });
        card.appendChild(sh);
      }
      host.appendChild(card);
      var row = el("div", { class: "pager" });
      var pv = el("button", { type: "button", class: "btn ghost", text: "← Previous" });
      if (ui.ci === 0) pv.setAttribute("disabled", "disabled");
      pv.addEventListener("click", function () { ui.ci -= 1; ui.shown = false; draw(); focusEl("#tq-front"); });
      var nx = el("button", { type: "button", class: "btn", text: "Next →" });
      if (ui.ci === deck.length - 1) nx.setAttribute("disabled", "disabled");
      nx.addEventListener("click", function () { ui.ci += 1; ui.shown = false; draw(); focusEl("#tq-front"); });
      row.appendChild(pv); row.appendChild(nx);
      host.appendChild(row);
      var sel = el("select", { id: "tq-jump" });
      deck.forEach(function (k, i) {
        var o = el("option", { value: String(i), text: (i + 1) + ". " + k.front });
        if (i === ui.ci) o.setAttribute("selected", "selected");
        sel.appendChild(o);
      });
      sel.addEventListener("change", function () { ui.ci = parseInt(sel.value, 10); ui.shown = false; draw(); focusEl("#tq-front"); });
      host.appendChild(el("p", {}, [el("label", { for: "tq-jump", text: "Go to card " }), sel]));
    }

    /* ----- routing ----- */
    function draw() {
      var rt = A.parseRoute(w.location.hash);
      var host = doc.getElementById("tq-root");
      if (!host) { host = el("div", { id: "tq-root" }); main.appendChild(host); }
      while (host.firstChild) host.removeChild(host.firstChild);
      if (rt.page === "rule") pageRule(host, rt.n);
      else if (rt.page === "drill") pageDrill(host);
      else if (rt.page === "traps") pageTraps(host);
      else pageHome(host);
    }
    function titleFor(rt) {
      return { rule: "Rule " + rt.n, drill: "Poison-qualifier drill", traps: "Trap review deck" }[rt.page] || "Exam technique";
    }
    function paint() {
      var rt = A.parseRoute(w.location.hash);
      if (rt.page === "none") return Promise.resolve();
      doc.title = titleFor(rt) + " · SAA-C03 Study Site";
      var need = rt.page === "drill" ? loadDrills().then(function (d) { if (!ui.drills) { ui.drills = d.slice().sort(function () { return Math.random() - 0.5; }); } })
        : rt.page === "traps" ? loadDeck().then(function (d) { ui.deck = d; })
        : Promise.resolve();
      return need.then(function () {
        if (A.parseRoute(w.location.hash).page === "none") return;
        while (main.firstChild) main.removeChild(main.firstChild);
        draw();
      }, function (e) {
        while (main.firstChild) main.removeChild(main.firstChild);
        main.appendChild(el("h1", { text: "Exam technique" }));
        main.appendChild(el("p", { class: "notice", text: "This page could not load (" + e.message + ")." }));
      });
    }
    function show() {
      if (observer) { observer.disconnect(); observer = null; }
      if (A.parseRoute(w.location.hash).page === "none") return;
      ui.taps = {}; ui.checked = false; ui.shown = false;
      // Hop one task so the shell's own "coming soon" render lands first, then replace it.
      w.setTimeout(function () {
        paint().then(function () {
          if (A.parseRoute(w.location.hash).page === "none") return;
          observer = new w.MutationObserver(function () {
            if (A.parseRoute(w.location.hash).page !== "none" && !doc.getElementById("tq-root")) {
              observer.disconnect(); paint().then(function () { if (observer) observer.observe(main, { childList: true }); });
            }
          });
          observer.observe(main, { childList: true });
        });
      }, 0);
    }
    w.addEventListener("hashchange", show);
    show();
  }
});
