/* Pure logic for the lesson reader. No DOM access, so node --test can run it.
 * Works in the browser (window.ReaderLogic) and in node (module.exports). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ReaderLogic = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var PROGRESS_KEY = "lf.saa-c03.progress.v1";
  var THEME_KEY = "lf.theme";

  /** Flatten syllabus groups into one list in reading order. */
  function lessonsInOrder(syllabus) {
    var out = [];
    (syllabus.groups || []).forEach(function (group) {
      (group.guides || []).forEach(function (guide) {
        out.push({
          order: guide.order,
          number: guide.guide_number,
          title: guide.title,
          file: guide.file,
          owns: guide.owns_questions_about,
          group: group.name,
        });
      });
    });
    out.sort(function (a, b) { return a.order - b.order; });
    return out;
  }

  /** Group lessons back into the syllabus groups, keeping order. */
  function groupedLessons(syllabus) {
    return (syllabus.groups || []).map(function (group) {
      return {
        name: group.name,
        lessons: lessonsInOrder({ groups: [group] }),
      };
    });
  }

  /** Stable anchor id for a heading: lower case, words joined by dashes. */
  function sectionSlug(text) {
    var slug = String(text)
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return slug || "section";
  }

  /** Give duplicate slugs a numeric suffix so ids stay unique. */
  function uniqueSlugs(headings) {
    var seen = {};
    return headings.map(function (text) {
      var base = sectionSlug(text);
      seen[base] = (seen[base] || 0) + 1;
      return seen[base] === 1 ? base : base + "-" + seen[base];
    });
  }

  /** Next and previous lesson files, or null at either end. */
  function neighbours(lessons, file) {
    var i = lessons.findIndex(function (l) { return l.file === file; });
    if (i < 0) return { prev: null, next: null };
    return {
      prev: i > 0 ? lessons[i - 1] : null,
      next: i < lessons.length - 1 ? lessons[i + 1] : null,
    };
  }

  /** Progress store. Every storage call is wrapped, so a blocked or full
   *  storage never breaks the site: progress then lives in memory only. */
  function createProgress(storage) {
    var memory = {};
    var persistent = false;
    try {
      if (storage) {
        var raw = storage.getItem(PROGRESS_KEY);
        if (raw) memory = JSON.parse(raw) || {};
        persistent = true;
      }
    } catch (e) {
      memory = {};
      persistent = false;
    }
    if (typeof memory !== "object" || memory === null || Array.isArray(memory)) memory = {};

    function save() {
      if (!storage) return;
      try {
        storage.setItem(PROGRESS_KEY, JSON.stringify(memory));
        persistent = true;
      } catch (e) {
        persistent = false;
      }
    }
    function entry(file) {
      if (!memory[file] || typeof memory[file] !== "object") memory[file] = { total: 0, done: {} };
      if (!memory[file].done || typeof memory[file].done !== "object") memory[file].done = {};
      return memory[file];
    }

    return {
      /** Record how many sections a guide has (known once it is rendered). */
      setTotal: function (file, total) { entry(file).total = total; save(); },
      mark: function (file, slug, isRead) {
        var e = entry(file);
        if (isRead) e.done[slug] = 1; else delete e.done[slug];
        save();
      },
      isRead: function (file, slug) { return !!(memory[file] && memory[file].done && memory[file].done[slug]); },
      summary: function (file) {
        var e = memory[file];
        var done = e && e.done ? Object.keys(e.done).length : 0;
        var total = e && e.total ? e.total : 0;
        return { done: done, total: total, complete: total > 0 && done >= total };
      },
      completeCount: function (files) {
        var self = this;
        return files.filter(function (f) { return self.summary(f).complete; }).length;
      },
      isPersistent: function () { return persistent; },
    };
  }

  /** Read and write the theme choice without ever throwing. */
  function readTheme(storage) {
    try {
      var t = storage && storage.getItem(THEME_KEY);
      return t === "light" || t === "dark" ? t : null;
    } catch (e) {
      return null;
    }
  }
  function writeTheme(storage, theme) {
    try { if (storage) storage.setItem(THEME_KEY, theme); } catch (e) { /* ignore */ }
  }

  /** Parse a location hash such as "#/learn/content/saa-c03/02-S3.md#pocket-card". */
  function parseRoute(hash) {
    var h = String(hash || "").replace(/^#\/?/, "");
    var anchor = null;
    var i = h.indexOf("#");
    if (i >= 0) { anchor = h.slice(i + 1); h = h.slice(0, i); }
    var parts = h.split("/").filter(Boolean);
    if (parts.length === 0) return { view: "home" };
    if (parts[0] === "learn" && parts.length > 1) {
      return { view: "lesson", file: decodeURIComponent(parts.slice(1).join("/")), anchor: anchor };
    }
    return { view: parts[0], anchor: anchor };
  }

  return {
    PROGRESS_KEY: PROGRESS_KEY,
    lessonsInOrder: lessonsInOrder,
    groupedLessons: groupedLessons,
    sectionSlug: sectionSlug,
    uniqueSlugs: uniqueSlugs,
    neighbours: neighbours,
    createProgress: createProgress,
    readTheme: readTheme,
    writeTheme: writeTheme,
    parseRoute: parseRoute,
  };
});
