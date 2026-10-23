import json
import logging
import uuid
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import AuditLog
from app.features.parent_accounts.models import ParentAccount
from app.main import app
from tests.conftest import MakeParent, register_body

REGISTER = "/api/parent/auth/register"
LOGIN = "/api/parent/auth/login"


async def test_register_with_email_signs_in(anon_client: AsyncClient) -> None:
    r = await anon_client.post(REGISTER, json=register_body())

    assert r.status_code == 201
    body = r.json()
    assert body["email"] == "hoa.tran@example.com" and body["phone"] == "0912345678"
    assert body["full_name"] == "Trần Thị Hoa"
    assert set(body) == {"id", "full_name", "email", "phone"}
    me = await anon_client.get("/api/parent/auth/me")
    assert me.status_code == 200 and me.json() == body


async def test_register_requires_email(anon_client: AsyncClient) -> None:
    r = await anon_client.post(REGISTER, json=register_body(email=None))

    assert r.status_code == 422 and "email" in r.json()["error"]["fields"]


async def test_register_without_phone_key_is_422(anon_client: AsyncClient) -> None:
    body = register_body()
    del body["phone"]

    r = await anon_client.post(REGISTER, json=body)

    assert r.status_code == 422 and "phone" in r.json()["error"]["fields"]


async def test_register_with_phone_normalizes_and_logs_in_again(anon_client: AsyncClient) -> None:
    r = await anon_client.post(REGISTER, json=register_body(phone="+84 912 345 678"))
    assert r.status_code == 201 and r.json()["phone"] == "0912345678"

    for identifier in ("0912345678", "+84912345678"):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as other:
            login = await other.post(
                LOGIN, json={"identifier": identifier, "password": "mat-khau-123"}
            )
            assert login.status_code == 200 and login.json()["id"] == r.json()["id"]
            assert (await other.get("/api/parent/auth/me")).status_code == 200


async def test_login_by_email_ignores_case(anon_client: AsyncClient) -> None:
    await anon_client.post(REGISTER, json=register_body())
    anon_client.cookies.clear()

    r = await anon_client.post(
        LOGIN, json={"identifier": " HOA.TRAN@example.com ", "password": "mat-khau-123"}
    )

    assert r.status_code == 200 and r.json()["email"] == "hoa.tran@example.com"


@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"phone": None}, "phone"),
        ({"phone": ""}, "phone"),
        ({"email": None}, "email"),
        ({"phone": "  "}, "phone"),
        ({"password": "short"}, "password"),
        ({"email": "not-an-email"}, "email"),
        ({"phone": "12345"}, "phone"),
        ({"full_name": "   "}, "full_name"),
    ],
)
async def test_register_validation(
    anon_client: AsyncClient, overrides: dict[str, Any], field: str
) -> None:
    r = await anon_client.post(REGISTER, json=register_body(**overrides))

    assert r.status_code == 422
    error = r.json()["error"]
    assert error["code"] == "validation_error" and field in error["fields"]


@pytest.mark.parametrize(
    "second",
    [
        {"email": "HOA.TRAN@example.com", "phone": "0987654321"},
        {"email": "other@example.com", "phone": "+84912345678"},
    ],
)
async def test_register_duplicate_is_409(anon_client: AsyncClient, second: dict[str, Any]) -> None:
    first = await anon_client.post(REGISTER, json=register_body(phone="0912345678"))
    assert first.status_code == 201
    anon_client.cookies.clear()

    r = await anon_client.post(REGISTER, json=register_body(**second))

    assert r.status_code == 409 and r.json()["error"]["code"] == "account_exists"
    assert (await anon_client.get("/api/parent/auth/me")).status_code == 401


async def test_wrong_identifier_and_wrong_password_look_the_same(anon_client: AsyncClient) -> None:
    await anon_client.post(REGISTER, json=register_body())
    anon_client.cookies.clear()

    wrong_password = await anon_client.post(
        LOGIN, json={"identifier": "hoa.tran@example.com", "password": "sai-mat-khau"}
    )
    wrong_identifier = await anon_client.post(
        LOGIN, json={"identifier": "ai-do@example.com", "password": "mat-khau-123"}
    )
    junk_phone = await anon_client.post(
        LOGIN, json={"identifier": "abc", "password": "mat-khau-123"}
    )

    for r in (wrong_password, wrong_identifier, junk_phone):
        assert r.status_code == 401 and r.json()["error"]["code"] == "invalid_credentials"
    assert wrong_password.json() == wrong_identifier.json() == junk_phone.json()
    assert (await anon_client.get("/api/parent/auth/me")).status_code == 401


@pytest.mark.parametrize("path", [REGISTER, LOGIN])
async def test_auth_endpoints_are_rate_limited(anon_client: AsyncClient, path: str) -> None:
    body = {"identifier": "x@example.com", "password": "x"} if path == LOGIN else register_body()
    statuses = [(await anon_client.post(path, json=body)).status_code for _ in range(11)]

    assert statuses[:10].count(429) == 0 and statuses[10] == 429


async def test_register_is_audited_with_parent_actor(
    make_parent: MakeParent, session: AsyncSession
) -> None:
    parent = await make_parent(email="a@example.com")

    log = await session.scalar(select(AuditLog).where(AuditLog.action == "parent_account.register"))

    assert log is not None and log.actor == f"parent:{parent.parent_id}"
    assert log.entity == "parent_account" and str(log.entity_id) == parent.parent_id
    assert "mat-khau-123" not in json.dumps(log.after)


async def test_logout_clears_only_parent_key(client: AsyncClient) -> None:
    assert (await client.post(REGISTER, json=register_body())).status_code == 201
    assert (await client.get("/api/auth/me")).status_code == 200

    assert (await client.post("/api/parent/auth/logout")).status_code == 204

    assert (await client.get("/api/parent/auth/me")).status_code == 401
    assert (await client.get("/api/auth/me")).status_code == 200


async def test_admin_session_is_not_a_parent_session(client: AsyncClient) -> None:
    r = await client.get("/api/parent/auth/me")

    assert r.status_code == 401 and r.json()["error"]["code"] == "unauthorized"


async def test_me_requires_login(anon_client: AsyncClient) -> None:
    assert (await anon_client.get("/api/parent/auth/me")).status_code == 401


async def test_auth_flow_logs_no_pii(
    anon_client: AsyncClient, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.DEBUG)
    await anon_client.post(REGISTER, json=register_body(phone="0912345678"))
    await anon_client.post(
        LOGIN, json={"identifier": "hoa.tran@example.com", "password": "sai-mat-khau"}
    )
    await anon_client.post(
        LOGIN, json={"identifier": "hoa.tran@example.com", "password": "mat-khau-123"}
    )

    logged = "\n".join(f"{r.getMessage()} {getattr(r, 'ctx', '')}" for r in caplog.records).lower()
    for secret in ("hoa.tran", "0912345678", "mat-khau", "trần"):
        assert secret not in logged


@pytest.mark.parametrize("path", ["/api/parent/auth/me", "/api/parent/children"])
async def test_cookie_of_a_deleted_account_is_unauthorized(
    make_parent: MakeParent, session: AsyncSession, path: str
) -> None:
    parent = await make_parent()
    assert (await parent.get(path)).status_code == 200
    await session.execute(
        delete(ParentAccount).where(ParentAccount.id == uuid.UUID(parent.parent_id))
    )
    await session.commit()

    r = await parent.get(path)

    assert r.status_code == 401 and r.json()["error"]["code"] == "unauthorized"
