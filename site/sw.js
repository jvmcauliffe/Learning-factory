/* Service worker for the SAA-C03 study site: it makes the site work offline after one visit.
 *
 * Content (lessons, question data, glossary) is cached first-hand and served from the
 * cache. The cache name carries the upstream guides commit and a hash of every content
 * file, so changed content gets a new cache and the old one is deleted on activate.
 * Site code (HTML, CSS, JS) is served from the cache and refreshed in the background.
 *
 * CONTENT_FILES must list every file the site fetches. site/tests/sw.test.js checks the
 * list against syllabus.json and the data folder, and recomputes CONTENT_HASH; when it
 * fails after a content change, update CONTENT_FILES and CONTENT_HASH as it reports.
 */
"use strict";

var UPSTREAM_COMMIT = "a71e466";
var CONTENT_HASH = "c21f33c4";
var CONTENT_VERSION = UPSTREAM_COMMIT + "-" + CONTENT_HASH;
var CACHE_PREFIX = "lf-saa-c03-";
var CACHE_NAME = CACHE_PREFIX + CONTENT_VERSION;

/* Paths are relative to the repository root; the site lives one folder down, at /site/. */
var CONTENT_FILES = [
  "data/saa-c03/syllabus.json",
  "data/saa-c03/bank.json",
  "data/saa-c03/glossary.json",
  "data/saa-c03/exam-facts.json",
  "data/saa-c03/mcq/06-VPC.json",
  "data/saa-c03/mcq/02-S3.json",
  "data/saa-c03/mcq/03-EC2.json",
  "data/saa-c03/mcq/04-EBS-EFS-InstanceStore.json",
  "data/saa-c03/mcq/05-ELB-AutoScaling.json",
  "data/saa-c03/mcq/01-IAM.json",
  "data/saa-c03/mcq/09-RDS-Aurora.json",
  "data/saa-c03/mcq/10-DynamoDB.json",
  "data/saa-c03/mcq/11-ElastiCache.json",
  "data/saa-c03/mcq/12-Other-Databases.json",
  "data/saa-c03/mcq/13-Lambda.json",
  "data/saa-c03/mcq/14-ECS-EKS-Fargate.json",
  "data/saa-c03/mcq/15-Elastic-Beanstalk.json",
  "data/saa-c03/mcq/16-API-Gateway.json",
  "data/saa-c03/mcq/17-SQS-SNS-Kinesis.json",
  "data/saa-c03/mcq/18-EventBridge-StepFunctions.json",
  "data/saa-c03/mcq/07-Route53.json",
  "data/saa-c03/mcq/08-CloudFront-GlobalAccelerator.json",
  "data/saa-c03/mcq/32-DirectConnect-VPN.json",
  "data/saa-c03/mcq/33-Transit-Gateway.json",
  "data/saa-c03/mcq/20-KMS-CloudHSM.json",
  "data/saa-c03/mcq/21-SecretsManager-ParameterStore.json",
  "data/saa-c03/mcq/22-WAF-Shield-SecurityServices.json",
  "data/saa-c03/mcq/23-Cognito.json",
  "data/saa-c03/mcq/24-Directory-Services.json",
  "data/saa-c03/mcq/19-CloudWatch-CloudTrail-Config.json",
  "data/saa-c03/mcq/28-CloudFormation.json",
  "data/saa-c03/mcq/29-Organizations-ControlTower.json",
  "data/saa-c03/mcq/30-ServiceCatalog-TrustedAdvisor.json",
  "data/saa-c03/mcq/31-Cost-Management.json",
  "data/saa-c03/mcq/25-StorageGateway-DataSync-TransferFamily.json",
  "data/saa-c03/mcq/26-FSx.json",
  "data/saa-c03/mcq/27-Snow-Family.json",
  "data/saa-c03/mcq/34-Well-Architected.json",
  "data/saa-c03/mcq/35-Disaster-Recovery.json",
  "data/saa-c03/mcq/37-GapFill-Services.json",
  "data/saa-c03/mcq/36-Exam-Traps-KeyPatterns.json",
  "content/saa-c03/06-VPC.md",
  "content/saa-c03/02-S3.md",
  "content/saa-c03/03-EC2.md",
  "content/saa-c03/04-EBS-EFS-InstanceStore.md",
  "content/saa-c03/05-ELB-AutoScaling.md",
  "content/saa-c03/01-IAM.md",
  "content/saa-c03/09-RDS-Aurora.md",
  "content/saa-c03/10-DynamoDB.md",
  "content/saa-c03/11-ElastiCache.md",
  "content/saa-c03/12-Other-Databases.md",
  "content/saa-c03/13-Lambda.md",
  "content/saa-c03/14-ECS-EKS-Fargate.md",
  "content/saa-c03/15-Elastic-Beanstalk.md",
  "content/saa-c03/16-API-Gateway.md",
  "content/saa-c03/17-SQS-SNS-Kinesis.md",
  "content/saa-c03/18-EventBridge-StepFunctions.md",
  "content/saa-c03/07-Route53.md",
  "content/saa-c03/08-CloudFront-GlobalAccelerator.md",
  "content/saa-c03/32-DirectConnect-VPN.md",
  "content/saa-c03/33-Transit-Gateway.md",
  "content/saa-c03/20-KMS-CloudHSM.md",
  "content/saa-c03/21-SecretsManager-ParameterStore.md",
  "content/saa-c03/22-WAF-Shield-SecurityServices.md",
  "content/saa-c03/23-Cognito.md",
  "content/saa-c03/24-Directory-Services.md",
  "content/saa-c03/19-CloudWatch-CloudTrail-Config.md",
  "content/saa-c03/28-CloudFormation.md",
  "content/saa-c03/29-Organizations-ControlTower.md",
  "content/saa-c03/30-ServiceCatalog-TrustedAdvisor.md",
  "content/saa-c03/31-Cost-Management.md",
  "content/saa-c03/25-StorageGateway-DataSync-TransferFamily.md",
  "content/saa-c03/26-FSx.md",
  "content/saa-c03/27-Snow-Family.md",
  "content/saa-c03/34-Well-Architected.md",
  "content/saa-c03/35-Disaster-Recovery.md",
  "content/saa-c03/37-GapFill-Services.md",
  "content/saa-c03/36-Exam-Traps-KeyPatterns.md",
  "content/saa-c03/ATTRIBUTION.md",
];

/* Paths relative to the service worker (the /site/ folder). */
var SHELL_FILES = [
  "./",
  "index.html",
  "styles.css",
  "reader-logic.js",
  "app.js",
  "flashcards.js",
  "drills.js",
  "exam.js",
  "technique.js",
  "progress.js",
  "glossary.js",
  "bookmarks.js",
  "pwa.js",
  "manifest.json",
  "icon.svg",
  "icon-192.png",
  "icon-512.png"
];

var MARKED_URL = "https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js";

if (typeof self !== "undefined" && typeof self.addEventListener === "function" && typeof caches !== "undefined") {
  var BASE = new URL("./", self.location.href);
  var contentUrls = CONTENT_FILES.map(function (f) { return new URL("../" + f, BASE).href; });
  var shellUrls = SHELL_FILES.map(function (f) { return new URL(f, BASE).href; });
  var indexUrl = new URL("index.html", BASE).href;

  self.addEventListener("install", function (event) {
    event.waitUntil(caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(contentUrls.concat(shellUrls)).then(function () {
        // The markdown library is on a CDN. Cache it if we can; the site still works as plain text without it.
        return fetch(MARKED_URL, { mode: "cors", integrity: "sha384-/TQbtLCAerC3jgaim+N78RZSDYV7ryeoBCVqTuzRrFec2akfBkHS7ACQ3PQhvMVi" })
          .then(function (r) { if (r.ok) return cache.put(MARKED_URL, r); })
          .catch(function () {});
      });
    }).then(function () { return self.skipWaiting(); }));
  });

  self.addEventListener("activate", function (event) {
    event.waitUntil(caches.keys().then(function (names) {
      return Promise.all(names.filter(function (n) { return n.indexOf(CACHE_PREFIX) === 0 && n !== CACHE_NAME; })
        .map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); }));
  });

  self.addEventListener("fetch", function (event) {
    var req = event.request;
    if (req.method !== "GET") return;
    var url = req.url.split("#")[0];
    if (req.mode === "navigate") { event.respondWith(navigate(req)); return; }
    if (contentUrls.indexOf(url) !== -1 || url === MARKED_URL) { event.respondWith(cacheFirst(req, url)); return; }
    if (shellUrls.indexOf(url) !== -1) { event.respondWith(staleWhileRevalidate(req, url)); return; }
  });

  var cacheFirst = function (req, url) {
    return caches.open(CACHE_NAME).then(function (cache) {
      return cache.match(url).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (res) { if (res.ok) cache.put(url, res.clone()); return res; });
      });
    });
  };

  var staleWhileRevalidate = function (req, url) {
    return caches.open(CACHE_NAME).then(function (cache) {
      return cache.match(url).then(function (hit) {
        var net = fetch(req).then(function (res) { if (res.ok) cache.put(url, res.clone()); return res; });
        if (hit) { net.catch(function () {}); return hit; }
        return net;
      });
    });
  };

  var navigate = function (req) {
    return fetch(req).catch(function () {
      return caches.open(CACHE_NAME).then(function (cache) { return cache.match(indexUrl).then(function (hit) { return hit || cache.match(req.url.split("#")[0]); }); });
    });
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { UPSTREAM_COMMIT: UPSTREAM_COMMIT, CONTENT_HASH: CONTENT_HASH, CONTENT_VERSION: CONTENT_VERSION, CACHE_NAME: CACHE_NAME, CONTENT_FILES: CONTENT_FILES, SHELL_FILES: SHELL_FILES, MARKED_URL: MARKED_URL };
}
