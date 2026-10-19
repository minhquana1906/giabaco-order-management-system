import secrets
import uuid
from collections.abc import Awaitable, Callable
from datetime import date
from typing import Any

from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import AuditLog
from app.core.events import bus
from app.features.students.models import DataSource, Gender, Student
from tests.conftest import ParentClient

MakeParent = Callable[..., Awaitable[ParentClient]]
Payload = Callable[..., dict[str, Any]]
TRIAL = {"product_code": "blazer", "size_label": "2", "fit": "FITS", "note": None}


async def declare(
    parent: ParentClient,
    school_class: dict[str, Any],
    class_id: str | None = None,
    name: str = "Nguyen Van An",
    **overrides: Any,
) -> str:
    r = await parent.post(
        "/api/parent/children",
        json={
            "school_id": school_class["school_id"],
            "class_id": class_id or school_class["class_id"],
            "full_name": name,
            "dob": "2018-03-14",
            "gender": "MALE",
            "height_cm": 120,
            "weight_kg": 20,
            "parent_phone": "0912345678",
            **overrides,
        },
    )
    assert r.status_code == 201, r.text
    return str(r.json()["student_id"])


async def other_class(client: AsyncClient, school_class: dict[str, Any]) -> str:
    r = await client.post(
        f"/api/schools/{school_class['school_id']}/classes", json={"grade": 2, "name": "2A2"}
    )
    return str(r.json()["id"])


async def student_count(session: AsyncSession) -> int:
    return int(await session.scalar(select(func.count()).select_from(Student)) or 0)


async def test_admin_adopts_the_declared_record_and_keeps_links_and_choices(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
    session: AsyncSession,
) -> None:
    mother, father = await make_parent(), await make_parent()
    class_2a2 = await other_class(client, school_class)
    declared_id = await declare(mother, school_class)
    await mother.put(
        f"/api/parent/children/{declared_id}/size-choices/blazer", json={"size_label": "3"}
    )
    before = (await client.get(f"/api/students/{declared_id}")).json()

    async with bus.subscribe() as queue:
        r = await client.post(
            "/api/students",
            json=student_payload(
                full_name="Nguyễn Văn An",
                class_id=class_2a2,
                height_cm=126.5,
                weight_kg=24,
                parent_phone="0912345678",
                trials=[TRIAL],
            ),  # fmt: skip
        )
        assert queue.get_nowait() == {"students"}

    assert r.status_code == 201
    body = r.json()
    assert body["id"] == declared_id and body["portal_token"] == before["portal_token"]
    assert body["data_source"] == "ADMIN_MEASURED"
    assert (body["full_name"], body["class"]["name"]) == ("Nguyễn Văn An", "2A2")
    assert (body["height_cm"], body["weight_kg"], body["parent_phone"]) == (
        126.5,
        24.0,
        "0912345678",
    )
    assert body["measured_at"] > before["measured_at"]
    assert [p["parent_id"] for p in body["linked_parents"]] == [mother.parent_id]
    assert [(c["product_code"], c["size_label"]) for c in body["parent_choices"]] == [
        ("blazer", "3")
    ]
    assert [(t["size_label"], t["suggested_size_label"]) for t in body["trials"]] == [("2", "2")]
    assert await student_count(session) == 1

    parent_view = (await mother.get(f"/api/parent/children/{declared_id}")).json()
    assert parent_view["data_source"] == "ADMIN_MEASURED" and parent_view["height_cm"] == 126.5
    assert [t["size_label"] for t in parent_view["trials"]] == ["2"]
    assert parent_view["choices"] == {"blazer": "3"}
    claim = await father.post(
        "/api/parent/children/claim",
        json={
            "school_id": school_class["school_id"],
            "full_name": "Nguyễn Văn An",
            "dob": "2018-03-14",
        },
    )
    assert claim.status_code == 200 and claim.json()["student_id"] == declared_id
    edit = await mother.put(
        f"/api/parent/children/{declared_id}",
        json={
            "class_id": class_2a2,
            "gender": "MALE",
            "height_cm": 100,
            "weight_kg": 15,
            "parent_phone": "0912345678",
        },
    )
    assert edit.status_code == 409 and edit.json()["error"]["code"] == "measured_locked"


async def test_adoption_is_audited_with_before_and_after(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
    session: AsyncSession,
) -> None:
    declared_id = await declare(await make_parent(), school_class)

    await client.post(
        "/api/students",
        json=student_payload(full_name="Nguyễn Văn An", height_cm=126.5, trials=[TRIAL]),
    )

    actions = (
        await session.scalars(
            select(AuditLog.action).where(
                AuditLog.action.like("student.%") | AuditLog.action.like("trial.%")
            )
        )
    ).all()
    assert sorted(actions) == ["student.adopt", "student.create", "trial.create"]
    log = await session.scalar(select(AuditLog).where(AuditLog.action == "student.adopt"))
    assert log is not None and log.actor == "admin" and str(log.entity_id) == declared_id
    assert log.before is not None and log.after is not None
    assert (log.before["data_source"], log.after["data_source"]) == (
        "PARENT_DECLARED",
        "ADMIN_MEASURED",
    )
    assert (log.before["height_cm"], log.after["height_cm"]) == (120.0, 126.5)
    assert (log.before["full_name"], log.after["full_name"]) == ("Nguyen Van An", "Nguyễn Văn An")


async def test_adoption_ignores_the_class_when_matching(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
    session: AsyncSession,
) -> None:
    declared_id = await declare(await make_parent(), school_class)

    r = await client.post("/api/students", json=student_payload(full_name="nguyễn  văn an"))

    assert r.status_code == 201 and r.json()["id"] == declared_id
    assert await student_count(session) == 1


async def test_force_creates_a_separate_record(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
    session: AsyncSession,
) -> None:
    declared_id = await declare(await make_parent(), school_class)

    r = await client.post(
        "/api/students", json=student_payload(full_name="Nguyễn Văn An", force=True)
    )

    assert r.status_code == 201 and r.json()["id"] != declared_id
    assert r.json()["linked_parents"] == []
    declared = await session.get(Student, uuid.UUID(declared_id))
    assert declared is not None and declared.data_source is DataSource.PARENT_DECLARED
    assert await student_count(session) == 2


async def test_admin_duplicate_still_conflicts_and_uses_normalized_names(
    client: AsyncClient, student_payload: Payload
) -> None:
    first = await client.post("/api/students", json=student_payload(full_name="Nguyễn Văn An"))
    assert first.status_code == 201

    same = await client.post("/api/students", json=student_payload(full_name="Nguyễn Văn An"))
    folded = await client.post("/api/students", json=student_payload(full_name="  nguyen van AN "))

    for r in (same, folded):
        assert r.status_code == 409 and r.json()["error"]["code"] == "duplicate_student"
    forced = await client.post(
        "/api/students", json=student_payload(full_name="Nguyễn Văn An", force=True)
    )
    assert forced.status_code == 201


async def test_declared_record_never_triggers_duplicate_conflict(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
) -> None:
    declared_id = await declare(await make_parent(), school_class, name="Nguyễn Văn An")

    r = await client.post("/api/students", json=student_payload(full_name="Nguyễn Văn An"))

    assert r.status_code == 201 and r.json()["id"] == declared_id


async def test_nothing_is_adopted_across_schools_dobs_or_after_soft_delete(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
    session: AsyncSession,
) -> None:
    declared_id = await declare(await make_parent(), school_class)
    other = (await client.post("/api/schools", json={"name": "Trường B", "code": "B"})).json()
    other_cls = (
        await client.post(f"/api/schools/{other['id']}/classes", json={"grade": 2, "name": "2B1"})
    ).json()

    elsewhere = await client.post(
        "/api/students",
        json=student_payload(
            full_name="Nguyễn Văn An", school_id=other["id"], class_id=other_cls["id"]
        ),
    )
    other_dob = await client.post(
        "/api/students", json=student_payload(full_name="Nguyễn Văn An", dob="2018-03-15")
    )
    await client.delete(f"/api/students/{declared_id}")
    after_delete = await client.post(
        "/api/students", json=student_payload(full_name="Nguyễn Văn An")
    )

    ids = {r.json()["id"] for r in (elsewhere, other_dob, after_delete)}
    assert all(r.status_code == 201 for r in (elsewhere, other_dob, after_delete))
    assert declared_id not in ids and len(ids) == 3
    declared = await session.get(Student, uuid.UUID(declared_id))
    assert declared is not None and declared.data_source is DataSource.PARENT_DECLARED


async def test_two_declared_matches_are_not_merged(
    client: AsyncClient,
    student_payload: Payload,
    school_class: dict[str, Any],
    session: AsyncSession,
) -> None:
    for _ in range(2):
        session.add(
            Student(
                school_id=uuid.UUID(school_class["school_id"]),
                class_id=uuid.UUID(school_class["class_id"]),
                full_name="Nguyen Van An",
                dob=date(2018, 3, 14),
                gender=Gender.MALE,
                height_cm=120,
                weight_kg=20,
                portal_token=secrets.token_urlsafe(16),
                data_source=DataSource.PARENT_DECLARED,
            )
        )
    await session.commit()

    r = await client.post("/api/students", json=student_payload(full_name="Nguyễn Văn An"))

    assert r.status_code == 201
    assert await student_count(session) == 3
    assert r.json()["data_source"] == "ADMIN_MEASURED" and r.json()["linked_parents"] == []


async def test_invalid_trials_leave_the_declared_record_untouched(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
    session: AsyncSession,
) -> None:
    declared_id = await declare(await make_parent(), school_class)

    r = await client.post(
        "/api/students",
        json=student_payload(full_name="Nguyễn Văn An", trials=[{**TRIAL, "size_label": "99"}]),
    )

    assert r.status_code == 422
    declared = await session.get(Student, uuid.UUID(declared_id))
    assert declared is not None and declared.data_source is DataSource.PARENT_DECLARED
    assert declared.height_cm == 120


async def test_adoption_keeps_parent_contact_when_admin_supplies_none(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
) -> None:
    mother = await make_parent()
    declared_id = await declare(
        mother, school_class, parent_name="Mẹ An", parent_email="me@example.com"
    )

    r = await client.post(
        "/api/students",
        json=student_payload(
            full_name="Nguyễn Văn An",
            parent_name=None,
            parent_phone=None,
            parent_email=None,
        ),
    )

    assert r.status_code == 201 and r.json()["id"] == declared_id
    assert (r.json()["parent_name"], r.json()["parent_phone"], r.json()["parent_email"]) == (
        "Mẹ An",
        "0912345678",
        "me@example.com",
    )
    own_view = (await mother.get("/api/parent/children")).json()[0]
    assert (own_view["parent_name"], own_view["parent_phone"], own_view["parent_email"]) == (
        None,
        None,
        None,
    )


async def test_adoption_overwrites_only_the_contact_fields_admin_supplies(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
) -> None:
    declared_id = await declare(
        await make_parent(), school_class, parent_name="Mẹ An", parent_email="me@example.com"
    )

    r = await client.post(
        "/api/students",
        json=student_payload(
            full_name="Nguyễn Văn An",
            parent_name=None,
            parent_phone="0987654321",
            parent_email=None,
        ),
    )

    assert r.status_code == 201 and r.json()["id"] == declared_id
    assert (r.json()["parent_name"], r.json()["parent_phone"], r.json()["parent_email"]) == (
        "Mẹ An",
        "0987654321",
        "me@example.com",
    )
