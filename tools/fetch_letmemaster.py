#!/usr/bin/env python3
"""Polite, resumable fetcher for letmemaster.com (standard library only).

It runs only while docs/permissions/letmemaster.md is committed and records the
site owner's name, the date and a scope that covers automated fetching. It reads
robots.txt and the sitemap, fetches only sitemap URLs on the permitted host,
waits at least two seconds between requests, retries transient errors with
back-off, stops at a page cap and saves each raw page under raw/letmemaster/.

If the environment variable LETMEMASTER_COOKIE is set, its value is sent as the
Cookie header on requests to the permitted host only. It is never printed,
logged, written to the manifest or saved anywhere.

Raw pages stay on disk under raw/ (git-ignored). Nothing here is committed.
Fetched content is a candidate only; facts stay unverified until John verifies
them. Credit: content from letmemaster.com, operated by Jeremy ("Let me master").
"""
from __future__ import annotations

import argparse
import hashlib
import http.client
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PERMISSION_FILE = ROOT / "docs" / "permissions" / "letmemaster.md"
RAW_DIR = ROOT / "raw" / "letmemaster"
BASE_URL = "https://letmemaster.com"
ALLOWED_HOSTS = frozenset({"letmemaster.com", "www.letmemaster.com"})
USER_AGENT = (
    "learning-factory-fetcher/1.0 (personal study project; site owner's written "
    "permission on file; +https://github.com/jvmcauliffe/learning-factory)"
)
MIN_DELAY = 2.0          # seconds between the start of one request and the next
TIMEOUT = 30             # seconds for one request
MAX_BYTES = 5 * 1024 * 1024
MAX_SITEMAPS = 20
RETRIES = 3              # retries after the first attempt, for transient errors
BACKOFF = 2.0            # seconds, doubled each retry
MAX_RETRY_AFTER = 60.0
MAX_REDIRECTS = 3
TRANSIENT_STATUS = frozenset({429, 500, 502, 503, 504})
REDIRECT_STATUS = frozenset({301, 302, 303, 307, 308})


class PermissionRefused(Exception):
    """The written permission record is missing or does not cover fetching."""


class FetchStop(Exception):
    """A condition that must stop the whole run."""


def check_permission(path=PERMISSION_FILE):
    """Return the parsed permission fields, or raise PermissionRefused."""
    path = Path(path)
    if not path.is_file():
        raise PermissionRefused(
            f"{_shown(path)} is missing. John must commit the site owner's written "
            "permission (owner, date, scope) before any fetch."
        )
    fields = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.lstrip().startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) >= 2 and cells[0] and not set(cells[0]) <= set("-: "):
            fields.setdefault(cells[0].lower(), cells[1])
    scope = " ".join(v for k, v in fields.items() if k.startswith("scope"))
    problems = []
    if not fields.get("owner"):
        problems.append("an Owner row naming the site owner")
    if not re.search(r"\d{4}", fields.get("date", "")):
        problems.append("a Date row with the date of the permission")
    if not re.search(r"automated fetching|bulk fetch", scope, re.IGNORECASE):
        problems.append("a Scope row that covers automated fetching")
    if problems:
        raise PermissionRefused(f"{_shown(path)} lacks " + "; ".join(problems) + ".")
    return fields


def _shown(path):
    try:
        return str(Path(path).resolve().relative_to(ROOT))
    except ValueError:
        return str(path)


def slug_for(url):
    parts = urllib.parse.urlsplit(url)
    text = parts.netloc + parts.path + ("?" + parts.query if parts.query else "")
    stem = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:80] or "index"
    return f"{stem}-{hashlib.sha1(url.encode('utf-8')).hexdigest()[:8]}"


def _local(tag):
    return tag.rsplit("}", 1)[-1]


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Never follow a redirect on our own: the fetcher decides, host by host."""

    def redirect_request(self, *args, **kwargs):
        return None


class Fetcher:
    def __init__(self, base_url=BASE_URL, allowed_hosts=ALLOWED_HOSTS, raw_dir=RAW_DIR,
                 cookie=None, user_agent=USER_AGENT, clock=time.monotonic, sleep=time.sleep,
                 now=None):
        self.base_url = base_url.rstrip("/")
        self.allowed_hosts = frozenset(h.lower() for h in allowed_hosts)
        self.raw_dir = Path(raw_dir)
        self.pages_dir = self.raw_dir / "pages"
        self.manifest_path = self.raw_dir / "manifest.json"
        self.cookie = cookie or None
        self.user_agent = user_agent
        self.clock = clock
        self.sleep = sleep
        self.now = now or (lambda: datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))
        self.opener = urllib.request.build_opener(_NoRedirect)
        self.robots = None
        self.request_log = []   # (clock value, url) for every request, for audit and tests
        self._last = None

    # -- network -----------------------------------------------------------

    def permitted(self, url):
        parts = urllib.parse.urlsplit(url)
        return parts.scheme in ("http", "https") and parts.netloc.lower() in self.allowed_hosts

    def _throttle(self):
        if self._last is not None:
            wait = self._last + MIN_DELAY - self.clock()
            if wait > 0:
                self.sleep(wait)
        self._last = self.clock()

    def _request_once(self, url):
        req = urllib.request.Request(url, headers={
            "User-Agent": self.user_agent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        })
        if self.cookie and self.permitted(url):
            req.add_header("Cookie", self.cookie)
        self._throttle()
        self.request_log.append((self._last, url))
        try:
            with self.opener.open(req, timeout=TIMEOUT) as resp:
                return resp.status, resp.read(MAX_BYTES + 1), resp.headers
        except urllib.error.HTTPError as err:
            try:
                body = err.read(MAX_BYTES + 1)
            except OSError:
                body = b""
            return err.code, body, err.headers

    def _attempt(self, url):
        """One request with retries for transient failures."""
        last = None
        for attempt in range(RETRIES + 1):
            if attempt:
                delay = BACKOFF * (2 ** (attempt - 1))
                retry_after = (last or (None, None, {}))[2].get("Retry-After") if last else None
                if retry_after and retry_after.isdigit():
                    delay = max(delay, min(float(retry_after), MAX_RETRY_AFTER))
                self.sleep(delay)
            try:
                last = self._request_once(url)
            except (urllib.error.URLError, http.client.HTTPException, OSError):
                last = None
                continue
            if last[0] not in TRANSIENT_STATUS:
                return last
        if last is None:
            raise FetchStop(f"network error fetching {url} after {RETRIES} retries")
        return last

    def get(self, url, check_robots=True):
        """Fetch url, following redirects only to permitted, robots-allowed URLs.

        Returns (status, body, final_url).
        """
        hops = 0
        while True:
            status, body, headers = self._attempt(url)
            if status in REDIRECT_STATUS:
                target = urllib.parse.urljoin(url, headers.get("Location") or "")
                if (hops >= MAX_REDIRECTS or not headers.get("Location")
                        or not self.permitted(target)
                        or (check_robots and not self.robots_allows(target))):
                    return status, b"", url
                url, hops = target, hops + 1
                continue
            return status, body, url

    # -- robots and sitemap ------------------------------------------------

    def load_robots(self):
        status, body, _ = self.get(self.base_url + "/robots.txt", check_robots=False)
        rp = urllib.robotparser.RobotFileParser()
        if status == 200:
            rp.parse(body.decode("utf-8", "replace").splitlines())
        elif status in (404, 410):
            rp.parse([])
        else:
            raise FetchStop(f"robots.txt returned {status}; stopping rather than guess the rules")
        self.robots = rp

    def robots_allows(self, url):
        return self.robots is None or self.robots.can_fetch(self.user_agent, url)

    def sitemap_urls(self):
        queue = list(self.robots.site_maps() or []) or [self.base_url + "/sitemap.xml"]
        seen, urls, fetched = set(), [], 0
        while queue and fetched < MAX_SITEMAPS:
            sitemap = queue.pop(0)
            if sitemap in seen or not self.permitted(sitemap) or not self.robots_allows(sitemap):
                continue
            seen.add(sitemap)
            fetched += 1
            status, body, _ = self.get(sitemap)
            if status != 200 or len(body) > MAX_BYTES:
                continue
            try:
                root = ET.fromstring(body)
            except ET.ParseError:
                continue
            locs = [e.text.strip() for e in root.iter() if _local(e.tag) == "loc" and e.text]
            if _local(root.tag) == "sitemapindex":
                queue.extend(locs)
            else:
                urls.extend(locs)
        return list(dict.fromkeys(urls))

    # -- storage -----------------------------------------------------------

    def load_manifest(self):
        if self.manifest_path.is_file():
            return json.loads(self.manifest_path.read_text(encoding="utf-8"))
        return {"version": 1, "pages": {}}

    def save_manifest(self, manifest):
        self.raw_dir.mkdir(parents=True, exist_ok=True)
        tmp = self.manifest_path.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        tmp.replace(self.manifest_path)

    def _unchanged(self, entry):
        if not entry or entry.get("status") != 200 or not entry.get("file"):
            return False
        path = self.pages_dir / entry["file"]
        return path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest() == entry.get("sha256")

    # -- the run -----------------------------------------------------------

    def run(self, max_pages, refresh=False):
        if max_pages < 1:
            raise ValueError("max_pages must be at least 1")
        counts = {"fetched": 0, "unchanged": 0, "resumed": 0, "robots_skipped": 0,
                  "host_skipped": 0, "failed": 0}
        self.load_robots()
        manifest = self.load_manifest()
        urls = self.sitemap_urls()
        counts["sitemap_urls"] = len(urls)
        for url in urls:
            if not self.permitted(url):
                counts["host_skipped"] += 1
                continue
            if not self.robots_allows(url):
                counts["robots_skipped"] += 1
                continue
            entry = manifest["pages"].get(url)
            if not refresh and self._unchanged(entry):
                counts["resumed"] += 1
                continue
            if counts["fetched"] + counts["unchanged"] + counts["failed"] >= max_pages:
                break
            status, body, final = self.get(url)
            if status != 200 or len(body) > MAX_BYTES:
                counts["failed"] += 1
                manifest["pages"][url] = {"fetched_at": self.now(), "status": status,
                                          "file": None, "sha256": None}
                self.save_manifest(manifest)
                continue
            digest = hashlib.sha256(body).hexdigest()
            if entry and entry.get("sha256") == digest and self._unchanged(entry):
                counts["unchanged"] += 1
                continue
            name = slug_for(url) + ".html"
            self.pages_dir.mkdir(parents=True, exist_ok=True)
            (self.pages_dir / name).write_bytes(body)
            record = {"fetched_at": self.now(), "status": status, "file": name,
                      "sha256": digest, "bytes": len(body)}
            if final != url:
                record["final_url"] = final
            manifest["pages"][url] = record
            self.save_manifest(manifest)
            counts["fetched"] += 1
        return counts


def main(argv=None, permission_path=PERMISSION_FILE, raw_dir=RAW_DIR, environ=None):
    parser = argparse.ArgumentParser(description="Politely fetch letmemaster.com while written permission is on file.")
    parser.add_argument("--max-pages", type=int, help="stop after this many page fetches (required)")
    parser.add_argument("--refresh", action="store_true",
                        help="refetch pages already saved; only changed pages are rewritten")
    args = parser.parse_args(argv)
    try:
        check_permission(permission_path)
    except PermissionRefused as err:
        print(f"fetch_letmemaster: refusing to run: {err}", file=sys.stderr)
        return 2
    if args.max_pages is None or args.max_pages < 1:
        print("fetch_letmemaster: --max-pages N (N >= 1) is required", file=sys.stderr)
        return 2
    cookie = ((environ if environ is not None else os.environ).get("LETMEMASTER_COOKIE") or "").strip()
    if re.search(r"[\r\n]", cookie):
        print("fetch_letmemaster: LETMEMASTER_COOKIE must be a single line", file=sys.stderr)
        return 2
    print("session cookie: set" if cookie else "session cookie: not set (public pages only)")
    fetcher = Fetcher(raw_dir=raw_dir, cookie=cookie or None)
    try:
        counts = fetcher.run(args.max_pages, refresh=args.refresh)
    except FetchStop as err:
        print(f"fetch_letmemaster: stopped: {err}", file=sys.stderr)
        return 1
    print(json.dumps(counts, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
