"""Smoke checks run inside the app container: python - <admin-password> < scripts/smoke.py"""

import http.cookiejar
import json
import sys
import time
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8000"
PASSWORD = sys.argv[1]
jar = http.cookiejar.CookieJar()
authed = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
anon = urllib.request.build_opener()


def call(opener, method, path, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        BASE + path, method=method, data=data, headers={"content-type": "application/json"}
    )
    try:
        resp = opener.open(req)
        return resp.status, resp
    except urllib.error.HTTPError as exc:
        return exc.code, exc


def check(name, got, want):
    ok = got == want
    print(f"{'ok  ' if ok else 'FAIL'} {name}: {got}")
    if not ok:
        sys.exit(1)


for _ in range(30):
    try:
        status, _r = call(anon, "GET", "/api/healthz")
        if status == 200:
            break
    except urllib.error.URLError:
        pass
    time.sleep(1)
check("healthz", status, 200)

status, resp = call(anon, "GET", "/")
check("SPA /", (status, "text/html" in resp.headers["content-type"]), (200, True))
check("SPA /login", call(anon, "GET", "/login")[0], 200)
for path in ("students", "stats/overview", "export/students.csv", "events"):
    check(f"anon /api/{path}", call(anon, "GET", f"/api/{path}")[0], 401)
check("bad portal token", call(anon, "GET", "/api/public/students/nope")[0], 404)
check("login", call(authed, "POST", "/api/auth/login", {"username": "admin", "password": PASSWORD})[0], 200)
check("products", call(authed, "GET", "/api/products")[0], 200)
status, resp = call(authed, "GET", "/api/events")
check("sse content-type", resp.headers["content-type"].split(";")[0], "text/event-stream")
resp.close()
print("smoke passed")
