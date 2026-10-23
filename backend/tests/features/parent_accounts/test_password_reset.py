import re
import uuid
from datetime import UTC, datetime, timedelta

from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import AuditLog
from app.core.security import forgot_limiter
from app.features.parent_accounts.models import ParentPasswordReset
from app.main import app
from tests.conftest import MakeParent, register_body

FORGOT = "/api/parent/auth/forgot"
RESET = "/api/parent/auth/reset"
LOGIN = "/api/parent/auth/login"
ME = "/api/parent/auth/me"
NEW_PASSWORD = "mat-khau-moi-456"


def token_from(outbox: list[dict[str, str]]) -> str:
    match = re.search(r"/parent/reset#token=([\w-]+)", outbox[-1]["text"])
    assert match, outbox[-1]["text"]
    return match.group(1)


async def request_token(client: AsyncClient, outbox: list[dict[str, str]], email: str) -> str:
    assert (await client.post(FORGOT, json={"email": email})).status_code == 202
    return token_from(outbox)


async def test_reset_sets_new_password_and_token_is_single_use(
    make_parent: MakeParent, anon_client: AsyncClient, outbox: list[dict[str, str]]
) -> None:
    await make_parent(email="hoa@example.com")
    token = await request_token(anon_client, outbox, "Hoa@Example.com")
    assert outbox[-1]["to"] == "hoa@example.com"

    done = await anon_client.post(RESET, json={"token": token, "password": NEW_PASSWORD})
    again = await anon_client.post(RESET, json={"token": token, "password": "khac-nua-789"})

    assert done.status_code == 204
    assert again.status_code == 400 and again.json()["error"]["code"] == "invalid_reset_token"
    old = await anon_client.post(
        LOGIN, json={"identifier": "hoa@example.com", "password": "mat-khau-123"}
    )
    new = await anon_client.post(
        LOGIN, json={"identifier": "hoa@example.com", "password": NEW_PASSWORD}
    )
    assert old.status_code == 401 and new.status_code == 200


async def test_unknown_email_gets_the_same_answer_and_no_mail(
    anon_client: AsyncClient, outbox: list[dict[str, str]]
) -> None:
    r = await anon_client.post(FORGOT, json={"email": "nobody@example.com"})

    assert r.status_code == 202 and r.json() == {"accepted": True}
    assert outbox == []


async def test_second_request_within_a_minute_sends_nothing(
    make_parent: MakeParent, anon_client: AsyncClient, outbox: list[dict[str, str]]
) -> None:
    await make_parent(email="hoa@example.com")
    await request_token(anon_client, outbox, "hoa@example.com")

    r = await anon_client.post(FORGOT, json={"email": "hoa@example.com"})

    assert r.status_code == 202 and len(outbox) == 1


async def test_new_request_invalidates_the_previous_link(
    make_parent: MakeParent,
    anon_client: AsyncClient,
    outbox: list[dict[str, str]],
    session: AsyncSession,
) -> None:
    await make_parent(email="hoa@example.com")
    first = await request_token(anon_client, outbox, "hoa@example.com")
    await session.execute(
        update(ParentPasswordReset).values(created_at=datetime.now(UTC) - timedelta(minutes=2))
    )
    await session.commit()
    second = await request_token(anon_client, outbox, "hoa@example.com")

    stale = await anon_client.post(RESET, json={"token": first, "password": NEW_PASSWORD})
    fresh = await anon_client.post(RESET, json={"token": second, "password": NEW_PASSWORD})

    assert first != second
    assert stale.status_code == 400 and fresh.status_code == 204


async def test_expired_token_is_rejected(
    make_parent: MakeParent,
    anon_client: AsyncClient,
    outbox: list[dict[str, str]],
    session: AsyncSession,
) -> None:
    await make_parent(email="hoa@example.com")
    token = await request_token(anon_client, outbox, "hoa@example.com")
    await session.execute(
        update(ParentPasswordReset).values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
    )
    await session.commit()

    r = await anon_client.post(RESET, json={"token": token, "password": NEW_PASSWORD})

    assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_reset_token"


async def test_reset_signs_out_older_sessions_but_not_new_logins(
    make_parent: MakeParent, anon_client: AsyncClient, outbox: list[dict[str, str]]
) -> None:
    parent = await make_parent(email="hoa@example.com")
    assert (await parent.get(ME)).status_code == 200
    token = await request_token(anon_client, outbox, "hoa@example.com")

    await anon_client.post(RESET, json={"token": token, "password": NEW_PASSWORD})

    assert (await parent.get(ME)).status_code == 401
    assert (await parent.get("/api/parent/children")).status_code == 401
    assert (await parent.get(f"/api/parent/children/{uuid.uuid4()}")).status_code == 401
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as fresh:
        login = await fresh.post(
            LOGIN, json={"identifier": "hoa@example.com", "password": NEW_PASSWORD}
        )
        assert login.status_code == 200 and (await fresh.get(ME)).status_code == 200


async def test_token_is_stored_hashed_and_actions_are_audited(
    make_parent: MakeParent,
    anon_client: AsyncClient,
    outbox: list[dict[str, str]],
    session: AsyncSession,
) -> None:
    await make_parent(email="hoa@example.com")
    token = await request_token(anon_client, outbox, "hoa@example.com")
    await anon_client.post(RESET, json={"token": token, "password": NEW_PASSWORD})

    stored = (await session.scalars(select(ParentPasswordReset.token_hash))).all()
    actions = set((await session.scalars(select(AuditLog.action))).all())

    assert stored and token not in stored
    assert {"parent_account.reset_requested", "parent_account.password_reset"} <= actions


async def test_short_new_password_is_rejected_and_keeps_the_token(
    make_parent: MakeParent, anon_client: AsyncClient, outbox: list[dict[str, str]]
) -> None:
    await make_parent(email="hoa@example.com")
    token = await request_token(anon_client, outbox, "hoa@example.com")

    short = await anon_client.post(RESET, json={"token": token, "password": "short"})
    ok = await anon_client.post(RESET, json={"token": token, "password": NEW_PASSWORD})

    assert short.status_code == 422 and ok.status_code == 204


async def test_forgot_is_rate_limited_per_ip(anon_client: AsyncClient) -> None:
    forgot_limiter.reset()
    statuses = [
        (await anon_client.post(FORGOT, json={"email": f"x{i}@example.com"})).status_code
        for i in range(6)
    ]

    assert statuses == [202] * 5 + [429]


async def test_registration_email_is_what_forgot_looks_up(
    anon_client: AsyncClient, outbox: list[dict[str, str]]
) -> None:
    await anon_client.post("/api/parent/auth/register", json=register_body())

    await request_token(anon_client, outbox, "hoa.tran@example.com")

    assert outbox[-1]["to"] == "hoa.tran@example.com"
