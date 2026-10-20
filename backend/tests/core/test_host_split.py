import pytest
from httpx import ASGITransport, AsyncClient

from app.core.security import HostSplitMiddleware
from app.main import ROUTERS, _admin_api_matcher, app

ADMIN = "admin.test"
PUBLIC = "https://parent.test"


def client(admin_host: str | None, host: str) -> AsyncClient:
    asgi = (
        HostSplitMiddleware(app, admin_host, PUBLIC, _admin_api_matcher(ROUTERS))
        if admin_host
        else app
    )
    return AsyncClient(transport=ASGITransport(app=asgi), base_url=f"http://{host}")


ADMIN_API = [
    "/api/auth/me",
    "/api/auth/login",
    "/api/students",
    "/api/students/x/parents/y",
    "/api/stats/overview",
    "/api/export/students.csv",
    "/api/events",
    "/api/products",
    "/api/schools",
    "/api/size-suggestions",
]
ADMIN_PAGES = ["/", "/login", "/students", "/students/new", "/dashboard"]
PARENT_API = ["/api/parent/auth/me", "/api/parent/schools", "/api/public/sometoken"]
PARENT_PAGES = ["/parent", "/parent/login", "/p/sometoken"]


@pytest.mark.parametrize("path", ADMIN_API)
async def test_public_host_hides_admin_api(path: str) -> None:
    async with client(ADMIN, "parent.test") as c:
        r = await c.get(path)
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"


@pytest.mark.parametrize("path", ADMIN_PAGES)
async def test_public_host_redirects_admin_pages(path: str) -> None:
    async with client(ADMIN, "parent.test") as c:
        r = await c.get(path)
    assert r.status_code == 302 and r.headers["location"] == "/parent"


async def test_public_host_keeps_parent_and_health() -> None:
    async with client(ADMIN, "parent.test") as c:
        assert (await c.get("/api/healthz")).status_code == 200
        assert (await c.get("/api/parent/auth/me")).status_code == 401
        assert (await c.get("/api/parent/schools")).status_code == 401
        r = await c.get("/api/public/sometoken")
        assert r.status_code == 404 and r.json()["error"]["message"] != "Not found"


@pytest.mark.parametrize("path", PARENT_PAGES)
async def test_public_host_passes_parent_pages(path: str) -> None:
    async with client(ADMIN, "parent.test") as c:
        assert (await c.get(path)).status_code not in (302,)


@pytest.mark.parametrize("path", PARENT_API)
async def test_admin_host_hides_parent_api(path: str) -> None:
    async with client(ADMIN, "Admin.Test:8000") as c:
        r = await c.get(path)
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"


@pytest.mark.parametrize("path", PARENT_PAGES)
async def test_admin_host_redirects_parent_pages(path: str) -> None:
    async with client(ADMIN, "admin.test") as c:
        r = await c.get(path + "?a=1")
    assert r.status_code == 302 and r.headers["location"] == f"{PUBLIC}{path}?a=1"


async def test_admin_host_serves_admin_side() -> None:
    async with client(ADMIN, "admin.test") as c:
        assert (await c.get("/api/healthz")).status_code == 200
        assert (await c.get("/api/auth/me")).status_code == 401
        assert (await c.get("/api/students")).status_code == 401
        assert (await c.get("/students")).status_code != 302


@pytest.mark.parametrize("host", ["parent.test", "admin.test"])
async def test_unset_admin_host_changes_nothing(host: str) -> None:
    async with client(None, host) as c:
        assert (await c.get("/api/auth/me")).status_code == 401
        assert (await c.get("/api/parent/auth/me")).status_code == 401
        assert (await c.get("/parent")).status_code != 302
