import uuid
from typing import Any

from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import AuditLog
from app.core.events import bus
from app.features.orders.models import Order
from app.features.parent_accounts.models import ParentStudentLink
from tests.conftest import MakeParent, Payload, claim_key, count_rows
from tests.features.conftest import OpenCampaign

CLAIM = "/api/parent/children/claim"


async def test_admin_unlinks_a_parent_and_the_order_stays(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
    products: dict[str, Any],
    open_campaign: OpenCampaign,
    session: AsyncSession,
) -> None:
    mother, father = await make_parent(), await make_parent()
    student = (await client.post("/api/students", json=student_payload())).json()
    for parent in (mother, father):
        assert (await parent.post(CLAIM, json=claim_key(school_class))).status_code == 200
    url = f"/api/parent/children/{student['id']}"
    campaign = await open_campaign(school_class["school_id"])
    placed = await mother.put(
        f"{url}/order",
        json={
            "item_lines": [{"product_id": str(products["blazer"].id), "size_label": "3", "qty": 1}]
        },
    )
    assert placed.status_code == 200 and campaign.status == "OPEN"

    async with bus.subscribe() as queue:
        r = await client.delete(f"/api/students/{student['id']}/parents/{mother.parent_id}")
        assert queue.get_nowait() == {"students"}

    assert r.status_code == 204 and r.content == b""
    assert (await mother.get(url)).status_code == 404
    assert (
        await mother.put(
            f"{url}/order",
            json={"item_lines": [{"product_id": str(uuid.uuid4()), "size_label": "4", "qty": 1}]},
        )
    ).status_code == 404
    assert (await mother.get("/api/parent/children")).json() == []
    assert (await father.get(url)).status_code == 200
    detail = (await client.get(f"/api/students/{student['id']}")).json()
    assert [p["parent_id"] for p in detail["linked_parents"]] == [father.parent_id]
    assert await count_rows(session, Order) == 1
    log = await session.scalar(
        select(AuditLog).where(AuditLog.action == "parent_student_link.delete")
    )
    assert log is not None and log.actor == "admin" and log.after is None
    assert log.before == {
        "parent_id": mother.parent_id,
        "student_id": student["id"],
        "origin": "CLAIMED",
    }


async def test_unlinked_parent_can_claim_again(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
) -> None:
    parent = await make_parent()
    student = (await client.post("/api/students", json=student_payload())).json()
    await parent.post(CLAIM, json=claim_key(school_class))
    await client.delete(f"/api/students/{student['id']}/parents/{parent.parent_id}")

    again = await parent.post(CLAIM, json=claim_key(school_class))

    assert again.status_code == 200 and again.json()["student_id"] == student["id"]


async def test_unlinking_a_missing_link_is_not_found(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
    session: AsyncSession,
) -> None:
    linked, stranger = await make_parent(), await make_parent()
    student = (await client.post("/api/students", json=student_payload())).json()
    await linked.post(CLAIM, json=claim_key(school_class))
    base = f"/api/students/{student['id']}/parents"

    not_linked = await client.delete(f"{base}/{stranger.parent_id}")
    unknown_parent = await client.delete(f"{base}/{uuid.uuid4()}")
    unknown_student = await client.delete(
        f"/api/students/{uuid.uuid4()}/parents/{linked.parent_id}"
    )
    assert (await client.delete(f"{base}/{linked.parent_id}")).status_code == 204
    twice = await client.delete(f"{base}/{linked.parent_id}")

    for r in (not_linked, unknown_parent, unknown_student, twice):
        assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"
    assert await count_rows(session, ParentStudentLink) == 0
    deletes = await session.scalar(
        select(func.count())
        .select_from(AuditLog)
        .where(AuditLog.action == "parent_student_link.delete")
    )
    assert deletes == 1


async def test_a_parent_session_cannot_unlink(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
    session: AsyncSession,
) -> None:
    parent = await make_parent()
    student = (await client.post("/api/students", json=student_payload())).json()
    await parent.post(CLAIM, json=claim_key(school_class))

    r = await parent.delete(f"/api/students/{student['id']}/parents/{parent.parent_id}")

    assert r.status_code == 401 and r.json()["error"]["code"] == "unauthorized"
    assert await count_rows(session, ParentStudentLink) == 1
