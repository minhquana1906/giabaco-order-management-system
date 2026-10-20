from typing import Any

import pytest
from httpx import AsyncClient

from tests.conftest import CHILDREN, MakeParent, child_body, register_body

REGISTER = "/api/parent/auth/register"
LOGIN = "/api/parent/auth/login"


@pytest.mark.parametrize(
    ("path", "body", "field"),
    [
        (REGISTER, register_body(full_name="a\x00b"), "full_name"),
        (REGISTER, register_body(full_name="a\tb"), "full_name"),
        (REGISTER, register_body(email="a\x00@b.vn"), "email"),
        (REGISTER, register_body(email=None, phone="09\x0012345678"), "phone"),
        (REGISTER, register_body(password="pass\x00word123"), "password"),
        (REGISTER, register_body(password="pass\nword123"), "password"),
        (LOGIN, {"identifier": "a\x00b", "password": "x"}, "identifier"),
        (LOGIN, {"identifier": "a@b.vn", "password": "x\x00y"}, "password"),
        (LOGIN, {"identifier": "x" * 201, "password": "x"}, "identifier"),
        (LOGIN, {"identifier": "a@b.vn", "password": "x" * 129}, "password"),
    ],
)
async def test_auth_rejects_control_characters_and_oversized_input(
    anon_client: AsyncClient, path: str, body: dict[str, Any], field: str
) -> None:
    r = await anon_client.post(path, json=body)

    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"
    assert field in r.json()["error"]["fields"]


async def test_lone_surrogate_is_rejected(anon_client: AsyncClient) -> None:
    raw = b'{"full_name": "a\\ud800b", "email": "a@b.vn", "password": "mat-khau-123"}'

    r = await anon_client.post(REGISTER, content=raw, headers={"content-type": "application/json"})

    assert r.status_code == 422 and "full_name" in r.json()["error"]["fields"]


@pytest.mark.parametrize("route", ["lookup", "claim", ""])
async def test_child_name_rejects_control_characters(
    make_parent: MakeParent, school_class: dict[str, Any], route: str
) -> None:
    parent = await make_parent()
    body = child_body(school_class, full_name="Lê\x00Anh")

    r = await parent.post(f"{CHILDREN}/{route}".rstrip("/"), json=body)

    assert r.status_code == 422 and "full_name" in r.json()["error"]["fields"]


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", "/api/public/students/%00"),
        ("PUT", "/api/public/students/abc/size-choices/%00"),
        ("DELETE", "/api/public/students/abc/size-choices/%00"),
        ("PUT", "/api/public/students/%00/size-choices/blazer"),
    ],
)
async def test_public_path_parameters_reject_control_characters(
    anon_client: AsyncClient, method: str, path: str
) -> None:
    r = await anon_client.request(method, path, json={"size_label": "3", "colour": "navy"})

    assert r.status_code == 422 and r.json()["error"]["code"] == "validation_error"
