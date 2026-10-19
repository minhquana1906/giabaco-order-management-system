import asyncio
from collections.abc import Awaitable, Callable
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import AuditLog
from app.core.events import bus
from app.features.parent_accounts.models import LinkOrigin, ParentStudentLink
from tests.conftest import ParentClient

MakeParent = Callable[..., Awaitable[ParentClient]]
Payload = Callable[..., dict[str, Any]]
LOOKUP = "/api/parent/children/lookup"
CLAIM = "/api/parent/children/claim"


def key(school_class: dict[str, Any], **overrides: Any) -> dict[str, Any]:
    body = {
        "school_id": school_class["school_id"],
        "full_name": "Nguyễn Văn An",
        "dob": "2018-03-14",
    }
    body.update(overrides)
    return body


async def admin_student(client: AsyncClient, payload: Payload, **overrides: Any) -> dict[str, Any]:
    r = await client.post(
        "/api/students", json=payload(**{"full_name": "Nguyễn Văn An", **overrides})
    )
    assert r.status_code == 201, r.text
    return r.json()  # type: ignore[no-any-return]


@pytest.mark.parametrize(
    "typed", ["Nguyễn Văn An", "nguyen van an ", "  NGUYEN   van   AN", "nguyễn văn an"]
)
async def test_lookup_ignores_case_accents_and_spaces(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
    typed: str,
) -> None:
    await admin_student(client, student_payload)
    parent = await make_parent()

    r = await parent.post(LOOKUP, json=key(school_class, full_name=typed))

    assert r.status_code == 200
    assert r.json() == {
        "found": True,
        "ambiguous": False,
        "full_name": "Nguyễn Văn An",
        "school_name": "Trường A",
        "class_name": "2A1",
    }


async def test_lookup_never_leaks_measurements_or_contacts(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
) -> None:
    student = await admin_student(client, student_payload, parent_email="ph@example.com")
    parent = await make_parent()

    r = await parent.post(LOOKUP, json=key(school_class))

    for secret in (
        "126.5",
        "24.0",
        "2018-03-14",
        "0912345678",
        "ph@example.com",
        student["portal_token"],
        student["id"],
    ):
        assert secret not in r.text


async def test_vietnamese_d_stroke_matches_plain_d(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
) -> None:
    await admin_student(client, student_payload, full_name="Đặng Thị Đào")
    parent = await make_parent()

    r = await parent.post(CLAIM, json=key(school_class, full_name="dang thi dao"))

    assert r.status_code == 200 and r.json()["full_name"] == "Đặng Thị Đào"


@pytest.mark.parametrize("override", ["dob", "school", "name"])
async def test_no_match_on_wrong_dob_school_or_name(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
    override: str,
) -> None:
    await admin_student(client, student_payload)
    other = (await client.post("/api/schools", json={"name": "Trường B", "code": "B"})).json()
    changes = {
        "dob": {"dob": "2018-03-15"},
        "school": {"school_id": other["id"]},
        "name": {"full_name": "Nguyễn Văn Anh"},
    }[override]
    parent = await make_parent()

    lookup = await parent.post(LOOKUP, json=key(school_class, **changes))
    claim = await parent.post(CLAIM, json=key(school_class, **changes))

    assert lookup.status_code == 200 and lookup.json() == {"found": False}
    assert claim.status_code == 404 and claim.json()["error"]["code"] == "no_match"


async def test_two_matches_are_ambiguous(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
    session: AsyncSession,
) -> None:
    await admin_student(client, student_payload)
    other_class = (
        await client.post(
            f"/api/schools/{school_class['school_id']}/classes", json={"grade": 2, "name": "2A2"}
        )
    ).json()
    await admin_student(client, student_payload, class_id=other_class["id"])
    parent = await make_parent()

    lookup = await parent.post(LOOKUP, json=key(school_class))
    claim = await parent.post(CLAIM, json=key(school_class))

    assert lookup.json() == {"found": True, "ambiguous": True}
    assert claim.status_code == 409 and claim.json()["error"]["code"] == "ambiguous_match"
    assert await session.scalar(select(func.count()).select_from(ParentStudentLink)) == 0


async def test_claim_creates_one_link_and_is_idempotent(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
    session: AsyncSession,
) -> None:
    student = await admin_student(client, student_payload)
    parent = await make_parent()

    async with bus.subscribe() as queue:
        first = await parent.post(CLAIM, json=key(school_class))
        assert queue.get_nowait() == {"students"}
    second = await parent.post(CLAIM, json=key(school_class, full_name="nguyen van an"))

    assert first.status_code == second.status_code == 200
    assert (
        first.json()
        == second.json()
        == {
            "student_id": student["id"],
            "full_name": "Nguyễn Văn An",
            "school_id": school_class["school_id"],
            "school_name": "Trường A",
            "class_id": school_class["class_id"],
            "class_name": "2A1",
            "gender": "MALE",
            "data_source": "ADMIN_MEASURED",
            "parent_name": None,
            "parent_phone": None,
            "parent_email": None,
            "choices": [],
        }
    )
    links = (await session.scalars(select(ParentStudentLink))).all()
    assert len(links) == 1 and links[0].origin is LinkOrigin.CLAIMED
    audits = (
        await session.scalars(
            select(AuditLog).where(AuditLog.action == "parent_student_link.create")
        )
    ).all()
    assert len(audits) == 1
    assert audits[0].actor == f"parent:{parent.parent_id}" and audits[0].entity_id == links[0].id


async def test_two_parents_can_claim_the_same_student(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
    session: AsyncSession,
) -> None:
    await admin_student(client, student_payload)
    mother, father = await make_parent(), await make_parent()

    assert (await mother.post(CLAIM, json=key(school_class))).status_code == 200
    assert (await father.post(CLAIM, json=key(school_class))).status_code == 200
    assert await session.scalar(select(func.count()).select_from(ParentStudentLink)) == 2


async def test_soft_deleted_student_never_matches(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
) -> None:
    student = await admin_student(client, student_payload)
    await client.delete(f"/api/students/{student['id']}")
    parent = await make_parent()

    lookup = await parent.post(LOOKUP, json=key(school_class))
    claim = await parent.post(CLAIM, json=key(school_class))

    assert lookup.json() == {"found": False}
    assert claim.status_code == 404 and claim.json()["error"]["code"] == "no_match"


async def test_claim_ignores_a_client_supplied_student_id(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
) -> None:
    student = await admin_student(client, student_payload)
    parent = await make_parent()

    r = await parent.post(
        CLAIM, json=key(school_class, full_name="Người Lạ", student_id=student["id"])
    )

    assert r.status_code == 404 and r.json()["error"]["code"] == "no_match"


@pytest.mark.parametrize("path", [LOOKUP, CLAIM])
async def test_lookup_and_claim_reject_an_admin_session(
    client: AsyncClient, school_class: dict[str, Any], path: str
) -> None:
    admin_only = await client.post(path, json=key(school_class))

    assert admin_only.status_code == 401 and admin_only.json()["error"]["code"] == "unauthorized"


@pytest.mark.parametrize("path", [LOOKUP, CLAIM])
async def test_lookup_and_claim_are_rate_limited(
    make_parent: MakeParent, school_class: dict[str, Any], path: str
) -> None:
    parent = await make_parent()

    statuses = [(await parent.post(path, json=key(school_class))).status_code for _ in range(11)]

    assert 429 not in statuses[:10] and statuses[10] == 429


async def test_one_parent_claiming_repeatedly_at_once_links_and_audits_once(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
    session: AsyncSession,
) -> None:
    await admin_student(client, student_payload)
    parent = await make_parent()

    results = await asyncio.gather(*(parent.post(CLAIM, json=key(school_class)) for _ in range(5)))

    assert [r.status_code for r in results] == [200] * 5
    assert await session.scalar(select(func.count()).select_from(ParentStudentLink)) == 1
    audits = await session.scalar(
        select(func.count())
        .select_from(AuditLog)
        .where(AuditLog.action == "parent_student_link.create")
    )
    assert audits == 1


async def test_two_parents_claiming_at_once_both_link(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
    session: AsyncSession,
) -> None:
    await admin_student(client, student_payload)
    mother, father = await make_parent(), await make_parent()

    results = await asyncio.gather(
        mother.post(CLAIM, json=key(school_class)), father.post(CLAIM, json=key(school_class))
    )

    assert [r.status_code for r in results] == [200, 200]
    assert await session.scalar(select(func.count()).select_from(ParentStudentLink)) == 2
    audits = await session.scalar(
        select(func.count())
        .select_from(AuditLog)
        .where(AuditLog.action == "parent_student_link.create")
    )
    assert audits == 2
