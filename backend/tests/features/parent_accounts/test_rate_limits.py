from typing import Any

import pytest
from httpx import AsyncClient, Response

from app.core.security import parent_auth_limiter, parent_match_limiter
from tests.conftest import MakeParent, child_body

RATE_LIMITED = {
    "error": {
        "code": "rate_limited",
        "message": "Bạn thao tác quá nhanh. Vui lòng đợi vài phút rồi thử lại.",
    }
}


def without_request_id(response: Response) -> dict[str, Any]:
    """The per-request id differs on every call, so it is checked separately."""
    body = response.json()
    body["error"].pop("request_id")
    return body  # type: ignore[no-any-return]


REGISTER = "/api/parent/auth/register"
LOGIN = "/api/parent/auth/login"
LOOKUP = "/api/parent/children/lookup"
CLAIM = "/api/parent/children/claim"
CREATE = "/api/parent/children"
MATCH_ROUTES = [LOOKUP, CLAIM, CREATE]


def match_body(school_class: dict[str, Any]) -> dict[str, Any]:
    """Reaches every match route but is too short to ever create a record."""
    return child_body(school_class, full_name="Không Có Thật", height_cm=1)


def invalid_register(i: int) -> dict[str, Any]:
    return {"full_name": f"Phụ Huynh {i}", "email": f"p{i}@example.com", "password": "short"}


async def test_register_login_and_match_routes_answer_429_with_the_error_envelope(
    anon_client: AsyncClient, make_parent: MakeParent, school_class: dict[str, Any]
) -> None:
    parent = await make_parent()
    parent_auth_limiter.reset()
    for path, body in [
        (REGISTER, invalid_register(0)),
        (LOGIN, {"identifier": "a@b.vn", "password": "x"}),
    ]:
        parent_auth_limiter.reset()
        for _ in range(10):
            assert (await anon_client.post(path, json=body)).status_code != 429
        limited = await anon_client.post(path, json=body)
        assert limited.status_code == 429 and without_request_id(limited) == RATE_LIMITED
        assert 1 <= int(limited.headers["retry-after"]) <= 60

    for path in MATCH_ROUTES:
        parent_match_limiter.reset()
        for _ in range(10):
            assert (await parent.post(path, json=match_body(school_class))).status_code != 429
        limited = await parent.post(path, json=match_body(school_class))
        assert limited.status_code == 429 and without_request_id(limited) == RATE_LIMITED
        assert 1 <= int(limited.headers["retry-after"]) <= 60


async def test_lookup_claim_and_create_spend_one_shared_budget(
    make_parent: MakeParent, school_class: dict[str, Any]
) -> None:
    parent = await make_parent()
    body = match_body(school_class)
    for path, times in [(LOOKUP, 4), (CLAIM, 3), (CREATE, 3)]:
        for _ in range(times):
            assert (await parent.post(path, json=body)).status_code != 429

    statuses = [(await parent.post(path, json=body)).status_code for path in MATCH_ROUTES]

    assert statuses == [429, 429, 429]


async def test_register_and_login_spend_one_shared_budget(anon_client: AsyncClient) -> None:
    for i in range(5):
        assert (await anon_client.post(REGISTER, json=invalid_register(i))).status_code == 422
    for _ in range(5):
        login = await anon_client.post(LOGIN, json={"identifier": "a@b.vn", "password": "x"})
        assert login.status_code == 401

    register = await anon_client.post(REGISTER, json=invalid_register(9))
    login = await anon_client.post(LOGIN, json={"identifier": "a@b.vn", "password": "x"})

    assert register.status_code == login.status_code == 429


@pytest.mark.parametrize("path", [LOOKUP, CLAIM, CREATE])
async def test_the_match_budget_is_per_client_address(
    make_parent: MakeParent, school_class: dict[str, Any], path: str
) -> None:
    parent = await make_parent()
    for _ in range(10):
        await parent.post(
            path, json=match_body(school_class), headers={"cf-connecting-ip": "203.0.113.1"}
        )

    other = await parent.post(
        path, json=match_body(school_class), headers={"cf-connecting-ip": "203.0.113.2"}
    )

    assert other.status_code != 429
