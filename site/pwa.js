/* Registers the service worker so the site works offline after one visit.
 * Service workers need https or localhost; elsewhere (for example file://) this does nothing. */
(function () {
  "use strict";
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  var loc = window.location;
  var local = loc.hostname === "localhost" || loc.hostname === "127.0.0.1" || loc.hostname === "[::1]";
  if (loc.protocol !== "https:" && !local) return;
  window.addEventListener("load", function () {
    try {
      navigator.serviceWorker.register("sw.js").catch(function () { /* offline use is optional */ });
    } catch (e) { /* ignore */ }
  });
})();
