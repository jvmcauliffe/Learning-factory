"""Tests for tools/fetch_letmemaster.py and tools/parse_letmemaster.py.

Every request goes to a local http.server fixture on 127.0.0.1. Nothing here
contacts letmemaster.com, and the clock and sleep are injected so no test waits.
"""
import io
import json
import sys
import tempfile
import threading
import unittest
from contextlib import redirect_stderr, redirect_stdout
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import fetch_letmemaster as fm  # noqa: E402
import parse_letmemaster as pm  # noqa: E402

SECRET = "session=SECRETVALUE123"

PERMISSION = """# Permission record

| Field | Value |
|---|---|
| Owner | Test Owner |
| Date | 5 November 2026 |
| Scope | Automated fetching of public study pages for a personal study site |
"""


def html(title, body="<p>Hello</p>"):
    return f"<html><head><title>{title}</title></head><body>{body}</body></html>".encode()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        srv = self.server
        srv.hits.append({"path": self.path, "host": self.headers.get("Host"),
                         "cookie": self.headers.get("Cookie"), "ua": self.headers.get("User-Agent")})
        route = srv.routes.get(self.path)
        if route is None:
            status, body, extra = 404, b"not found", {}
        else:
            if isinstance(route, list):
                item = route.pop(0) if len(route) > 1 else route[0]
            else:
                item = route
            status, body, extra = item
        self.send_response(status)
        for key, value in extra.items():
            self.send_header(key, value)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


class FakeTime:
    def __init__(self):
        self.t = 0.0
        self.sleeps = []

    def clock(self):
        return self.t

    def sleep(self, seconds):
        self.sleeps.append(seconds)
        self.t += seconds


class ServerCase(unittest.TestCase):
    def setUp(self):
        self.server = HTTPServer(("127.0.0.1", 0), Handler)
        self.server.hits = []
        self.server.routes = {}
        self.port = self.server.server_address[1]
        self.base = f"http://127.0.0.1:{self.port}"
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.raw = Path(self.tmp.name) / "raw" / "letmemaster"
        self.time = FakeTime()
        self.addCleanup(self._stop)

    def _stop(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=5)

    def serve(self, page_paths, robots=None, extra_sitemap_urls=()):
        urls = [self.base + p for p in page_paths] + list(extra_sitemap_urls)
        sitemap = ("<?xml version='1.0'?><urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'>"
                   + "".join(f"<url><loc>{u}</loc></url>" for u in urls) + "</urlset>").encode()
        if robots is None:
            robots = f"User-agent: *\nDisallow: /private/\nSitemap: {self.base}/sitemap.xml\n"
        routes = self.server.routes
        routes["/robots.txt"] = (200, robots.encode(), {})
        routes["/sitemap.xml"] = (200, sitemap, {})
        for p in page_paths:
            routes.setdefault(p, (200, html(p), {}))

    def fetcher(self, cookie=None):
        return fm.Fetcher(base_url=self.base, allowed_hosts={f"127.0.0.1:{self.port}"},
                          raw_dir=self.raw, cookie=cookie, clock=self.time.clock,
                          sleep=self.time.sleep, now=lambda: "2026-11-05T00:00:00Z")

    def page_hits(self):
        return [h["path"] for h in self.server.hits if h["path"] not in ("/robots.txt", "/sitemap.xml")]


class PermissionTests(unittest.TestCase):
    def run_main(self, argv, permission_path):
        out, err = io.StringIO(), io.StringIO()
        with tempfile.TemporaryDirectory() as tmp, redirect_stdout(out), redirect_stderr(err):
            code = fm.main(argv, permission_path=permission_path, raw_dir=Path(tmp) / "raw")
            created = any(Path(tmp).iterdir())
        return code, out.getvalue(), err.getvalue(), created

    def test_refuses_without_permission_file(self):
        with mock.patch.object(fm, "Fetcher") as fetcher:
            code, out, err, created = self.run_main(["--max-pages", "1"], Path("/nonexistent/letmemaster.md"))
        self.assertEqual(code, 2)
        self.assertIn("refusing to run", err)
        self.assertIn("missing", err)
        self.assertFalse(created)
        fetcher.assert_not_called()

    def test_refuses_when_scope_does_not_cover_fetching(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "p.md"
            path.write_text(PERMISSION.replace("Automated fetching", "Quoting"), encoding="utf-8")
            with mock.patch.object(fm, "Fetcher") as fetcher:
                code, _, err, _ = self.run_main(["--max-pages", "1"], path)
        self.assertEqual(code, 2)
        self.assertIn("Scope", err)
        fetcher.assert_not_called()

    def test_accepts_a_complete_record(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "p.md"
            path.write_text(PERMISSION, encoding="utf-8")
            fields = fm.check_permission(path)
        self.assertEqual(fields["owner"], "Test Owner")

    def test_page_cap_is_required(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "p.md"
            path.write_text(PERMISSION, encoding="utf-8")
            with mock.patch.object(fm, "Fetcher") as fetcher:
                code, _, err, _ = self.run_main([], path)
        self.assertEqual(code, 2)
        self.assertIn("--max-pages", err)
        fetcher.assert_not_called()

    def test_main_reports_cookie_state_but_never_its_value(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "p.md"
            path.write_text(PERMISSION, encoding="utf-8")
            stub = mock.MagicMock()
            stub.run.return_value = {"fetched": 0}
            out, err = io.StringIO(), io.StringIO()
            with mock.patch.object(fm, "Fetcher", return_value=stub) as fetcher, \
                    redirect_stdout(out), redirect_stderr(err):
                code = fm.main(["--max-pages", "3"], permission_path=path, raw_dir=Path(tmp) / "raw",
                               environ={"LETMEMASTER_COOKIE": SECRET})
        self.assertEqual(code, 0)
        self.assertIn("session cookie: set", out.getvalue())
        self.assertNotIn("SECRETVALUE123", out.getvalue() + err.getvalue())
        self.assertEqual(fetcher.call_args.kwargs["cookie"], SECRET)
        stub.run.assert_called_once_with(3, refresh=False)


class FetchTests(ServerCase):
    def test_honours_robots_disallow(self):
        self.serve(["/a", "/private/c", "/b"])
        counts = self.fetcher().run(10)
        self.assertEqual(counts["fetched"], 2)
        self.assertEqual(counts["robots_skipped"], 1)
        self.assertNotIn("/private/c", self.page_hits())

    def test_spaces_requests_at_least_two_seconds_apart(self):
        self.serve(["/a", "/b", "/c"])
        fetcher = self.fetcher()
        fetcher.run(10)
        stamps = [t for t, _ in fetcher.request_log]
        self.assertGreaterEqual(len(stamps), 5)   # robots, sitemap, three pages
        for earlier, later in zip(stamps, stamps[1:]):
            self.assertGreaterEqual(later - earlier, 2.0 - 1e-9)

    def test_respects_the_page_cap(self):
        self.serve(["/a", "/b", "/c", "/d", "/e"])
        counts = self.fetcher().run(2)
        self.assertEqual(counts["fetched"], 2)
        self.assertEqual(len(self.page_hits()), 2)

    def test_only_fetches_sitemap_urls_on_the_permitted_host(self):
        self.serve(["/a"], extra_sitemap_urls=[f"http://localhost:{self.port}/d"])
        counts = self.fetcher().run(10)
        self.assertEqual(counts["host_skipped"], 1)
        self.assertNotIn("/d", self.page_hits())
        self.assertTrue(all(h["host"] == f"127.0.0.1:{self.port}" for h in self.server.hits))

    def test_sends_a_clear_user_agent(self):
        self.serve(["/a"])
        self.fetcher().run(10)
        self.assertTrue(all("learning-factory-fetcher" in (h["ua"] or "") for h in self.server.hits))

    def test_cookie_goes_to_the_permitted_host_only(self):
        self.serve(["/a"])
        fetcher = self.fetcher(cookie=SECRET)
        fetcher.run(10)
        self.assertTrue(self.server.hits)
        self.assertTrue(all(h["cookie"] == SECRET for h in self.server.hits))
        # A request to a host outside the allow-list carries no cookie, even if asked for directly.
        self.server.hits.clear()
        fetcher._request_once(f"http://localhost:{self.port}/a")
        self.assertEqual(len(self.server.hits), 1)
        self.assertIsNone(self.server.hits[0]["cookie"])

    def test_cookie_is_never_written_to_disk(self):
        self.serve(["/a", "/b"])
        self.fetcher(cookie=SECRET).run(10)
        files = [p for p in Path(self.tmp.name).rglob("*") if p.is_file()]
        self.assertTrue(files)
        for path in files:
            self.assertNotIn(b"SECRETVALUE123", path.read_bytes(), str(path))

    def test_manifest_records_url_time_status_and_hash(self):
        self.serve(["/a"])
        self.fetcher().run(10)
        manifest = json.loads((self.raw / "manifest.json").read_text(encoding="utf-8"))
        entry = manifest["pages"][self.base + "/a"]
        self.assertEqual(entry["status"], 200)
        self.assertEqual(entry["fetched_at"], "2026-11-05T00:00:00Z")
        self.assertEqual(len(entry["sha256"]), 64)
        self.assertTrue((self.raw / "pages" / entry["file"]).is_file())

    def test_resumes_without_refetching_unchanged_pages(self):
        self.serve(["/a", "/b"])
        self.fetcher().run(10)
        self.server.hits.clear()
        counts = self.fetcher().run(10)
        self.assertEqual(counts["resumed"], 2)
        self.assertEqual(counts["fetched"], 0)
        self.assertEqual(self.page_hits(), [])

    def test_refresh_refetches_but_rewrites_only_changed_pages(self):
        self.serve(["/a", "/b"])
        self.fetcher().run(10)
        self.server.routes["/b"] = (200, html("/b", "<p>Changed</p>"), {})
        self.server.hits.clear()
        counts = self.fetcher().run(10, refresh=True)
        self.assertEqual(counts["unchanged"], 1)
        self.assertEqual(counts["fetched"], 1)
        self.assertEqual(sorted(self.page_hits()), ["/a", "/b"])

    def test_interrupted_run_resumes_where_it_stopped(self):
        self.serve(["/a", "/b", "/c"])
        self.fetcher().run(1)
        self.server.hits.clear()
        counts = self.fetcher().run(10)
        self.assertEqual(counts["resumed"], 1)
        self.assertEqual(counts["fetched"], 2)
        self.assertNotIn("/a", self.page_hits())

    def test_retries_a_transient_error_with_backoff(self):
        self.serve(["/a"])
        self.server.routes["/a"] = [(503, b"busy", {}), (200, html("a"), {})]
        counts = self.fetcher().run(10)
        self.assertEqual(counts["fetched"], 1)
        self.assertEqual(self.page_hits().count("/a"), 2)
        self.assertIn(fm.BACKOFF, self.time.sleeps)

    def test_a_missing_page_is_recorded_and_not_retried(self):
        self.serve(["/a", "/gone"])
        self.server.routes["/gone"] = (404, b"no", {})
        counts = self.fetcher().run(10)
        self.assertEqual(counts["failed"], 1)
        self.assertEqual(self.page_hits().count("/gone"), 1)
        manifest = json.loads((self.raw / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["pages"][self.base + "/gone"]["status"], 404)

    def test_does_not_follow_a_redirect_off_the_permitted_host(self):
        self.serve(["/a"])
        self.server.routes["/a"] = (302, b"", {"Location": "http://example.invalid/x"})
        counts = self.fetcher().run(10)
        self.assertEqual(counts["failed"], 1)
        self.assertEqual(self.page_hits(), ["/a"])

    def test_follows_a_redirect_inside_the_permitted_host(self):
        self.serve(["/a", "/real"])
        self.server.routes["/a"] = (301, b"", {"Location": "/real"})
        counts = self.fetcher().run(10)
        self.assertEqual(counts["fetched"], 2)
        manifest = json.loads((self.raw / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["pages"][self.base + "/a"]["final_url"], self.base + "/real")

    def test_stops_when_robots_txt_cannot_be_read(self):
        self.serve(["/a"])
        self.server.routes["/robots.txt"] = (500, b"oops", {})
        fetcher = fm.Fetcher(base_url=self.base, allowed_hosts={f"127.0.0.1:{self.port}"},
                             raw_dir=self.raw, clock=self.time.clock, sleep=lambda s: None)
        with self.assertRaises(fm.FetchStop):
            fetcher.run(10)
        self.assertEqual(self.page_hits(), [])


class ParseTests(unittest.TestCase):
    SAMPLE = (
        "<html><head><title> Sample &amp; Test </title><style>p{}</style></head><body>"
        "<script>var x = 1;</script>"
        "<h1>Top</h1><p>First   paragraph\nwith a break.</p><h2>Sub</h2>"
        "<ul><li>One<ul><li>Inner</li></ul></li><li>Two</li></ul>"
        "<ol><li>Step</li></ol>"
        "<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2 &lt; 3</td></tr></table>"
        "<p>Last</p></body></html>"
    )

    def test_extracts_headings_paragraphs_lists_and_tables_verbatim(self):
        doc = pm.parse_html(self.SAMPLE)
        self.assertEqual(doc["title"], "Sample & Test")
        self.assertEqual(doc["headings"], [{"level": 1, "text": "Top"}, {"level": 2, "text": "Sub"}])
        self.assertEqual(doc["paragraphs"], ["First   paragraph\nwith a break.", "Last"])
        self.assertEqual(doc["lists"], [
            {"ordered": False, "items": ["One", "Two"]},
            {"ordered": False, "items": ["Inner"]},
            {"ordered": True, "items": ["Step"]},
        ])
        self.assertEqual(doc["tables"], [{"rows": [["A", "B"], ["1", "2 < 3"]]}])

    def test_script_and_style_text_is_ignored(self):
        doc = pm.parse_html(self.SAMPLE)
        self.assertNotIn("var x", json.dumps(doc))
        self.assertNotIn("p{}", json.dumps(doc))

    def test_unclosed_tags_do_not_lose_text(self):
        doc = pm.parse_html("<p>One<p>Two<ul><li>A<li>B</ul>")
        self.assertEqual(doc["paragraphs"], ["One", "Two"])
        self.assertEqual(doc["lists"], [{"ordered": False, "items": ["A", "B"]}])

    def test_parse_all_is_byte_identical_across_runs_and_marks_candidates(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw = Path(tmp) / "raw"
            (raw / "pages").mkdir(parents=True)
            import hashlib
            body = self.SAMPLE.encode()
            (raw / "pages" / "one.html").write_bytes(body)
            manifest = {"version": 1, "pages": {
                "https://letmemaster.com/one": {"fetched_at": "2026-11-05T00:00:00Z", "status": 200,
                                                "file": "one.html", "sha256": hashlib.sha256(body).hexdigest()},
                "https://letmemaster.com/gone": {"fetched_at": "2026-11-05T00:00:00Z", "status": 404,
                                                 "file": None, "sha256": None},
            }}
            (raw / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
            first, second = Path(tmp) / "out1", Path(tmp) / "out2"
            written, problems = pm.parse_all(raw, first)
            pm.parse_all(raw, second)
            self.assertEqual(written, ["one.json"])
            self.assertEqual(problems, [])
            a, b = (first / "one.json").read_bytes(), (second / "one.json").read_bytes()
            self.assertEqual(a, b)
            doc = json.loads(a)
            self.assertEqual(doc["status"], "candidate")
            self.assertEqual(doc["source_url"], "https://letmemaster.com/one")
            self.assertEqual(doc["raw_sha256"], manifest["pages"]["https://letmemaster.com/one"]["sha256"])
            self.assertEqual(doc["fetched_at"], "2026-11-05T00:00:00Z")

    def test_parse_all_skips_a_raw_file_that_no_longer_matches_its_hash(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw = Path(tmp) / "raw"
            (raw / "pages").mkdir(parents=True)
            (raw / "pages" / "one.html").write_bytes(b"<p>tampered</p>")
            manifest = {"version": 1, "pages": {"https://letmemaster.com/one": {
                "fetched_at": "t", "status": 200, "file": "one.html", "sha256": "0" * 64}}}
            (raw / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
            written, problems = pm.parse_all(raw, Path(tmp) / "out")
            self.assertEqual(written, [])
            self.assertEqual(len(problems), 1)

    def test_parse_main_exits_non_zero_without_a_manifest(self):
        with tempfile.TemporaryDirectory() as tmp, redirect_stderr(io.StringIO()):
            code = pm.main(["--raw-dir", str(Path(tmp) / "raw"), "--out-dir", str(Path(tmp) / "out")])
        self.assertEqual(code, 2)

class EndToEndTests(ServerCase):
    def test_fetch_then_parse_twice_is_byte_identical(self):
        self.serve(["/a", "/b"])
        self.server.routes["/a"] = (200, html("A", "<h1>Alpha</h1><ul><li>x</li></ul>"), {})
        self.fetcher().run(10)
        out1, out2 = Path(self.tmp.name) / "o1", Path(self.tmp.name) / "o2"
        written, problems = pm.parse_all(self.raw, out1)
        pm.parse_all(self.raw, out2)
        self.assertEqual(len(written), 2)
        self.assertEqual(problems, [])
        for name in written:
            self.assertEqual((out1 / name).read_bytes(), (out2 / name).read_bytes())


class RepoRulesTests(unittest.TestCase):
    def test_raw_is_git_ignored(self):
        lines = (ROOT / ".gitignore").read_text(encoding="utf-8").splitlines()
        self.assertIn("raw/", [line.strip() for line in lines])


if __name__ == "__main__":
    unittest.main()
