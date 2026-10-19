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
parent = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
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

tag = f"{int(time.time()):x}"
status, resp = call(authed, "POST", "/api/schools", {"name": f"Smoke {tag}", "code": f"S{tag}"[:12]})
school = json.load(resp)
status, resp = call(authed, "POST", f"/api/schools/{school['id']}/classes", {"grade": 2, "name": "2A1"})
klass = json.load(resp)
check("create admin student", call(authed, "POST", "/api/students", {
    "school_id": school["id"], "class_id": klass["id"], "full_name": "Nguyễn Văn An",
    "dob": "2018-03-14", "gender": "MALE", "height_cm": 130, "weight_kg": 26, "trials": [],
})[0], 201)

email = f"smoke-{tag}@example.com"
reg = {"full_name": "Phụ huynh Smoke", "email": email, "password": "smoke-pass-123"}
check("parent register", call(parent, "POST", "/api/parent/auth/register", reg)[0], 201)
check("parent duplicate", call(anon, "POST", "/api/parent/auth/register", reg)[0], 409)
check("parent me", call(parent, "GET", "/api/parent/auth/me")[0], 200)
check("parent -> admin route", call(parent, "GET", "/api/students")[0], 401)
check("admin -> parent route", call(authed, "GET", "/api/parent/children")[0], 401)
match = {"school_id": school["id"], "full_name": "nguyen van an ", "dob": "2018-03-14"}
check("parent claim", call(parent, "POST", "/api/parent/children/claim", match)[0], 200)
status, resp = call(parent, "GET", "/api/parent/children")
child = json.load(resp)[0]
check("parent choose size", call(
    parent, "PUT", f"/api/parent/children/{child['student_id']}/size-choices/blazer", {"size_label": "3"}
)[0], 200)
status, resp = call(authed, "GET", "/api/stats/orders")
check("orders count", status, 200)
check("parent logout", call(parent, "POST", "/api/parent/auth/logout")[0], 204)
check("parent after logout", call(parent, "GET", "/api/parent/auth/me")[0], 401)
check("admin survives parent logout", call(authed, "GET", "/api/products")[0], 200)
print("smoke passed")
