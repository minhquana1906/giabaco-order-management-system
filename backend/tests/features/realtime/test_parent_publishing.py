from collections.abc import Callable
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import AuditLog
from app.core.events import bus
from app.features.orders.models import Order
from app.features.parent_accounts.models import ParentStudentLink
from app.features.students.models import Student
from tests.conftest import (
    CHILDREN,
    MakeParent,
    Payload,
    child_body,
    claim_key,
    claimed_student,
    count_rows,
)
from tests.features.conftest import OpenCampaign


@pytest.fixture
def break_commits(monkeypatch: pytest.MonkeyPatch) -> Callable[[], None]:
    async def failing_commit(self: AsyncSession) -> None:
        raise RuntimeError("commit failed")

    return lambda: monkeypatch.setattr(AsyncSession, "commit", failing_commit)


async def audits(session: AsyncSession, *actions: str) -> int:
    query = select(func.count()).select_from(AuditLog).where(AuditLog.action.in_(actions))
    return int(await session.scalar(query) or 0)


def assert_server_error(response: Any) -> None:
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal_error"


async def test_failed_commit_on_create_child_publishes_nothing_and_stores_nothing(
    make_parent: MakeParent,
    school_class: dict[str, Any],
    session: AsyncSession,
    break_commits: Callable[[], None],
) -> None:
    parent = await make_parent()
    break_commits()

    async with bus.subscribe() as queue:
        r = await parent.post(CHILDREN, json=child_body(school_class, height_cm=126.5))

        assert_server_error(r)
        assert queue.empty()
    assert await count_rows(session, Student) == 0
    assert await count_rows(session, ParentStudentLink) == 0
    assert await audits(session, "student.create", "parent_student_link.create") == 0


async def test_failed_commit_on_claim_publishes_nothing_and_links_nothing(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
    session: AsyncSession,
    break_commits: Callable[[], None],
) -> None:
    await client.post("/api/students", json=student_payload())
    parent = await make_parent()
    break_commits()

    async with bus.subscribe() as queue:
        r = await parent.post(f"{CHILDREN}/claim", json=claim_key(school_class))

        assert_server_error(r)
        assert queue.empty()
    assert await count_rows(session, ParentStudentLink) == 0
    assert await audits(session, "parent_student_link.create") == 0


async def test_failed_commit_on_edit_publishes_nothing_and_changes_nothing(
    make_parent: MakeParent,
    school_class: dict[str, Any],
    session: AsyncSession,
    break_commits: Callable[[], None],
) -> None:
    parent = await make_parent()
    created = (await parent.post(CHILDREN, json=child_body(school_class, height_cm=126.5))).json()
    break_commits()

    async with bus.subscribe() as queue:
        r = await parent.put(
            f"{CHILDREN}/{created['student_id']}",
            json={
                "class_id": school_class["class_id"],
                "gender": "FEMALE",
                "height_cm": 150,
                "weight_kg": 40,
            },
        )

        assert_server_error(r)
        assert queue.empty()
    row = (await session.execute(select(Student.height_cm))).one()
    assert row.height_cm == 126.5
    assert await audits(session, "student.update") == 0


async def test_failed_commit_on_unlink_publishes_nothing_and_keeps_the_link(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
    session: AsyncSession,
    break_commits: Callable[[], None],
) -> None:
    parent = await make_parent()
    student = await claimed_student(client, parent, student_payload, school_class)
    break_commits()

    async with bus.subscribe() as queue:
        r = await client.delete(f"/api/students/{student['id']}/parents/{parent.parent_id}")

        assert_server_error(r)
        assert queue.empty()
    assert await count_rows(session, ParentStudentLink) == 1
    assert await audits(session, "parent_student_link.delete") == 0


def order_url(kind: str, student: dict[str, Any]) -> str:
    root = (
        f"{CHILDREN}/{student['id']}"
        if kind == "account"
        else f"/api/public/students/{student['portal_token']}"
    )
    return f"{root}/order"


def order_body(products: dict[str, Any], size: str = "3") -> dict[str, Any]:
    return {
        "kit_lines": [],
        "item_lines": [{"product_id": str(products["blazer"].id), "size_label": size, "qty": 1}],
    }


@pytest.mark.parametrize("kind", ["account", "qr"])
async def test_failed_commit_on_order_put_publishes_nothing_and_stores_nothing(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
    products: dict[str, Any],
    open_campaign: OpenCampaign,
    session: AsyncSession,
    break_commits: Callable[[], None],
    kind: str,
) -> None:
    await open_campaign(school_class["school_id"])
    parent = await make_parent()
    student = await claimed_student(client, parent, student_payload, school_class)
    break_commits()

    async with bus.subscribe() as queue:
        r = await (parent if kind == "account" else client).put(
            order_url(kind, student), json=order_body(products)
        )

        assert_server_error(r)
        assert queue.empty()
    assert await count_rows(session, Order) == 0
    assert await audits(session, "order.create", "order.lines.replace") == 0


@pytest.mark.parametrize("kind", ["account", "qr"])
@pytest.mark.parametrize(
    ("campaign_open", "body", "status"),
    [
        (True, {"kit_lines": [], "item_lines": []}, 422),
        (True, "bad_size", 422),
        (False, "ok", 409),
    ],
)
async def test_order_event_is_not_published_for_rejected_requests(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
    products: dict[str, Any],
    open_campaign: OpenCampaign,
    kind: str,
    campaign_open: bool,
    body: Any,
    status: int,
) -> None:
    if campaign_open:
        await open_campaign(school_class["school_id"])
    parent = await make_parent()
    student = await claimed_student(client, parent, student_payload, school_class)
    if isinstance(body, str):
        body = order_body(products, "99" if body == "bad_size" else "3")

    async with bus.subscribe() as queue:
        r = await (parent if kind == "account" else client).put(order_url(kind, student), json=body)

        assert r.status_code == status
        assert queue.empty()


@pytest.mark.parametrize("path", ["order", "ordering"])
async def test_order_event_is_not_published_for_an_unknown_token_or_child(
    client: AsyncClient, make_parent: MakeParent, path: str
) -> None:
    parent = await make_parent()
    method = "PUT" if path == "order" else "GET"
    body = {"kit_lines": [], "item_lines": []} if method == "PUT" else None

    async with bus.subscribe() as queue:
        by_token = await client.request(
            method, f"/api/public/students/no-such-token/{path}", json=body
        )
        by_child = await parent.request(
            method, f"{CHILDREN}/00000000-0000-0000-0000-000000000000/{path}", json=body
        )

        assert by_token.status_code == by_child.status_code == 404
        assert queue.empty()
