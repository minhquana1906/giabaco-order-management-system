import json
import uuid
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import AuditLog
from app.core.events import bus
from app.features.parent_portal.models import ParentSizeChoice
from tests.conftest import (
    CHILDREN,
    MakeParent,
    ParentClient,
    Payload,
    claimed_student,
    declare_child,
)

TRIALS = [{"product_code": "blazer", "size_label": "2", "fit": "FITS", "note": "bí mật"}]


async def claimed_with_pii(
    admin: AsyncClient, parent: ParentClient, payload: Payload, school_class: dict[str, Any]
) -> dict[str, Any]:
    """Claimed student whose admin record holds contact details and a trial note."""
    return await claimed_student(
        admin,
        parent,
        payload,
        school_class,
        parent_email="ph@example.com",
        parent_name="Phụ Huynh",
        trials=TRIALS,
    )


async def test_linked_child_has_the_public_schema_without_pii(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
) -> None:
    parent = await make_parent()
    student = await claimed_with_pii(client, parent, student_payload, school_class)

    r = await parent.get(f"{CHILDREN}/{student['id']}")

    assert r.status_code == 200
    assert r.json() == (await client.get(f"/api/public/students/{student['portal_token']}")).json()
    for secret in ("0912345678", "ph@example.com", "2018-03-14", "dob", "parent_", "bí mật"):
        assert secret not in r.text
    assert r.json()["data_source"] == "ADMIN_MEASURED"
    assert r.json()["gender"] == "MALE"


async def test_public_view_suggests_sizes_from_the_size_guide(
    make_parent: MakeParent, school_class: dict[str, Any], client: AsyncClient
) -> None:
    parent = await make_parent()
    body = {
        "school_id": school_class["school_id"],
        "class_id": school_class["class_id"],
        "full_name": "Lê Minh Anh",
        "dob": "2017-09-01",
        "gender": "FEMALE",
        "height_cm": 140,
        "weight_kg": 32,
        "parent_phone": "0912345678",
    }
    created = (await parent.post(CHILDREN, json=body)).json()

    r = await parent.get(f"{CHILDREN}/{created['student_id']}")

    assert r.json()["data_source"] == "PARENT_DECLARED"
    assert r.json()["gender"] == "FEMALE"
    assert r.json()["suggested_sizes"] == {"blazer": "4", "gile": "4"}
    assert r.json()["trials"] == []
    assert (r.json()["height_cm"], r.json()["weight_kg"]) == (140.0, 32.0)


async def test_qr_view_also_carries_data_source_and_suggestions(
    client: AsyncClient, student_payload: Payload
) -> None:
    created = (await client.post("/api/students", json=student_payload())).json()

    body = (await client.get(f"/api/public/students/{created['portal_token']}")).json()

    assert body["data_source"] == "ADMIN_MEASURED"
    assert body["gender"] == "MALE"
    assert set(body["suggested_sizes"]) == {"blazer", "gile"}


async def test_choice_lifecycle_through_the_account(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
    session: AsyncSession,
) -> None:
    parent = await make_parent()
    student = await claimed_with_pii(client, parent, student_payload, school_class)
    url = f"{CHILDREN}/{student['id']}/size-choices/blazer"

    async with bus.subscribe() as queue:
        first = await parent.put(url, json={"size_label": "3"})
        assert queue.get_nowait() == {"choices"}
    assert first.status_code == 200
    assert set(first.json()) == {"product_code", "size_label", "chosen_at"}
    assert (await parent.put(url, json={"size_label": "4"})).json()["size_label"] == "4"
    assert (await parent.get(f"{CHILDREN}/{student['id']}")).json()["choices"] == {"blazer": "4"}
    assert (await parent.get(CHILDREN)).json()[0]["choices"] == [
        {"product_code": "blazer", "product_name": "Áo Blazer (Vest)", "size_label": "4"}
    ]
    detail = (await client.get(f"/api/students/{student['id']}")).json()
    assert [(c["product_code"], c["size_label"]) for c in detail["parent_choices"]] == [
        ("blazer", "4")
    ]

    async with bus.subscribe() as queue:
        assert (await parent.delete(url)).status_code == 204
        assert queue.get_nowait() == {"choices"}
    assert (await parent.delete(url)).status_code == 204
    assert (await parent.get(f"{CHILDREN}/{student['id']}")).json()["choices"] == {}

    logs = (
        await session.scalars(
            select(AuditLog)
            .where(AuditLog.entity == "parent_size_choice")
            .order_by(AuditLog.at, AuditLog.action)
        )
    ).all()
    assert [log.action for log in logs] == ["choice.set", "choice.set", "choice.clear"]
    assert {log.actor for log in logs} == {f"parent:{parent.parent_id}"}
    assert logs[0].before is None and logs[0].after == {"product_code": "blazer", "size_label": "3"}
    assert logs[1].before == {"size_label": "3"} and logs[1].after == {
        "product_code": "blazer",
        "size_label": "4",
    }
    assert logs[2].before == {"product_code": "blazer", "size_label": "4"}


async def test_qr_path_keeps_the_plain_parent_actor(
    client: AsyncClient, student_payload: Payload, session: AsyncSession
) -> None:
    created = (await client.post("/api/students", json=student_payload())).json()

    await client.put(
        f"/api/public/students/{created['portal_token']}/size-choices/blazer",
        json={"size_label": "3"},
    )

    log = await session.scalar(select(AuditLog).where(AuditLog.action == "choice.set"))
    assert log is not None and log.actor == "parent"


async def test_choice_validation_through_the_account(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
    session: AsyncSession,
) -> None:
    parent = await make_parent()
    student = await claimed_with_pii(client, parent, student_payload, school_class)
    base = f"{CHILDREN}/{student['id']}/size-choices"

    bad_size = await parent.put(f"{base}/blazer", json={"size_label": "99"})
    unknown_product = await parent.put(f"{base}/nope", json={"size_label": "3"})
    empty = await parent.put(f"{base}/blazer", json={"size_label": ""})

    assert bad_size.status_code == 422 and bad_size.json()["error"]["code"] == "validation_error"
    assert unknown_product.status_code == 404
    assert empty.status_code == 422
    assert await session.scalar(select(func.count()).select_from(ParentSizeChoice)) == 0


@pytest.mark.parametrize("method", ["GET", "PUT", "DELETE"])
async def test_unlinked_or_foreign_children_are_not_found(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
    session: AsyncSession,
    method: str,
) -> None:
    owner, stranger = await make_parent(), await make_parent()
    linked = await claimed_with_pii(client, owner, student_payload, school_class)
    unclaimed = (
        await client.post("/api/students", json=student_payload(full_name="Trần Văn Bình"))
    ).json()
    soft_deleted = (
        await client.post("/api/students", json=student_payload(full_name="Phạm Thị Cúc"))
    ).json()
    await owner.post(
        f"{CHILDREN}/claim",
        json={
            "school_id": school_class["school_id"],
            "full_name": "Phạm Thị Cúc",
            "dob": "2018-03-14",
        },
    )
    await client.delete(f"/api/students/{soft_deleted['id']}")

    for student_id in (linked["id"], unclaimed["id"], soft_deleted["id"], str(uuid.uuid4())):
        for who in (stranger, owner) if student_id != linked["id"] else (stranger,):
            path = f"{CHILDREN}/{student_id}" + ("" if method == "GET" else "/size-choices/blazer")
            r = await who.request(
                method, path, json={"size_label": "3"} if method == "PUT" else None
            )
            assert r.status_code == 404, (who is owner, student_id, method)
            assert r.json()["error"]["code"] == "not_found"
    assert await session.scalar(select(func.count()).select_from(ParentSizeChoice)) == 0


async def test_a_parent_cannot_clear_another_parents_choice(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
    session: AsyncSession,
) -> None:
    owner, stranger = await make_parent(), await make_parent()
    student = await claimed_with_pii(client, owner, student_payload, school_class)
    url = f"{CHILDREN}/{student['id']}/size-choices/blazer"
    await owner.put(url, json={"size_label": "3"})

    assert (await stranger.delete(url)).status_code == 404
    assert (await stranger.put(url, json={"size_label": "5"})).status_code == 404

    choice = await session.scalar(select(ParentSizeChoice))
    assert choice is not None and choice.size_label == "3"


@pytest.mark.parametrize("method", ["GET", "PUT", "DELETE"])
async def test_portal_account_routes_reject_admin_sessions(
    client: AsyncClient, method: str
) -> None:
    path = f"{CHILDREN}/{uuid.uuid4()}" + ("" if method == "GET" else "/size-choices/blazer")

    r = await client.request(method, path, json={"size_label": "3"} if method == "PUT" else None)

    assert r.status_code == 401 and r.json()["error"]["code"] == "unauthorized"


@pytest.mark.parametrize("method", ["GET", "PUT", "DELETE"])
async def test_declared_child_is_unreachable_for_an_unlinked_parent(
    client: AsyncClient,
    make_parent: MakeParent,
    school_class: dict[str, Any],
    session: AsyncSession,
    method: str,
) -> None:
    owner, stranger = await make_parent(), await make_parent()
    child = await declare_child(owner, school_class)
    path = f"{CHILDREN}/{child['student_id']}" + ("" if method == "GET" else "/size-choices/blazer")

    r = await stranger.request(method, path, json={"size_label": "3"} if method == "PUT" else None)

    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"
    assert await session.scalar(select(func.count()).select_from(ParentSizeChoice)) == 0


async def test_declared_child_token_is_never_handed_to_any_parent_response(
    client: AsyncClient,
    make_parent: MakeParent,
    school_class: dict[str, Any],
    session: AsyncSession,
) -> None:
    owner, stranger = await make_parent(), await make_parent()
    child = await declare_child(owner, school_class)
    token = (await client.get(f"/api/students/{child['student_id']}")).json()["portal_token"]
    key = {"school_id": school_class["school_id"], "full_name": "Lê Minh Anh", "dob": "2017-09-01"}

    responses = [
        await owner.get(CHILDREN),
        await owner.get(f"{CHILDREN}/{child['student_id']}"),
        await stranger.post(f"{CHILDREN}/lookup", json=key),
        await stranger.post(f"{CHILDREN}/claim", json=key),
        await stranger.get(CHILDREN),
    ]

    assert [r.status_code for r in responses] == [200, 200, 200, 200, 200]
    assert token not in json.dumps(child)
    assert all(token not in r.text for r in responses)
    guessed = await stranger.get(f"/api/public/students/{token[::-1]}")
    assert guessed.status_code == 404


@pytest.mark.parametrize(
    ("height", "weight", "expected"),
    [
        (100, 15, "1"),
        (119.9, 19.9, "1"),
        (120, 20, "2"),
        (95, 12, None),
        (99.9, 14.9, None),
        (165, 20, "7"),
        (110, 12, "1"),
        (190, 90, "7"),
    ],
)
async def test_suggested_sizes_at_size_guide_edges(
    client: AsyncClient,
    make_parent: MakeParent,
    school_class: dict[str, Any],
    height: float,
    weight: float,
    expected: str | None,
) -> None:
    parent = await make_parent()
    child = await declare_child(parent, school_class, height_cm=height, weight_kg=weight)
    token = (await client.get(f"/api/students/{child['student_id']}")).json()["portal_token"]

    by_account = (await parent.get(f"{CHILDREN}/{child['student_id']}")).json()
    by_qr = (await client.get(f"/api/public/students/{token}")).json()

    assert by_account["suggested_sizes"] == by_qr["suggested_sizes"]
    assert by_account["suggested_sizes"] == {"blazer": expected, "gile": expected}
