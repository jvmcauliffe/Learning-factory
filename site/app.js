/* SAA-C03 study site shell and lesson reader. No build step.
 * Loads data/saa-c03/syllabus.json and content/saa-c03/*.md from the repository,
 * so serve the repository root (python3 -m http.server) and open /site/. */
(function () {
  "use strict";
  var L = window.ReaderLogic;
  var main = document.getElementById("main");
  var store = null;
  try { store = window.localStorage; } catch (e) { store = null; }
  var progress = L.createProgress(store);
  var syllabus = null;
  var lessons = [];
  var textCache = {};

  var COMING = {
    flashcards: "Flashcards with spaced repetition",
    drills: "Scenario drills",
    exam: "Timed practice exam",
    technique: "Exam technique trainer",
    progress: "Progress dashboard",
  };

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") node.textContent = attrs[k];
      else if (k === "class") node.className = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { node.appendChild(c); });
    return node;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function fetchText(url) {
    if (textCache[url]) return Promise.resolve(textCache[url]);
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + " returned " + r.status);
      return r.text();
    }).then(function (t) { textCache[url] = t; return t; });
  }

  function loadSyllabus() {
    if (syllabus) return Promise.resolve(syllabus);
    return fetchText("../data/saa-c03/syllabus.json").then(function (t) {
      syllabus = JSON.parse(t);
      lessons = L.lessonsInOrder(syllabus);
      return syllabus;
    });
  }

  function setNav(view) {
    var active = view === "lesson" ? "learn" : view;
    document.querySelectorAll("nav a").forEach(function (a) {
      if (a.getAttribute("data-nav") === active) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  function showError(message) {
    clear(main);
    main.appendChild(el("h1", { text: "Something went wrong" }));
    main.appendChild(el("p", { text: message }));
    main.appendChild(el("p", {}, [el("a", { href: "#/", text: "Back to the start" })]));
  }

  function storageNotice() {
    if (progress.isPersistent()) return null;
    return el("p", { class: "notice", text: "Your browser is blocking storage, so progress will not be saved after you close this tab." });
  }

  function renderHome() {
    document.title = "SAA-C03 Study Site";
    clear(main);
    var done = progress.completeCount(lessons.map(function (l) { return l.file; }));
    main.appendChild(el("h1", { text: "AWS Solutions Architect Associate (SAA-C03)" }));
    main.appendChild(el("p", { class: "muted", text: "37 topic guides in the recommended reading order. Read a lesson, tick each section when you have finished it." }));
    var n = storageNotice();
    if (n) main.appendChild(n);
    main.appendChild(el("div", { class: "panel" }, [
      el("p", { text: done + " of " + lessons.length + " guides complete." }),
      el("a", { class: "btn", href: "#/learn", text: done ? "Continue learning" : "Start learning" }),
    ]));
  }

  function renderLearn() {
    document.title = "Learn · SAA-C03 Study Site";
    clear(main);
    main.appendChild(el("h1", { text: "Learn" }));
    var n = storageNotice();
    if (n) main.appendChild(n);
    L.groupedLessons(syllabus).forEach(function (group) {
      main.appendChild(el("h2", { class: "group", text: group.name }));
      var ul = el("ul", { class: "lessons" });
      group.lessons.forEach(function (lesson) {
        var s = progress.summary(lesson.file);
        var state = s.complete ? "Done" : (s.done ? s.done + "/" + (s.total || "?") : "");
        var a = el("a", { href: "#/learn/" + encodeURI(lesson.file) }, [
          el("span", { class: "state", text: state }),
          el("span", { class: "num", text: lesson.number }),
          el("strong", { text: lesson.title }),
          el("span", { class: "owns", text: lesson.owns }),
        ]);
        ul.appendChild(el("li", { class: s.complete ? "done" : "" }, [a]));
      });
      main.appendChild(ul);
    });
  }

  function renderComing(view) {
    var name = COMING[view];
    document.title = (name || "Not found") + " · SAA-C03 Study Site";
    clear(main);
    if (!name) {
      main.appendChild(el("h1", { text: "Page not found" }));
      main.appendChild(el("p", {}, [el("a", { href: "#/", text: "Back to the start" })]));
      return;
    }
    main.appendChild(el("h1", { text: name }));
    main.appendChild(el("p", { class: "notice", text: "Coming soon. This part of the site is built in a later step." }));
  }

  function internalLessonFile(href) {
    var m = /^(?:\.\/)?(\d\d-[^#?\/]+\.md)(#.*)?$/.exec(href || "");
    return m ? { file: "content/saa-c03/" + m[1], anchor: m[2] ? m[2].slice(1) : null } : null;
  }

  function renderLesson(route) {
    var lesson = lessons.filter(function (l) { return l.file === route.file; })[0];
    if (!lesson) { renderComing("missing"); return Promise.resolve(); }
    document.title = lesson.number + " " + lesson.title + " · SAA-C03 Study Site";
    clear(main);
    main.appendChild(el("p", { class: "muted", text: "Loading " + lesson.title + "…" }));
    return fetchText("../" + lesson.file).then(function (md) {
      var article = el("article", { class: "lesson" });
      if (window.marked) {
        article.innerHTML = window.marked.parse(md);
      } else {
        article.appendChild(el("p", { class: "notice", text: "The markdown library could not be loaded, so the lesson is shown as plain text." }));
        article.appendChild(el("pre", { text: md }));
      }
      clear(main);
      main.appendChild(el("p", { class: "muted" }, [el("a", { href: "#/learn", text: "← All lessons" })]));
      var n = storageNotice();
      if (n) main.appendChild(n);
      main.appendChild(article);

      var h2s = Array.prototype.slice.call(article.querySelectorAll("h2"));
      var slugs = L.uniqueSlugs(h2s.map(function (h) { return h.textContent; }));
      progress.setTotal(lesson.file, h2s.length);
      var jump = el("ul", { class: "jump", "aria-label": "Sections in this lesson" });
      h2s.forEach(function (h, i) {
        var slug = slugs[i];
        h.id = slug;
        var box = el("input", { type: "checkbox", "aria-label": "Mark “" + h.textContent + "” as read" });
        box.checked = progress.isRead(lesson.file, slug);
        box.addEventListener("change", function () {
          progress.mark(lesson.file, slug, box.checked);
        });
        h.appendChild(el("label", { class: "markread" }, [box, document.createTextNode("Read")]));
        jump.appendChild(el("li", {}, [el("a", { href: "#/learn/" + encodeURI(lesson.file) + "#" + slug, "data-jump": slug, text: h.firstChild.textContent })]));
      });
      article.insertBefore(jump, article.querySelector("h2"));

      article.querySelectorAll("a[href]").forEach(function (a) {
        var target = internalLessonFile(a.getAttribute("href"));
        if (target) {
          a.setAttribute("href", "#/learn/" + encodeURI(target.file) + (target.anchor ? "#" + target.anchor : ""));
        } else if (/^https?:/.test(a.getAttribute("href"))) {
          a.setAttribute("rel", "noopener noreferrer");
        }
      });

      var nb = L.neighbours(lessons, lesson.file);
      var pager = el("div", { class: "pager" });
      pager.appendChild(nb.prev
        ? el("a", { class: "btn ghost", href: "#/learn/" + encodeURI(nb.prev.file), text: "← " + nb.prev.title })
        : el("span"));
      if (nb.next) pager.appendChild(el("a", { class: "btn", href: "#/learn/" + encodeURI(nb.next.file), text: nb.next.title + " →" }));
      main.appendChild(pager);

      if (route.anchor) {
        var target = document.getElementById(route.anchor);
        if (target) target.scrollIntoView();
      } else {
        window.scrollTo(0, 0);
      }
    });
  }

  function route() {
    var r = L.parseRoute(window.location.hash);
    setNav(r.view);
    // A same-page section jump needs no re-render.
    if (r.view === "lesson" && main.querySelector("article.lesson") && main.getAttribute("data-file") === r.file) {
      var t = r.anchor && document.getElementById(r.anchor);
      if (t) t.scrollIntoView();
      return;
    }
    main.removeAttribute("data-file");
    loadSyllabus().then(function () {
      if (r.view === "home") renderHome();
      else if (r.view === "learn") renderLearn();
      else if (r.view === "lesson") { main.setAttribute("data-file", r.file); return renderLesson(r); }
      else renderComing(r.view);
    }).catch(function (e) {
      showError("The lesson data could not be loaded (" + e.message + "). Serve the repository root with “python3 -m http.server” and open /site/.");
    });
  }

  function applyTheme(theme) {
    if (theme) document.documentElement.setAttribute("data-theme", theme);
    else document.documentElement.removeAttribute("data-theme");
  }
  applyTheme(L.readTheme(store));
  document.getElementById("theme").addEventListener("click", function () {
    var current = document.documentElement.getAttribute("data-theme");
    if (!current) current = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    var next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    L.writeTheme(store, next);
  });

  window.addEventListener("hashchange", route);
  route();
})();
