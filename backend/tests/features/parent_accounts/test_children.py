import asyncio
import uuid
from collections.abc import Awaitable, Callable
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import AuditLog
from app.core.events import bus
from app.features.parent_accounts.models import LinkOrigin, ParentStudentLink
from app.features.parent_portal.models import ParentSizeChoice
from app.features.students.models import DataSource, FittingTrial, Student
from tests.conftest import ParentClient

MakeParent = Callable[..., Awaitable[ParentClient]]
Payload = Callable[..., dict[str, Any]]
CHILDREN = "/api/parent/children"


def child_body(school_class: dict[str, Any], **overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "school_id": school_class["school_id"],
        "class_id": school_class["class_id"],
        "full_name": "Lê Minh Anh",
        "dob": "2017-09-01",
        "gender": "FEMALE",
        "height_cm": 128.5,
        "weight_kg": 25.0,
    }
    body.update(overrides)
    return body


async def student_count(session: AsyncSession) -> int:
    return int(await session.scalar(select(func.count()).select_from(Student)) or 0)


async def test_create_child_is_declared_and_linked(
    client: AsyncClient,
    make_parent: MakeParent,
    school_class: dict[str, Any],
    session: AsyncSession,
) -> None:
    parent = await make_parent()

    r = await parent.post(CHILDREN, json=child_body(school_class))

    assert r.status_code == 201
    body = r.json()
    assert body == {
        "student_id": body["student_id"],
        "full_name": "Lê Minh Anh",
        "school_id": school_class["school_id"],
        "school_name": "Trường A",
        "class_id": school_class["class_id"],
        "class_name": "2A1",
        "gender": "FEMALE",
        "data_source": "PARENT_DECLARED",
        "choices": {},
    }
    student = await session.get(Student, uuid.UUID(body["student_id"]))
    assert student is not None and student.data_source is DataSource.PARENT_DECLARED
    assert student.portal_token and (student.height_cm, student.weight_kg) == (128.5, 25.0)
    assert (student.parent_phone, student.parent_email, student.parent_name) == (None, None, None)
    assert await session.scalar(select(func.count()).select_from(FittingTrial)) == 0
    link = await session.scalar(select(ParentStudentLink))
    assert link is not None and link.origin is LinkOrigin.CREATED
    assert str(link.parent_id) == parent.parent_id


@pytest.mark.parametrize(
    ("field", "value"),
    [("height_cm", 89.9), ("height_cm", 190.1), ("weight_kg", 9.9), ("weight_kg", 90.1)],
)
async def test_create_child_rejects_out_of_range_measures(
    make_parent: MakeParent,
    school_class: dict[str, Any],
    session: AsyncSession,
    field: str,
    value: float,
) -> None:
    parent = await make_parent()

    r = await parent.post(CHILDREN, json=child_body(school_class, **{field: value}))

    assert r.status_code == 422 and field in r.json()["error"]["fields"]
    assert await student_count(session) == 0


async def test_create_child_accepts_range_edges(
    make_parent: MakeParent, school_class: dict[str, Any]
) -> None:
    parent = await make_parent()

    r = await parent.post(CHILDREN, json=child_body(school_class, height_cm=90, weight_kg=90))

    assert r.status_code == 201


@pytest.mark.parametrize("dob", ["2999-01-01", "not-a-date"])
async def test_create_child_rejects_bad_dob(
    make_parent: MakeParent, school_class: dict[str, Any], dob: str
) -> None:
    parent = await make_parent()

    r = await parent.post(CHILDREN, json=child_body(school_class, dob=dob))

    assert r.status_code == 422 and "dob" in r.json()["error"]["fields"]


async def test_create_child_rejects_class_of_another_school(
    client: AsyncClient,
    make_parent: MakeParent,
    school_class: dict[str, Any],
    session: AsyncSession,
) -> None:
    other = (await client.post("/api/schools", json={"name": "Trường B", "code": "B"})).json()
    other_class = (
        await client.post(f"/api/schools/{other['id']}/classes", json={"grade": 2, "name": "2B1"})
    ).json()
    parent = await make_parent()

    r = await parent.post(CHILDREN, json=child_body(school_class, class_id=other_class["id"]))

    assert r.status_code == 422 and "class_id" in r.json()["error"]["fields"]
    assert await student_count(session) == 0


@pytest.mark.parametrize("typed", ["Nguyễn Văn An", "nguyen  van an "])
async def test_create_child_conflicts_with_an_existing_record(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
    session: AsyncSession,
    typed: str,
) -> None:
    await client.post(
        "/api/students", json=student_payload(full_name="Nguyễn Văn An", dob="2018-03-14")
    )
    parent = await make_parent()

    r = await parent.post(
        CHILDREN, json=child_body(school_class, full_name=typed, dob="2018-03-14")
    )

    assert r.status_code == 409 and r.json()["error"]["code"] == "child_exists"
    assert await student_count(session) == 1


async def test_create_child_twice_is_child_exists_even_for_another_parent(
    make_parent: MakeParent, school_class: dict[str, Any], session: AsyncSession
) -> None:
    mother, father = await make_parent(), await make_parent()
    assert (await mother.post(CHILDREN, json=child_body(school_class))).status_code == 201

    again = await mother.post(CHILDREN, json=child_body(school_class))
    other_parent = await father.post(CHILDREN, json=child_body(school_class))

    assert again.status_code == other_parent.status_code == 409
    assert again.json()["error"]["code"] == "child_exists"
    assert await student_count(session) == 1


async def test_concurrent_creates_make_one_record(
    make_parent: MakeParent, school_class: dict[str, Any], session: AsyncSession
) -> None:
    mother, father = await make_parent(), await make_parent()

    results = await asyncio.gather(
        mother.post(CHILDREN, json=child_body(school_class)),
        father.post(CHILDREN, json=child_body(school_class)),
    )

    assert sorted(r.status_code for r in results) == [201, 409]
    assert await student_count(session) == 1


async def test_soft_deleted_record_does_not_block_creation(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
) -> None:
    old = (
        await client.post(
            "/api/students", json=student_payload(full_name="Lê Minh Anh", dob="2017-09-01")
        )
    ).json()
    await client.delete(f"/api/students/{old['id']}")
    parent = await make_parent()

    r = await parent.post(CHILDREN, json=child_body(school_class))

    assert r.status_code == 201 and r.json()["student_id"] != old["id"]


async def test_create_child_audits_and_publishes_after_commit(
    make_parent: MakeParent, school_class: dict[str, Any], session: AsyncSession
) -> None:
    parent = await make_parent()

    async with bus.subscribe() as queue:
        bad = await parent.post(CHILDREN, json=child_body(school_class, height_cm=1))
        assert bad.status_code == 422 and queue.empty()
        created = await parent.post(CHILDREN, json=child_body(school_class))
        assert queue.get_nowait() == {"students"}
        conflict = await parent.post(CHILDREN, json=child_body(school_class))
        assert conflict.status_code == 409 and queue.empty()

    logs = (await session.scalars(select(AuditLog).order_by(AuditLog.at, AuditLog.action))).all()
    by_action = {log.action: log for log in logs if log.action != "parent_account.register"}
    assert set(by_action) == {"student.create", "parent_student_link.create"}
    assert all(log.actor == f"parent:{parent.parent_id}" for log in by_action.values())
    created_log = by_action["student.create"]
    assert str(created_log.entity_id) == created.json()["student_id"]
    assert created_log.before is None and created_log.after is not None
    assert created_log.after["data_source"] == "PARENT_DECLARED"
    assert created_log.after["height_cm"] == 128.5


async def test_list_children_only_returns_own_live_children_with_choices(
    client: AsyncClient,
    make_parent: MakeParent,
    school_class: dict[str, Any],
    session: AsyncSession,
    products: dict[str, Any],
) -> None:
    mine, theirs = await make_parent(), await make_parent()
    first = (await mine.post(CHILDREN, json=child_body(school_class))).json()
    second = (
        await mine.post(CHILDREN, json=child_body(school_class, full_name="Lê Minh Bảo"))
    ).json()
    gone = (
        await mine.post(CHILDREN, json=child_body(school_class, full_name="Lê Minh Cúc"))
    ).json()
    await theirs.post(CHILDREN, json=child_body(school_class, full_name="Phạm Gia Hân"))
    session.add(
        ParentSizeChoice(
            student_id=uuid.UUID(first["student_id"]),
            product_id=products["blazer"].id,
            size_label="3",
        )
    )
    await session.commit()
    await client.delete(f"/api/students/{gone['student_id']}")

    r = await mine.get(CHILDREN)

    assert r.status_code == 200
    assert [c["student_id"] for c in r.json()] == [first["student_id"], second["student_id"]]
    assert r.json()[0]["choices"] == {"blazer": "3"} and r.json()[1]["choices"] == {}
    assert (await theirs.get(CHILDREN)).json()[0]["full_name"] == "Phạm Gia Hân"
    assert len((await theirs.get(CHILDREN)).json()) == 1


async def test_create_child_is_rate_limited(
    make_parent: MakeParent, school_class: dict[str, Any]
) -> None:
    parent = await make_parent()

    statuses = [
        (
            await parent.post(CHILDREN, json=child_body(school_class, full_name=f"Bé {c}"))
        ).status_code
        for c in "ABCDEFGHIJK"
    ]

    assert 429 not in statuses[:10] and statuses[10] == 429


async def test_catalog_lists_for_parents(
    client: AsyncClient, make_parent: MakeParent, school_class: dict[str, Any]
) -> None:
    parent = await make_parent()

    schools = await parent.get("/api/parent/schools")
    classes = await parent.get(f"/api/parent/schools/{school_class['school_id']}/classes")
    missing = await parent.get("/api/parent/schools/00000000-0000-0000-0000-000000000000/classes")

    assert schools.status_code == 200
    assert schools.json() == [
        {"id": school_class["school_id"], "name": "Trường A", "code": schools.json()[0]["code"]}
    ]
    assert classes.json() == [
        {
            "id": school_class["class_id"],
            "school_id": school_class["school_id"],
            "grade": 2,
            "name": "2A1",
        }
    ]
    assert missing.status_code == 404 and missing.json()["error"]["code"] == "not_found"


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", "/api/parent/children"),
        ("POST", "/api/parent/children"),
        ("GET", "/api/parent/schools"),
        ("GET", "/api/parent/schools/00000000-0000-0000-0000-000000000000/classes"),
    ],
)
async def test_parent_routes_reject_admin_sessions(
    client: AsyncClient, school_class: dict[str, Any], method: str, path: str
) -> None:
    r = await client.request(
        method, path, json=child_body(school_class) if method == "POST" else None
    )

    assert r.status_code == 401 and r.json()["error"]["code"] == "unauthorized"


async def second_class(client: AsyncClient, school_class: dict[str, Any]) -> dict[str, Any]:
    r = await client.post(
        f"/api/schools/{school_class['school_id']}/classes", json={"grade": 3, "name": "3A1"}
    )
    return r.json()  # type: ignore[no-any-return]


def edit_body(class_id: str, **overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "class_id": class_id,
        "gender": "MALE",
        "height_cm": 131.0,
        "weight_kg": 27.5,
    }
    body.update(overrides)
    return body


async def test_parent_edits_own_declared_child(
    client: AsyncClient,
    make_parent: MakeParent,
    school_class: dict[str, Any],
    session: AsyncSession,
) -> None:
    other_class = await second_class(client, school_class)
    parent = await make_parent()
    created = (await parent.post(CHILDREN, json=child_body(school_class))).json()

    async with bus.subscribe() as queue:
        r = await parent.put(
            f"{CHILDREN}/{created['student_id']}", json=edit_body(other_class["id"])
        )
        assert queue.get_nowait() == {"students"}

    assert r.status_code == 200
    assert r.json() == {
        **created,
        "class_id": other_class["id"],
        "class_name": "3A1",
        "gender": "MALE",
    }
    session.expire_all()
    student = await session.get(Student, uuid.UUID(created["student_id"]))
    assert student is not None and (student.height_cm, student.weight_kg) == (131.0, 27.5)
    assert student.full_name == "Lê Minh Anh" and str(student.dob) == "2017-09-01"
    log = await session.scalar(select(AuditLog).where(AuditLog.action == "student.update"))
    assert log is not None and log.actor == f"parent:{parent.parent_id}"
    assert log.before is not None and log.after is not None
    assert (log.before["height_cm"], log.after["height_cm"]) == (128.5, 131.0)
    assert (log.before["class_id"], log.after["class_id"]) == (
        school_class["class_id"],
        other_class["id"],
    )
    assert (log.before["gender"], log.after["gender"]) == ("FEMALE", "MALE")


async def test_parent_cannot_edit_admin_measured_child(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
    session: AsyncSession,
) -> None:
    admin_made = (await client.post("/api/students", json=student_payload())).json()
    parent = await make_parent()
    key = {
        "school_id": school_class["school_id"],
        "full_name": "Nguyễn Minh Khang",
        "dob": "2018-03-14",
    }
    assert (await parent.post(f"{CHILDREN}/claim", json=key)).status_code == 200

    r = await parent.put(f"{CHILDREN}/{admin_made['id']}", json=edit_body(school_class["class_id"]))

    assert r.status_code == 409 and r.json()["error"]["code"] == "measured_locked"
    student = await session.get(Student, uuid.UUID(admin_made["id"]))
    assert student is not None and student.height_cm == 126.5
    assert (
        await session.scalar(
            select(func.count()).select_from(AuditLog).where(AuditLog.action == "student.update")
        )
        == 0
    )


async def test_parent_cannot_edit_a_child_they_have_not_linked(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
    session: AsyncSession,
) -> None:
    owner, stranger = await make_parent(), await make_parent()
    declared = (await owner.post(CHILDREN, json=child_body(school_class))).json()
    admin_made = (await client.post("/api/students", json=student_payload())).json()
    body = edit_body(school_class["class_id"], height_cm=150)

    on_declared = await stranger.put(f"{CHILDREN}/{declared['student_id']}", json=body)
    on_measured = await stranger.put(f"{CHILDREN}/{admin_made['id']}", json=body)
    on_random = await stranger.put(f"{CHILDREN}/{uuid.uuid4()}", json=body)

    for r in (on_declared, on_measured, on_random):
        assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"
    student = await session.get(Student, uuid.UUID(declared["student_id"]))
    assert student is not None and student.height_cm == 128.5


async def test_parent_cannot_edit_a_soft_deleted_child(
    client: AsyncClient, make_parent: MakeParent, school_class: dict[str, Any]
) -> None:
    parent = await make_parent()
    created = (await parent.post(CHILDREN, json=child_body(school_class))).json()
    await client.delete(f"/api/students/{created['student_id']}")

    r = await parent.put(
        f"{CHILDREN}/{created['student_id']}", json=edit_body(school_class["class_id"])
    )

    assert r.status_code == 404


@pytest.mark.parametrize(
    "overrides", [{"height_cm": 89}, {"weight_kg": 91}, {"gender": "OTHER"}, {"class_id": "x"}]
)
async def test_edit_rejects_invalid_input(
    make_parent: MakeParent,
    school_class: dict[str, Any],
    overrides: dict[str, Any],
) -> None:
    parent = await make_parent()
    created = (await parent.post(CHILDREN, json=child_body(school_class))).json()

    body = {**edit_body(school_class["class_id"]), **overrides}
    r = await parent.put(f"{CHILDREN}/{created['student_id']}", json=body)

    assert r.status_code == 422 and next(iter(overrides)) in r.json()["error"]["fields"]


async def test_edit_rejects_class_of_another_school(
    client: AsyncClient, make_parent: MakeParent, school_class: dict[str, Any]
) -> None:
    other = (await client.post("/api/schools", json={"name": "Trường B", "code": "B"})).json()
    foreign = (
        await client.post(f"/api/schools/{other['id']}/classes", json={"grade": 2, "name": "2B1"})
    ).json()
    parent = await make_parent()
    created = (await parent.post(CHILDREN, json=child_body(school_class))).json()

    r = await parent.put(f"{CHILDREN}/{created['student_id']}", json=edit_body(foreign["id"]))

    assert r.status_code == 422 and "class_id" in r.json()["error"]["fields"]


async def test_edit_rejects_admin_sessions(
    client: AsyncClient, school_class: dict[str, Any]
) -> None:
    r = await client.put(f"{CHILDREN}/{uuid.uuid4()}", json=edit_body(school_class["class_id"]))

    assert r.status_code == 401
