import io
import sys

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import AuditLog
from app.features.auth import staff
from app.features.auth.staff import StaffError
from app.main import app
from tests.conftest import ADMIN_USERNAME

PASSWORD = "staff-pass-1"


def new_client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def sign_in(c: AsyncClient, username: str, password: str = PASSWORD) -> None:
    r = await c.post("/api/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text


@pytest.mark.parametrize("name", ["ab", "UPPER", "has space", "x" * 33, "a/b", ADMIN_USERNAME])
async def test_add_rejects_bad_username(session: AsyncSession, name: str) -> None:
    with pytest.raises(StaffError) as e:
        await staff.add_staff(session, name, PASSWORD)
    assert e.value.code == 2


async def test_add_rejects_short_password_and_duplicates(session: AsyncSession) -> None:
    with pytest.raises(StaffError):
        await staff.add_staff(session, "lan", "short")
    await staff.add_staff(session, "lan", PASSWORD)
    with pytest.raises(StaffError, match="already exists"):
        await staff.add_staff(session, "lan", PASSWORD)


async def test_list_hides_hashes_and_shows_status(session: AsyncSession) -> None:
    await staff.add_staff(session, "lan", PASSWORD)
    await staff.set_disabled(session, "lan", True)
    rows = await staff.list_staff(session)
    assert [(u, s) for u, s, _ in rows] == [("lan", "disabled")]
    await staff.set_disabled(session, "lan", False)
    assert (await staff.list_staff(session))[0][1] == "active"
    with pytest.raises(StaffError, match="no such"):
        await staff.set_disabled(session, "nobody", True)


async def test_passwd_changes_password(session: AsyncSession, anon_client: AsyncClient) -> None:
    await staff.add_staff(session, "lan", PASSWORD)
    await staff.set_password(session, "lan", "another-pass-2")
    bad = await anon_client.post("/api/auth/login", json={"username": "lan", "password": PASSWORD})
    assert bad.status_code == 401
    async with new_client() as c:
        await sign_in(c, "lan", "another-pass-2")


def test_read_password_from_pipe(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(sys, "stdin", io.StringIO("secret-pass\n"))
    assert staff.read_password() == "secret-pass"


async def test_staff_login_me_and_audit_actor(
    session: AsyncSession, school_class: dict[str, str]
) -> None:
    await staff.add_staff(session, "lan", PASSWORD)
    async with new_client() as c:
        await sign_in(c, "lan")
        assert (await c.get("/api/auth/me")).json() == {"username": "lan"}
        r = await c.post(
            "/api/students",
            json={
                "school_id": school_class["school_id"],
                "class_id": school_class["class_id"],
                "full_name": "Nguyễn Minh Khang",
                "dob": "2018-03-14",
                "gender": "MALE",
                "height_cm": 126.5,
                "weight_kg": 24.0,
                "trials": [],
                "force": False,
            },
        )
        assert r.status_code == 201, r.text
    actors = set((await session.scalars(select(AuditLog.actor))).all())
    assert actors == {"staff:lan"}


async def test_disable_takes_effect_immediately(session: AsyncSession) -> None:
    await staff.add_staff(session, "lan", PASSWORD)
    async with new_client() as c:
        await sign_in(c, "lan")
        assert (await c.get("/api/products")).status_code == 200
        await staff.set_disabled(session, "lan", True)
        assert (await c.get("/api/products")).status_code == 401
        r = await c.post("/api/auth/login", json={"username": "lan", "password": PASSWORD})
        assert r.status_code == 401 and r.json()["error"]["code"] == "invalid_credentials"


async def test_unknown_staff_login_is_401(anon_client: AsyncClient) -> None:
    r = await anon_client.post("/api/auth/login", json={"username": "ghost", "password": PASSWORD})
    assert r.status_code == 401 and r.json()["error"]["code"] == "invalid_credentials"


async def test_parent_session_is_not_staff(make_parent) -> None:  # type: ignore[no-untyped-def]
    parent = await make_parent()
    assert (await parent.get("/api/products")).status_code == 401
