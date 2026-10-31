"""Smoke checks run inside the app container: python - <admin-password> < scripts/smoke.py

Expects ADMIN_HOST=admin.smoke and PUBLIC_BASE_URL=http://parent.smoke."""

import http.cookiejar
import subprocess
import datetime
import json
import sys
import time
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8000"
ADMIN = "admin.smoke"
PARENT = "parent.smoke"
PASSWORD = sys.argv[1]
jar = http.cookiejar.CookieJar()
authed = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
parent = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
anon = urllib.request.build_opener()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


raw = urllib.request.build_opener(NoRedirect)


def call(opener, method, path, body=None, host=ADMIN):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        BASE + path, method=method, data=data, headers={"content-type": "application/json", "Host": host}
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
check("parent host /login redirects", call(raw, "GET", "/login", host=PARENT)[0], 302)
check("parent host admin api", call(anon, "GET", "/api/students", host=PARENT)[0], 404)
check("parent host /p/x", call(anon, "GET", "/p/x", host=PARENT)[0], 200)
check("admin host parent api", call(anon, "GET", "/api/parent/auth/me")[0], 404)
status, resp = call(raw, "GET", "/p/x?a=1")
check("admin host /p/x redirects", (status, resp.headers.get("location")), (302, f"http://{PARENT}/p/x?a=1"))
for path in ("students", "stats/overview", "export/students.csv", "events"):
    check(f"anon /api/{path}", call(anon, "GET", f"/api/{path}")[0], 401)
check("bad portal token", call(anon, "GET", "/api/public/students/nope", host=PARENT)[0], 404)
check("login", call(authed, "POST", "/api/auth/login", {"username": "admin", "password": PASSWORD})[0], 200)
check("products", call(authed, "GET", "/api/products")[0], 200)
status, resp = call(authed, "GET", "/api/events")
check("sse content-type", resp.headers["content-type"].split(";")[0], "text/event-stream")
resp.close()

staff = subprocess.run(
    [sys.executable, "-m", "app.features.auth.staff", "add", "smoke"], input="smoke-staff-123\n", text=True
)
check("staff add", staff.returncode, 0)
staffer = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
check("staff login", call(staffer, "POST", "/api/auth/login", {"username": "smoke", "password": "smoke-staff-123"})[0], 200)
status, resp = call(staffer, "GET", "/api/auth/me")
check("staff me", json.load(resp).get("username"), "smoke")

tag = f"{int(time.time()):x}"
status, resp = call(authed, "POST", "/api/schools", {"name": f"Smoke {tag}", "code": f"S{tag}"[:12]})
school = json.load(resp)
status, resp = call(authed, "GET", f"/api/schools/{school['id']}/classes")
klass = next(c for c in json.load(resp) if c["grade"] == 2)
check("create admin student", call(authed, "POST", "/api/students", {
    "school_id": school["id"], "class_id": klass["id"], "full_name": "Nguyễn Văn An",
    "dob": "2018-03-14", "gender": "MALE", "height_cm": 130, "weight_kg": 26, "trials": [],
})[0], 201)

email = f"smoke-{tag}@example.com"
reg = {"full_name": "Phụ huynh Smoke", "phone": f"09{int(tag, 16) % 10**8:08d}", "email": email, "password": "smoke-pass-123"}
check("parent register", call(parent, "POST", "/api/parent/auth/register", reg, host=PARENT)[0], 201)
check("parent duplicate", call(anon, "POST", "/api/parent/auth/register", reg, host=PARENT)[0], 409)
check("parent me", call(parent, "GET", "/api/parent/auth/me", host=PARENT)[0], 200)
check("parent -> admin route", call(parent, "GET", "/api/students")[0], 401)
check("admin -> parent route", call(authed, "GET", "/api/parent/children", host=PARENT)[0], 401)
match = {"school_id": school["id"], "full_name": "nguyen van an ", "dob": "2018-03-14"}
check("parent claim", call(parent, "POST", "/api/parent/children/claim", match, host=PARENT)[0], 200)
status, resp = call(parent, "GET", "/api/parent/children", host=PARENT)
child = json.load(resp)[0]
check("parent ordering", call(
    parent, "GET", f"/api/parent/children/{child['student_id']}/ordering", host=PARENT,
)[0], 200)
status, resp = call(authed, "GET", "/api/stats/overview")
check("stats overview", status, 200)
check("parent logout", call(parent, "POST", "/api/parent/auth/logout", host=PARENT)[0], 204)
check("parent after logout", call(parent, "GET", "/api/parent/auth/me", host=PARENT)[0], 401)
check("admin survives parent logout", call(authed, "GET", "/api/products")[0], 200)

survey = {
    "school_name": "Trường Smoke", "province": "Thành phố Hà Nội", "ward": "Phường Ba Đình", "class_name": "2A1",
    "child_full_name": "Trần Smoke", "dob": "2018-03-14", "gender": "FEMALE", "parent_phone": "0912345678",
    "measured_on": (datetime.date.today() - datetime.timedelta(days=1)).isoformat(), "measure_method": "TAPE_TODAY",
    "height_cm": 128.5, "weight_kg": 26, "chest_cm": 62, "waist_cm": 55,
    "body_traits": ["TALL_SLIM"], "past_issues": [], "supply_option": "STANDARD",
}
check("parent host /survey", call(anon, "GET", "/survey", host=PARENT)[0], 200)
status, resp = call(raw, "GET", "/survey")
check("admin host /survey redirects", (status, resp.headers.get("location")), (302, f"http://{PARENT}/survey"))
check("admin host survey api", call(anon, "POST", "/api/public/surveys", survey)[0], 404)
check("survey submit", call(anon, "POST", "/api/public/surveys", survey, host=PARENT)[0], 201)
check("survey invalid", call(anon, "POST", "/api/public/surveys", {**survey, "height_cm": 1.3}, host=PARENT)[0], 422)
check("anon survey export", call(anon, "GET", "/api/export/surveys.csv")[0], 401)
status, resp = call(authed, "GET", "/api/export/surveys.csv")
check("survey export row", (status, b"Tr\xe1\xba\xa7n Smoke" in resp.read()), (200, True))
print("smoke passed")
