import json
import uuid
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import AuditLog
from app.core.events import bus
from app.features.orders.models import Order
from tests.conftest import (
    CHILDREN,
    MakeParent,
    ParentClient,
    Payload,
    claimed_student,
    count_rows,
    declare_child,
)
from tests.features.conftest import OpenCampaign

TRIALS = [{"product_code": "blazer", "size_label": "2", "fit": "FITS", "note": "bí mật"}]
ORDER_BODY = {
    "kit_lines": [],
    "item_lines": [{"product_id": str(uuid.uuid4()), "size_label": "3", "qty": 1}],
}


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


async def test_order_lifecycle_through_the_account(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
    products: dict[str, Any],
    open_campaign: OpenCampaign,
    session: AsyncSession,
) -> None:
    await open_campaign(school_class["school_id"])
    parent = await make_parent()
    student = await claimed_with_pii(client, parent, student_payload, school_class)
    base = f"{CHILDREN}/{student['id']}"
    listed = (await parent.get(CHILDREN)).json()[0]
    assert listed["order_summary"] is None and listed["campaign_open"] is True
    body = {
        "kit_lines": [],
        "item_lines": [
            {"product_id": str(products["blazer"].id), "size_label": "3", "qty": 2},
            {"product_id": str(products["gile"].id), "size_label": "3", "qty": 1},
        ],
    }

    async with bus.subscribe() as queue:
        r = await parent.put(f"{base}/order", json=body)
        assert queue.get_nowait() == {"orders"}

    assert r.status_code == 200, r.text
    assert r.json() == (await parent.get(f"{base}/ordering")).json()
    assert r.json()["order"]["total"] == 1_000_000 and r.json()["order"]["has_unpriced"] is True
    assert (await parent.get(CHILDREN)).json()[0]["order_summary"] == {
        "items": 3,
        "amount": 1_000_000,
        "has_unpriced": True,
        "status": "SUBMITTED",
    }
    orders = await client.get(f"/api/campaigns/{r.json()['campaign']['id']}/orders")
    assert orders.status_code == 200 and orders.json()["total"] == 1
    log = await session.scalar(select(AuditLog).where(AuditLog.action == "order.create"))
    assert log is not None and log.actor == f"parent:{parent.parent_id}"


async def test_account_order_is_blocked_once_the_campaign_is_locked(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
    products: dict[str, Any],
    open_campaign: OpenCampaign,
    session: AsyncSession,
) -> None:
    campaign = await open_campaign(school_class["school_id"])
    parent = await make_parent()
    student = await claimed_with_pii(client, parent, student_payload, school_class)
    body = {
        "kit_lines": [],
        "item_lines": [{"product_id": str(products["blazer"].id), "size_label": "3", "qty": 1}],
    }
    assert (await parent.put(f"{CHILDREN}/{student['id']}/order", json=body)).status_code == 200
    campaign.status = "LOCKED"
    await session.commit()

    r = await parent.put(f"{CHILDREN}/{student['id']}/order", json=body)

    assert r.status_code == 409 and r.json()["error"]["code"] == "campaign_locked"
    assert (await parent.get(CHILDREN)).json()[0]["order_summary"]["status"] == "SUBMITTED"


@pytest.mark.parametrize(("method", "suffix"), [("GET", "ordering"), ("PUT", "order")])
async def test_unlinked_or_foreign_children_are_not_found(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
    open_campaign: OpenCampaign,
    session: AsyncSession,
    method: str,
    suffix: str,
) -> None:
    await open_campaign(school_class["school_id"])
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
            r = await who.request(
                method,
                f"{CHILDREN}/{student_id}/{suffix}",
                json=ORDER_BODY if method == "PUT" else None,
            )
            assert r.status_code == 404, (who is owner, student_id, method)
            assert r.json()["error"]["code"] == "not_found"
    assert await count_rows(session, Order) == 0


@pytest.mark.parametrize(("method", "suffix"), [("GET", "ordering"), ("PUT", "order")])
async def test_portal_account_routes_reject_admin_sessions(
    client: AsyncClient, method: str, suffix: str
) -> None:
    path = f"{CHILDREN}/{uuid.uuid4()}/{suffix}"

    r = await client.request(method, path, json=ORDER_BODY if method == "PUT" else None)

    assert r.status_code == 401 and r.json()["error"]["code"] == "unauthorized"


@pytest.mark.parametrize(("method", "suffix"), [("GET", "ordering"), ("PUT", "order")])
async def test_declared_child_is_unreachable_for_an_unlinked_parent(
    client: AsyncClient,
    make_parent: MakeParent,
    school_class: dict[str, Any],
    open_campaign: OpenCampaign,
    session: AsyncSession,
    method: str,
    suffix: str,
) -> None:
    await open_campaign(school_class["school_id"])
    owner, stranger = await make_parent(), await make_parent()
    child = await declare_child(owner, school_class)
    path = f"{CHILDREN}/{child['student_id']}/{suffix}"

    r = await stranger.request(method, path, json=ORDER_BODY if method == "PUT" else None)

    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"
    assert await count_rows(session, Order) == 0


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
