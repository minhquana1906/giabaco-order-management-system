import uuid

import pytest
from httpx import AsyncClient

from tests.conftest import ADMIN_PASSWORD, ADMIN_USERNAME

PROTECTED = [
    "/api/auth/me",
    "/api/products",
    "/api/schools",
    "/api/students",
    "/api/stats/overview",
    "/api/export/students.csv",
    "/api/events",
]


@pytest.mark.parametrize("path", PROTECTED)
async def test_protected_routes_return_401(anon_client: AsyncClient, path: str) -> None:
    r = await anon_client.get(path)
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "unauthorized"


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("POST", "/api/schools"),
        ("PATCH", f"/api/schools/{uuid.UUID(int=1)}"),
        ("POST", f"/api/schools/{uuid.UUID(int=1)}/classes"),
        ("PATCH", f"/api/schools/{uuid.UUID(int=1)}/classes/{uuid.UUID(int=2)}"),
    ],
)
async def test_catalog_mutations_require_admin(
    anon_client: AsyncClient, method: str, path: str
) -> None:
    r = await anon_client.request(method, path, json={})
    assert r.status_code == 401


async def test_login_me_logout(anon_client: AsyncClient) -> None:
    r = await anon_client.post(
        "/api/auth/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
    )
    assert r.status_code == 200 and r.json() == {"username": ADMIN_USERNAME}
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie
    assert (await anon_client.get("/api/auth/me")).json() == {"username": ADMIN_USERNAME}
    assert (await anon_client.post("/api/auth/logout")).status_code == 204
    assert (await anon_client.get("/api/auth/me")).status_code == 401


@pytest.mark.parametrize(
    ("username", "password"), [(ADMIN_USERNAME, "wrong"), ("someone", ADMIN_PASSWORD)]
)
async def test_bad_credentials(anon_client: AsyncClient, username: str, password: str) -> None:
    r = await anon_client.post("/api/auth/login", json={"username": username, "password": password})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "invalid_credentials"


async def test_login_rate_limited(anon_client: AsyncClient) -> None:
    codes = [
        (
            await anon_client.post("/api/auth/login", json={"username": "x", "password": "y"})
        ).status_code
        for _ in range(6)
    ]
    assert codes == [401] * 5 + [429]


async def test_security_headers_and_healthz(anon_client: AsyncClient) -> None:
    r = await anon_client.get("/api/healthz")
    assert r.json() == {"status": "ok"}
    assert r.headers["x-frame-options"] == "DENY"
    assert r.headers["referrer-policy"] == "no-referrer"
    assert r.headers["x-content-type-options"] == "nosniff"


async def test_https_redirect_for_proxied_http() -> None:
    from httpx import ASGITransport
    from starlette.responses import PlainTextResponse

    from app.core.security import HttpsRedirectMiddleware

    async def ok(scope, receive, send):  # type: ignore[no-untyped-def]
        await PlainTextResponse("ok")(scope, receive, send)

    transport = ASGITransport(app=HttpsRedirectMiddleware(ok))
    async with AsyncClient(transport=transport, base_url="http://giabaco.test") as c:
        r = await c.get("/students/new?a=1", headers={"x-forwarded-proto": "http"})
        assert r.status_code == 308 and r.headers["location"] == "https://giabaco.test/students/new?a=1"
        assert (await c.get("/x", headers={"x-forwarded-proto": "https"})).status_code == 200
        assert (await c.get("/x")).status_code == 200
