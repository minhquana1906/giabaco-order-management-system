from typing import Any

import psycopg.errors
import pytest
from httpx import AsyncClient
from sqlalchemy import func, select, text, update
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import AuditLog
from app.core.events import bus
from app.features.students.models import FittingTrial, Student
from tests.conftest import MakeParent, Payload, claim_key, declare_child


def trial(code: str, size: str, fit: str = "FITS", **kw: Any) -> dict[str, Any]:
    return {"product_code": code, "size_label": size, "fit": fit, "note": None, **kw}


async def test_create_returns_detail_with_derived_and_suggested(
    client: AsyncClient, student_payload: Payload
) -> None:
    payload = student_payload(
        height_cm=140,
        weight_kg=32,
        parent_phone="+84912345678",
        trials=[trial("blazer", "3"), trial("blazer", "4"), trial("gile", "5", "TOO_LOOSE")],
    )
    r = await client.post("/api/students", json=payload)
    assert r.status_code == 201
    body = r.json()
    assert body["parent_phone"] == "0912345678"
    assert body["derived_sizes"] == {"blazer": "4", "gile": None}
    assert {t["suggested_size_label"] for t in body["trials"]} == {"4"}
    assert body["portal_url"] == f"http://testserver/p/{body['portal_token']}"
    assert body["class"]["name"] == "2A1" and body["school"]["name"] == "Trường A"
    assert len(body["portal_token"]) >= 22


async def test_client_cannot_set_suggested_size(
    client: AsyncClient, student_payload: Payload
) -> None:
    payload = student_payload(trials=[trial("blazer", "1", suggested_size_label="7")])
    body = (await client.post("/api/students", json=payload)).json()
    assert body["trials"][0]["suggested_size_label"] == "2"


async def test_duplicate_student_409_unless_force(
    client: AsyncClient, student_payload: Payload
) -> None:
    assert (await client.post("/api/students", json=student_payload())).status_code == 201
    dup = await client.post("/api/students", json=student_payload(full_name="  nguyễn minh khang "))
    assert dup.status_code == 409 and dup.json()["error"]["code"] == "duplicate_student"
    assert "2A1" in dup.json()["error"]["message"]
    assert (await client.post("/api/students", json=student_payload(force=True))).status_code == 201


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("height_cm", 89.9),
        ("height_cm", 190.1),
        ("weight_kg", 9.9),
        ("weight_kg", 90.1),
        ("dob", "2999-01-01"),
        ("parent_phone", "123"),
        ("parent_email", "nope"),
        ("gender", "X"),
        ("full_name", "   "),
    ],
)
async def test_validation_errors(
    client: AsyncClient, student_payload: Payload, field: str, value: Any
) -> None:
    r = await client.post("/api/students", json=student_payload(**{field: value}))
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"
    assert field in r.json()["error"]["fields"]


async def test_db_check_constraints_back_up_api(
    session: AsyncSession, school_class: dict[str, Any]
) -> None:
    with pytest.raises(DBAPIError):
        await session.execute(
            text(
                "INSERT INTO students (school_id, class_id, full_name, dob, gender, height_cm, "
                "weight_kg, portal_token) VALUES (:s, :c, 'a', '2018-01-01', 'MALE', 50, 20, 't')"
            ),
            {"s": school_class["school_id"], "c": school_class["class_id"]},
        )


async def test_class_must_belong_to_school(client: AsyncClient, student_payload: Payload) -> None:
    other = (await client.post("/api/schools", json={"name": "Khác", "code": "KH"})).json()
    r = await client.post("/api/students", json=student_payload(school_id=other["id"]))
    assert r.status_code == 422 and "class_id" in r.json()["error"]["fields"]


async def test_invalid_trial_rolls_back_whole_request(
    client: AsyncClient, student_payload: Payload, session: AsyncSession
) -> None:
    payload = student_payload(trials=[trial("blazer", "2"), trial("gile", "99")])
    r = await client.post("/api/students", json=payload)
    assert r.status_code == 422
    assert "trials.1.size_label" in r.json()["error"]["fields"]
    assert await session.scalar(select(func.count()).select_from(Student)) == 0
    assert await session.scalar(select(func.count()).select_from(FittingTrial)) == 0
    assert await session.scalar(select(func.count()).select_from(AuditLog)) == 0


async def test_unknown_product_422(client: AsyncClient, student_payload: Payload) -> None:
    r = await client.post("/api/students", json=student_payload(trials=[trial("hat", "1")]))
    assert "trials.0.product_code" in r.json()["error"]["fields"]


async def test_duplicate_trial_in_payload_409(
    client: AsyncClient, student_payload: Payload
) -> None:
    r = await client.post(
        "/api/students",
        json=student_payload(trials=[trial("blazer", "2"), trial("blazer", "2", "TOO_TIGHT")]),
    )
    assert r.status_code == 409 and r.json()["error"]["code"] == "duplicate_trial"


async def test_update_upserts_and_soft_deletes_trials(
    client: AsyncClient, student_payload: Payload, session: AsyncSession
) -> None:
    created = (
        await client.post(
            "/api/students",
            json=student_payload(
                trials=[trial("blazer", "2"), trial("blazer", "3"), trial("gile", "2")]
            ),
        )
    ).json()
    by_size = {(t["product_code"], t["size_label"]): t for t in created["trials"]}
    keep = by_size[("blazer", "2")]
    payload = student_payload(
        height_cm=150,
        weight_kg=36,
        trials=[
            trial("blazer", "2", "TOO_TIGHT", id=keep["id"], note="chật vai"),
            trial("blazer", "3", "FITS"),
        ],
    )
    r = await client.put(f"/api/students/{created['id']}", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert body["height_cm"] == 150
    assert sorted((t["size_label"], t["fit"]) for t in body["trials"]) == [
        ("2", "TOO_TIGHT"),
        ("3", "FITS"),
    ]
    assert {t["suggested_size_label"] for t in body["trials"]} == {"5"}
    assert body["derived_sizes"] == {"blazer": "3", "gile": None}
    assert next(t for t in body["trials"] if t["id"] == keep["id"])["note"] == "chật vai"

    rows = (
        await session.scalars(select(FittingTrial).where(FittingTrial.student_id == created["id"]))
    ).all()
    assert len(rows) == 4
    assert sum(1 for t in rows if t.deleted_at is not None) == 2

    actions = (await session.scalars(select(AuditLog.action))).all()
    assert "student.update" in actions and "trial.delete" in actions and "trial.update" in actions


async def test_update_unknown_trial_id_422(client: AsyncClient, student_payload: Payload) -> None:
    created = (await client.post("/api/students", json=student_payload())).json()
    r = await client.put(
        f"/api/students/{created['id']}",
        json=student_payload(
            trials=[trial("blazer", "2", id="00000000-0000-0000-0000-000000000001")]
        ),
    )
    assert r.status_code == 422 and "trials.0.id" in r.json()["error"]["fields"]


async def test_soft_delete_hides_student_and_keeps_row(
    client: AsyncClient, student_payload: Payload, session: AsyncSession
) -> None:
    created = (
        await client.post("/api/students", json=student_payload(trials=[trial("blazer", "2")]))
    ).json()
    assert (await client.delete(f"/api/students/{created['id']}")).status_code == 204
    assert (await client.get(f"/api/students/{created['id']}")).status_code == 404
    assert (await client.delete(f"/api/students/{created['id']}")).status_code == 404
    assert (await client.get("/api/students")).json()["total"] == 0
    assert await session.scalar(select(func.count()).select_from(Student)) == 1
    actions = sorted((await session.scalars(select(AuditLog.action))).all())
    assert actions == ["student.create", "student.delete", "trial.create"]
    delete = await session.scalar(select(AuditLog).where(AuditLog.action == "student.delete"))
    assert delete is not None and delete.before is not None and delete.after["deleted_at"]


async def test_list_filters_search_and_paging(
    client: AsyncClient, student_payload: Payload
) -> None:
    await client.post(
        "/api/students",
        json=student_payload(
            full_name="Đặng Thị Hương",
            gender="FEMALE",
            parent_phone="0988111222",
            trials=[trial("blazer", "3")],
        ),
    )
    await client.post(
        "/api/students",
        json=student_payload(
            full_name="Lê Văn An",
            dob="2018-05-05",
            trials=[trial("blazer", "2"), trial("gile", "1", "TOO_TIGHT")],
        ),
    )
    await client.post(
        "/api/students", json=student_payload(full_name="Trần Bình", dob="2017-01-01")
    )

    async def ids(**params: Any) -> list[str]:
        r = await client.get("/api/students", params=params)
        assert r.status_code == 200, r.text
        return [i["full_name"] for i in r.json()["items"]]

    assert await ids() == ["Trần Bình", "Lê Văn An", "Đặng Thị Hương"]
    assert await ids(q="dang thi huong") == ["Đặng Thị Hương"]
    assert await ids(q="HƯƠNG") == ["Đặng Thị Hương"]
    assert await ids(q="huong") == ["Đặng Thị Hương"]
    assert await ids(q="+84 988 111 222") == ["Đặng Thị Hương"]
    assert await ids(q="0988") == ["Đặng Thị Hương"]
    assert await ids(gender="FEMALE") == ["Đặng Thị Hương"]
    assert await ids(grade=2, product="blazer", size="3") == ["Đặng Thị Hương"]
    assert await ids(product="blazer", size="none") == ["Trần Bình"]
    assert await ids(product="gile", size="none") == ["Trần Bình", "Lê Văn An", "Đặng Thị Hương"]
    assert await ids(grade=5) == []
    page = (await client.get("/api/students", params={"page": 2, "page_size": 2})).json()
    assert page["total"] == 3 and len(page["items"]) == 1 and page["page_size"] == 2
    item = (await client.get("/api/students", params={"q": "le van"})).json()["items"][0]
    assert item["trial_count"] == 2 and item["derived_sizes"] == {"blazer": "2", "gile": None}
    assert item["class"]["grade"] == 2 and set(item["school"]) == {"id", "name"}
    assert (await client.get("/api/students", params={"size": "1"})).status_code == 422
    assert (await client.get("/api/students", params={"page_size": 201})).status_code == 422


async def test_list_has_note(client: AsyncClient, student_payload: Payload) -> None:
    await client.post(
        "/api/students", json=student_payload(trials=[trial("blazer", "2", note="rộng vai")])
    )
    assert (await client.get("/api/students")).json()["items"][0]["has_note"] is True


async def test_audit_trigger_blocks_update_and_delete(
    client: AsyncClient, student_payload: Payload, session: AsyncSession
) -> None:
    await client.post("/api/students", json=student_payload())
    with pytest.raises(DBAPIError) as upd:
        await session.execute(text("UPDATE audit_logs SET actor = 'x'"))
    assert isinstance(upd.value.orig, psycopg.errors.RaiseException)
    await session.rollback()
    with pytest.raises(DBAPIError):
        await session.execute(text("DELETE FROM audit_logs"))
    await session.rollback()
    audit = await session.scalar(select(AuditLog).where(AuditLog.action == "student.create"))
    assert (
        audit is not None
        and audit.actor == "admin"
        and audit.after["full_name"] == "Nguyễn Minh Khang"
    )


async def test_events_published_after_commit_only(
    client: AsyncClient, student_payload: Payload
) -> None:
    async with bus.subscribe() as queue:
        bad = await client.post(
            "/api/students", json=student_payload(trials=[trial("blazer", "99")])
        )
        assert bad.status_code == 422 and queue.empty()
        await client.post("/api/students", json=student_payload())
        assert queue.get_nowait() == {"students"}


async def test_trial_unique_index_is_partial(
    session: AsyncSession, client: AsyncClient, student_payload: Payload, products: dict[str, Any]
) -> None:
    created = (await client.post("/api/students", json=student_payload())).json()
    blazer_id = products["blazer"].id

    def new_trial() -> FittingTrial:
        return FittingTrial(
            student_id=created["id"], product_id=blazer_id, size_label="2", fit="FITS"
        )

    first = new_trial()
    session.add(first)
    await session.commit()
    first_id = first.id
    session.add(new_trial())
    with pytest.raises(IntegrityError):
        await session.commit()
    await session.rollback()
    await session.execute(
        update(FittingTrial).where(FittingTrial.id == first_id).values(deleted_at=func.now())
    )
    await session.commit()
    session.add(new_trial())
    await session.commit()


async def test_list_and_detail_expose_data_source(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
) -> None:
    measured = (await client.post("/api/students", json=student_payload())).json()
    declared_id = (await declare_child(await make_parent(), school_class))["student_id"]

    listed = (await client.get("/api/students")).json()["items"]

    assert {i["id"]: i["data_source"] for i in listed} == {
        measured["id"]: "ADMIN_MEASURED",
        declared_id: "PARENT_DECLARED",
    }
    assert measured["data_source"] == "ADMIN_MEASURED"
    assert (await client.get(f"/api/students/{declared_id}")).json()[
        "data_source"
    ] == "PARENT_DECLARED"


async def test_admin_cannot_set_data_source(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
) -> None:
    created = await client.post(
        "/api/students", json=student_payload(data_source="PARENT_DECLARED")
    )
    assert created.status_code == 201 and created.json()["data_source"] == "ADMIN_MEASURED"
    updated = await client.put(
        f"/api/students/{created.json()['id']}",
        json=student_payload(data_source="PARENT_DECLARED", height_cm=127),
    )
    assert updated.status_code == 200 and updated.json()["data_source"] == "ADMIN_MEASURED"

    declared_id = (await declare_child(await make_parent(), school_class))["student_id"]
    body = student_payload(full_name="Lê Minh Anh", dob="2017-09-01", data_source="PARENT_DECLARED")
    promoted = await client.put(f"/api/students/{declared_id}", json=body)
    assert promoted.status_code == 200 and promoted.json()["data_source"] == "ADMIN_MEASURED"


async def test_detail_lists_linked_parents_and_declared_choices(
    client: AsyncClient,
    make_parent: MakeParent,
    student_payload: Payload,
    school_class: dict[str, Any],
) -> None:
    creator = await make_parent(email="Me.Tao@Example.com", full_name="Mẹ Tạo")
    declared_id = (await declare_child(creator, school_class))["student_id"]
    claimer = await make_parent(phone="0987654321", full_name="Bố Nhận")
    claim = await claimer.post(
        "/api/parent/children/claim",
        json=claim_key(school_class, full_name="le minh anh", dob="2017-09-01"),
    )
    assert claim.status_code == 200
    await creator.put(
        f"/api/parent/children/{declared_id}/size-choices/blazer",
        json={"size_label": "3", "colour": "navy"},
    )
    lonely = (await client.post("/api/students", json=student_payload())).json()

    detail = (await client.get(f"/api/students/{declared_id}")).json()

    parents = detail["linked_parents"]
    assert [(p["parent_id"], p["full_name"], p["origin"]) for p in parents] == [
        (creator.parent_id, "Mẹ Tạo", "CREATED"),
        (claimer.parent_id, "Bố Nhận", "CLAIMED"),
    ]
    assert (parents[0]["email"], parents[0]["phone"]) == ("me.tao@example.com", None)
    assert (parents[1]["email"], parents[1]["phone"]) == (None, "0987654321")
    assert all(p["linked_at"] for p in parents)
    assert set(parents[0]) == {"parent_id", "full_name", "email", "phone", "origin", "linked_at"}
    assert [(c["product_code"], c["size_label"]) for c in detail["parent_choices"]] == [
        ("blazer", "3")
    ]
    assert detail["trials"] == []
    assert lonely["linked_parents"] == []
