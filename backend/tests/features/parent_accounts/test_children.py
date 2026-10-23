import asyncio
import uuid
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import AuditLog
from app.core.events import bus
from app.core.security import hash_password, parent_match_limiter
from app.features.parent_accounts.models import LinkOrigin, ParentAccount, ParentStudentLink
from app.features.students.models import DataSource, FittingTrial, Student
from tests.conftest import (
    CHILDREN,
    MakeParent,
    ParentClient,
    Payload,
    child_body,
    claim_key,
    count_rows,
)
from tests.features.conftest import OpenCampaign


async def test_create_child_is_declared_and_linked(
    client: AsyncClient,
    make_parent: MakeParent,
    school_class: dict[str, Any],
    session: AsyncSession,
) -> None:
    parent = await make_parent(full_name="Mẹ An", phone="0912345678", email="me.an@example.com")

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
        "parent_name": "Mẹ An",
        "parent_phone": "0912345678",
        "parent_email": "me.an@example.com",
        "order_summary": None,
        "campaign_open": False,
    }
    student = await session.get(Student, uuid.UUID(body["student_id"]))
    assert student is not None and student.data_source is DataSource.PARENT_DECLARED
    assert student.portal_token and (student.height_cm, student.weight_kg) == (128.5, 25.0)
    assert (student.parent_phone, student.parent_email, student.parent_name) == (
        "0912345678",
        "me.an@example.com",
        "Mẹ An",
    )
    assert await count_rows(session, FittingTrial) == 0
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
    assert await count_rows(session, Student) == 0


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
    assert await count_rows(session, Student) == 0


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
    assert await count_rows(session, Student) == 1


async def test_create_child_twice_is_child_exists_even_for_another_parent(
    make_parent: MakeParent, school_class: dict[str, Any], session: AsyncSession
) -> None:
    mother, father = await make_parent(), await make_parent()
    assert (await mother.post(CHILDREN, json=child_body(school_class))).status_code == 201

    again = await mother.post(CHILDREN, json=child_body(school_class))
    other_parent = await father.post(CHILDREN, json=child_body(school_class))

    assert again.status_code == other_parent.status_code == 409
    assert again.json()["error"]["code"] == "child_exists"
    assert await count_rows(session, Student) == 1


async def test_concurrent_creates_make_one_record(
    make_parent: MakeParent, school_class: dict[str, Any], session: AsyncSession
) -> None:
    mother, father = await make_parent(), await make_parent()

    results = await asyncio.gather(
        mother.post(CHILDREN, json=child_body(school_class)),
        father.post(CHILDREN, json=child_body(school_class)),
    )

    assert sorted(r.status_code for r in results) == [201, 409]
    assert await count_rows(session, Student) == 1
    assert await count_rows(session, ParentStudentLink) == 1
    audit_actions = (await session.scalars(select(AuditLog.action))).all()
    assert audit_actions.count("student.create") == 1
    assert audit_actions.count("parent_student_link.create") == 1


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


async def test_list_children_only_returns_own_live_children_with_order_summary(
    client: AsyncClient,
    make_parent: MakeParent,
    school_class: dict[str, Any],
    open_campaign: OpenCampaign,
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
    await open_campaign(school_class["school_id"])
    placed = await mine.put(
        f"{CHILDREN}/{first['student_id']}/order",
        json={
            "item_lines": [{"product_id": str(products["blazer"].id), "size_label": "3", "qty": 1}]
        },
    )
    assert placed.status_code == 200
    await client.delete(f"/api/students/{gone['student_id']}")

    r = await mine.get(CHILDREN)

    assert r.status_code == 200
    assert [c["student_id"] for c in r.json()] == [first["student_id"], second["student_id"]]
    assert r.json()[0]["order_summary"] == {
        "items": 1,
        "amount": 500_000,
        "has_unpriced": False,
        "status": "SUBMITTED",
    }
    assert r.json()[1]["order_summary"] is None
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
    assert schools.json() == [{"id": school_class["school_id"], "name": "Trường A"}]
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
    key = claim_key(school_class)
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


async def test_create_child_copies_account_contact_and_ignores_client_contact(
    make_parent: MakeParent, school_class: dict[str, Any], session: AsyncSession
) -> None:
    parent = await make_parent(
        full_name="Trần Thị Hoa", phone="+84 912 345 678", email="Hoa@Example.COM"
    )

    r = await parent.post(
        CHILDREN,
        json=child_body(
            school_class,
            parent_phone="0900000001",
            parent_name="Someone Else",
            parent_email="other@example.com",
        ),
    )

    assert r.status_code == 201
    contact = ("Trần Thị Hoa", "0912345678", "hoa@example.com")
    body = r.json()
    assert (body["parent_name"], body["parent_phone"], body["parent_email"]) == contact
    student = await session.get(Student, uuid.UUID(body["student_id"]))
    assert student is not None
    assert (student.parent_name, student.parent_phone, student.parent_email) == contact
    log = await session.scalar(select(AuditLog).where(AuditLog.action == "student.create"))
    assert log is not None and log.after is not None
    after = log.after
    assert (after["parent_name"], after["parent_phone"], after["parent_email"]) == contact


async def test_child_of_legacy_account_without_phone_gets_null_phone(
    anon_client: AsyncClient, school_class: dict[str, Any], session: AsyncSession
) -> None:
    session.add(
        ParentAccount(
            full_name="Mẹ Cũ", email="old@example.com", password_hash=hash_password("mat-khau-123")
        )
    )
    await session.commit()
    login = await anon_client.post(
        "/api/parent/auth/login", json={"identifier": "old@example.com", "password": "mat-khau-123"}
    )
    assert login.status_code == 200

    r = await anon_client.post(CHILDREN, json=child_body(school_class))

    assert r.status_code == 201
    assert (r.json()["parent_name"], r.json()["parent_phone"], r.json()["parent_email"]) == (
        "Mẹ Cũ",
        None,
        "old@example.com",
    )


async def test_parent_edit_refreshes_contact_from_account_and_ignores_client_contact(
    make_parent: MakeParent, school_class: dict[str, Any], session: AsyncSession
) -> None:
    parent = await make_parent(full_name="Mẹ An", phone="0912345678", email="me@example.com")
    created = (await parent.post(CHILDREN, json=child_body(school_class))).json()
    student = await session.get(Student, uuid.UUID(created["student_id"]))
    assert student is not None
    student.parent_name, student.parent_phone, student.parent_email = "Stale", "0900000009", None
    await session.commit()

    r = await parent.put(
        f"{CHILDREN}/{created['student_id']}",
        json=edit_body(
            school_class["class_id"],
            parent_phone="+84 987 654 321",
            parent_name="Ba của An",
            parent_email="BA@example.com",
        ),
    )

    assert r.status_code == 200
    assert (r.json()["parent_name"], r.json()["parent_phone"], r.json()["parent_email"]) == (
        "Mẹ An",
        "0912345678",
        "me@example.com",
    )
    log = await session.scalar(select(AuditLog).where(AuditLog.action == "student.update"))
    assert log is not None and log.before is not None and log.after is not None
    assert (log.before["parent_phone"], log.after["parent_phone"]) == ("0900000009", "0912345678")
    assert (log.before["parent_email"], log.after["parent_email"]) == (None, "me@example.com")


async def test_claimant_sees_declared_contact_but_never_admin_entered_contact(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
) -> None:
    owner = await make_parent(full_name="Mẹ An", phone="0912345678", email="me@example.com")
    claimer = await make_parent()
    await owner.post(CHILDREN, json=child_body(school_class))
    await client.post(
        "/api/students",
        json=student_payload(
            full_name="Nguyễn Minh Khang",
            parent_name="Admin Entered",
            parent_phone="0900000001",
            parent_email="admin@example.com",
        ),
    )
    for name, dob in [("Lê Minh Anh", "2017-09-01"), ("Nguyễn Minh Khang", "2018-03-14")]:
        key = claim_key(school_class, full_name=name, dob=dob)
        assert (await claimer.post(f"{CHILDREN}/claim", json=key)).status_code == 200

    listing = await claimer.get(CHILDREN)

    by_name = {c["full_name"]: c for c in listing.json()}
    declared, measured = by_name["Lê Minh Anh"], by_name["Nguyễn Minh Khang"]
    assert (declared["parent_name"], declared["parent_phone"], declared["parent_email"]) == (
        "Mẹ An",
        "0912345678",
        "me@example.com",
    )
    assert (measured["parent_name"], measured["parent_phone"], measured["parent_email"]) == (
        None,
        None,
        None,
    )
    for secret in ("Admin Entered", "0900000001", "admin@example.com"):
        assert secret not in listing.text


async def create_many(parent: ParentClient, school_class: dict[str, Any], count: int) -> None:
    for i in range(count):
        r = await parent.post(
            CHILDREN, json=child_body(school_class, full_name=f"Bé {chr(65 + i)}")
        )
        assert r.status_code == 201, r.text


async def test_parent_cannot_create_more_than_ten_children(
    make_parent: MakeParent, school_class: dict[str, Any], session: AsyncSession
) -> None:
    parent = await make_parent()
    await create_many(parent, school_class, 10)
    parent_match_limiter.reset()

    r = await parent.post(CHILDREN, json=child_body(school_class, full_name="Bé Thứ Mười Một"))

    assert r.status_code == 409 and r.json()["error"]["code"] == "child_limit"
    assert "10" in r.json()["error"]["message"]
    assert await count_rows(session, Student) == 10
    audits = await session.scalar(
        select(func.count()).select_from(AuditLog).where(AuditLog.action == "student.create")
    )
    assert audits == 10


async def test_claims_count_towards_the_limit_once(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
) -> None:
    await client.post("/api/students", json=student_payload(full_name="Nguyễn Văn An"))
    parent = await make_parent()
    key = claim_key(school_class, full_name="Nguyễn Văn An")
    assert (await parent.post(f"{CHILDREN}/claim", json=key)).status_code == 200
    assert (await parent.post(f"{CHILDREN}/claim", json=key)).status_code == 200
    parent_match_limiter.reset()

    await create_many(parent, school_class, 9)
    parent_match_limiter.reset()
    r = await parent.post(CHILDREN, json=child_body(school_class, full_name="Bé Thừa"))

    assert r.status_code == 409 and r.json()["error"]["code"] == "child_limit"


async def test_deleted_children_free_a_slot(
    client: AsyncClient, make_parent: MakeParent, school_class: dict[str, Any]
) -> None:
    parent = await make_parent()
    await create_many(parent, school_class, 10)
    first = (await parent.get(CHILDREN)).json()[0]
    await client.delete(f"/api/students/{first['student_id']}")
    parent_match_limiter.reset()

    r = await parent.post(CHILDREN, json=child_body(school_class, full_name="Bé Mới"))

    assert r.status_code == 201


async def test_existing_child_is_reported_before_the_limit(
    make_parent: MakeParent, school_class: dict[str, Any]
) -> None:
    parent = await make_parent()
    await create_many(parent, school_class, 10)
    parent_match_limiter.reset()

    r = await parent.post(CHILDREN, json=child_body(school_class, full_name="Bé A"))

    assert r.status_code == 409 and r.json()["error"]["code"] == "child_exists"


async def test_concurrent_creates_cannot_slip_past_the_limit(
    make_parent: MakeParent, school_class: dict[str, Any], session: AsyncSession
) -> None:
    parent = await make_parent()
    await create_many(parent, school_class, 9)
    parent_match_limiter.reset()

    results = await asyncio.gather(
        parent.post(CHILDREN, json=child_body(school_class, full_name="Bé Sinh Đôi 1")),
        parent.post(CHILDREN, json=child_body(school_class, full_name="Bé Sinh Đôi 2")),
    )

    assert sorted(r.status_code for r in results) == [201, 409]
    assert await count_rows(session, Student) == 10


async def test_parent_edit_refreshes_measured_at(
    make_parent: MakeParent, school_class: dict[str, Any], session: AsyncSession
) -> None:
    parent = await make_parent()
    created = (await parent.post(CHILDREN, json=child_body(school_class))).json()
    student_id = uuid.UUID(created["student_id"])
    before = (await session.get(Student, student_id)).measured_at  # type: ignore[union-attr]

    r = await parent.put(
        f"{CHILDREN}/{created['student_id']}", json=edit_body(school_class["class_id"])
    )

    assert r.status_code == 200
    session.expire_all()
    after = (await session.get(Student, student_id)).measured_at  # type: ignore[union-attr]
    assert after > before


async def test_a_second_linked_parent_can_edit_a_declared_child_as_themselves(
    make_parent: MakeParent, school_class: dict[str, Any], session: AsyncSession
) -> None:
    creator, claimer = await make_parent(), await make_parent()
    created = (await creator.post(CHILDREN, json=child_body(school_class))).json()
    key = claim_key(school_class, full_name="Lê Minh Anh", dob="2017-09-01")
    assert (await claimer.post(f"{CHILDREN}/claim", json=key)).status_code == 200

    r = await claimer.put(
        f"{CHILDREN}/{created['student_id']}",
        json=edit_body(school_class["class_id"], height_cm=140),
    )

    assert r.status_code == 200
    student = await session.get(Student, uuid.UUID(created["student_id"]))
    assert student is not None and student.height_cm == 140
    log = await session.scalar(select(AuditLog).where(AuditLog.action == "student.update"))
    assert log is not None and log.actor == f"parent:{claimer.parent_id}"
    assert (await creator.get(CHILDREN)).json()[0]["student_id"] == created["student_id"]


async def test_shown_campaign_is_the_open_one_in_both_endpoints(
    make_parent: MakeParent,
    school_class: dict[str, Any],
    open_campaign: OpenCampaign,
    products: dict[str, Any],
    session: AsyncSession,
) -> None:
    mine = await make_parent()
    child = (await mine.post(CHILDREN, json=child_body(school_class))).json()
    old = await open_campaign(school_class["school_id"])
    body = {"item_lines": [{"product_id": str(products["blazer"].id), "size_label": "3", "qty": 1}]}
    assert (await mine.put(f"{CHILDREN}/{child['student_id']}/order", json=body)).status_code == 200
    old.status = "LOCKED"
    await session.commit()

    locked = await mine.get(f"{CHILDREN}/{child['student_id']}/ordering")
    assert locked.json()["campaign"]["id"] == str(old.id)
    assert (await mine.get(CHILDREN)).json()[0]["order_summary"]["status"] == "SUBMITTED"

    current = await open_campaign(school_class["school_id"])
    ordering = (await mine.get(f"{CHILDREN}/{child['student_id']}/ordering")).json()

    assert ordering["campaign"]["id"] == str(current.id) and ordering["order"] is None
    assert (await mine.get(CHILDREN)).json()[0]["order_summary"] is None
