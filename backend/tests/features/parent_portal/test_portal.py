from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import AuditLog
from app.core.events import bus
from tests.conftest import Payload


async def make_student(client: AsyncClient, payload: Payload) -> dict[str, Any]:
    trials = [{"product_code": "blazer", "size_label": "2", "fit": "FITS", "note": "bí mật"}]
    r = await client.post(
        "/api/students",
        json=payload(parent_email="phu.huynh@example.com", parent_name="Phụ Huynh", trials=trials),
    )
    return r.json()  # type: ignore[no-any-return]


async def test_public_view_has_no_pii(client: AsyncClient, student_payload: Payload) -> None:
    student = await make_student(client, student_payload)
    r = await client.get(f"/api/public/students/{student['portal_token']}")
    assert r.status_code == 200
    body = r.json()
    assert body["full_name"] == "Nguyễn Minh Khang" and body["class_name"] == "2A1"
    assert body["trials"] == [
        {
            "product_code": "blazer",
            "product_name": "Áo Blazer (Vest)",
            "size_label": "2",
            "fit": "FITS",
        }
    ]
    assert [p["code"] for p in body["products"]] == ["blazer", "gile"]
    raw = r.text
    for secret in ("0912345678", "phu.huynh", "2018-03-14", "dob", "parent_", "bí mật"):
        assert secret not in raw
    assert r.headers["x-robots-tag"] == "noindex"


async def test_bad_token_404(anon_client: AsyncClient) -> None:
    r = await anon_client.get("/api/public/students/does-not-exist")
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"
    assert r.headers["x-robots-tag"] == "noindex"


async def test_choice_lifecycle_visible_to_admin(
    client: AsyncClient, student_payload: Payload, session: AsyncSession
) -> None:
    student = await make_student(client, student_payload)
    url = f"/api/public/students/{student['portal_token']}/size-choices"
    async with bus.subscribe() as queue:
        r = await client.put(f"{url}/blazer", json={"size_label": "3", "colour": "navy"})
        assert r.status_code == 200 and r.json()["size_label"] == "3"
        assert queue.get_nowait() == {"choices"}
    assert (await client.put(f"{url}/blazer", json={"size_label": "4", "colour": "navy"})).json()[
        "size_label"
    ] == "4"
    assert (await client.get(f"/api/public/students/{student['portal_token']}")).json()[
        "choices"
    ] == {"blazer": {"size_label": "4", "colour": "navy"}}

    detail = (await client.get(f"/api/students/{student['id']}")).json()
    assert [
        (c["product_code"], c["size_label"], c["colour"]) for c in detail["parent_choices"]
    ] == [("blazer", "4", "navy")]

    assert (await client.delete(f"{url}/blazer")).status_code == 204
    assert (await client.delete(f"{url}/blazer")).status_code == 204
    assert (await client.get(f"/api/students/{student['id']}")).json()["parent_choices"] == []
    actions = (
        await session.scalars(
            select(AuditLog.action).where(AuditLog.entity == "parent_size_choice")
        )
    ).all()
    assert sorted(actions) == ["choice.clear", "choice.set", "choice.set"]


async def test_choice_validation(client: AsyncClient, student_payload: Payload) -> None:
    student = await make_student(client, student_payload)
    url = f"/api/public/students/{student['portal_token']}/size-choices"
    assert (
        await client.put(f"{url}/blazer", json={"size_label": "99", "colour": "navy"})
    ).status_code == 422
    assert (
        await client.put(f"{url}/hat", json={"size_label": "1", "colour": "navy"})
    ).status_code == 404
    assert (
        await client.put(
            "/api/public/students/bad/size-choices/blazer",
            json={"size_label": "1", "colour": "navy"},
        )
    ).status_code == 404


@pytest.mark.parametrize("body", [{"size_label": "3"}, {"size_label": "3", "colour": "red"}])
async def test_choice_requires_valid_colour(
    client: AsyncClient, student_payload: Payload, body: dict[str, str]
) -> None:
    student = await make_student(client, student_payload)
    url = f"/api/public/students/{student['portal_token']}/size-choices/blazer"
    r = await client.put(url, json=body)
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"
    assert "colour" in r.json()["error"]["fields"]


async def test_deleted_student_token_404(client: AsyncClient, student_payload: Payload) -> None:
    student = await make_student(client, student_payload)
    await client.delete(f"/api/students/{student['id']}")
    assert (await client.get(f"/api/public/students/{student['portal_token']}")).status_code == 404


async def test_public_rate_limit(anon_client: AsyncClient) -> None:
    codes = {(await anon_client.get("/api/public/students/x")).status_code for _ in range(61)}
    assert codes == {404, 429}
