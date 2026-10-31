import uuid
from datetime import UTC, datetime

import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, text
from starlette.middleware.sessions import SessionMiddleware

from app.core.audit import AuditLog
from app.core.db import SessionLocal
from app.core.errors import install_error_handlers
from app.features.auth.router import router as auth_router
from app.features.campaigns.models import Campaign, CampaignItem
from app.features.catalog.models import School
from app.features.master_data.router import router as master_data_router
from app.features.orders.models import Order, OrderLine
from app.features.production.router import router

FIXTURE_IDS: dict[str, str] = {}
BASE = "/api/production"


@pytest_asyncio.fixture
async def production_clients(products):
    app = FastAPI()
    install_error_handlers(app)
    app.add_middleware(SessionMiddleware, secret_key="test-secret")
    app.include_router(auth_router)
    app.include_router(master_data_router)
    app.include_router(router)
    async with SessionLocal() as session:
        school = School(name="School", code=uuid.uuid4().hex[:8])
        session.add(school)
        await session.flush()
        campaign = Campaign(
            school_id=school.id,
            name="Đợt thử",
            school_year="2026-2027",
            opens_at=datetime.now(UTC),
        )
        session.add(campaign)
        await session.flush()
        product = products["blazer"]
        for item in (product, products["gile"]):
            session.add(CampaignItem(campaign_id=campaign.id, product_id=item.id, colour="ghi"))
        await session.commit()
        campaign_id, product_id = str(campaign.id), str(product.id)
        FIXTURE_IDS["gile"] = str(products["gile"].id)
    async with (
        AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as admin,
        AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as staff,
        AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as other,
    ):
        assert (
            await admin.post(
                "/api/auth/login", json={"username": "admin", "password": "test-password"}
            )
        ).status_code == 200
        yield admin, staff, other, campaign_id, product_id
    async with SessionLocal() as session:
        await session.execute(text("TRUNCATE production_staff, production_assignments CASCADE"))
        await session.execute(
            text("DELETE FROM orders WHERE campaign_id = :id"), {"id": uuid.UUID(campaign_id)}
        )
        await session.execute(text("DELETE FROM production_facilities WHERE code LIKE 'TEST-%'"))
        await session.commit()


def plain(timeline):
    """Timeline PUT takes no mode; strip it from a GET payload."""
    return {"steps": [{k: v for k, v in step.items() if k != "mode"} for step in timeline["steps"]]}


async def make_facility(admin, name, status="Đang sử dụng"):
    data = {"Mã cơ sở": f"TEST-{uuid.uuid4().hex[:8]}", "Tên cơ sở/đối tác": name}
    created = await admin.post(
        "/api/master-data/facilities", json={"data": {**data, "Trạng thái hợp tác": status}}
    )
    assert created.status_code == 201
    return created.json()


async def test_facility_session_cannot_reach_admin_api(production_clients):
    admin, staff, _, _, _ = production_clients
    base = "/api/production"
    facility = await make_facility(admin, "Factory Z")
    await admin.post(
        f"{base}/facilities/{facility['id']}/staff",
        json={"username": "factory-z", "password": "secure-password"},
    )
    login = {"username": "factory-z", "password": "secure-password"}
    assert (await staff.post(f"{base}/login", json=login)).status_code == 200
    for path in ("/api/auth/me", "/api/master-data/suppliers", "/api/master-data/definitions"):
        assert (await staff.get(path)).status_code == 401
    for path in ("/facilities", f"/facilities/{facility['id']}/staff"):
        assert (await staff.get(base + path)).status_code == 403


async def login_staff(admin, client, facility, username):
    account = await admin.post(
        f"{BASE}/facilities/{facility['id']}/staff",
        json={"username": username, "password": "secure-password"},
    )
    assert account.status_code == 201
    login = {"username": username, "password": "secure-password"}
    assert (await client.post(f"{BASE}/login", json=login)).status_code == 200
    return account.json()


async def assign(admin, campaign_id, facility, step, **extra):
    response = await admin.post(
        f"{BASE}/assignments",
        json={
            "campaign_id": campaign_id,
            "step_position": step,
            "facility_id": facility["id"],
            **extra,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_facility_isolation_and_progress(production_clients):
    admin, staff, other, campaign_id, product_id = production_clients
    assert (await staff.get(f"{BASE}/assignments")).status_code == 401
    facility = await make_facility(admin, "Factory A")
    another = await make_facility(admin, "Factory B")
    account = await login_staff(admin, staff, facility, "factory-a")
    assert "password_hash" not in account
    await login_staff(admin, other, another, "factory-b")
    assert (await staff.get("/api/auth/me")).status_code == 401
    timeline = (await admin.get(f"{BASE}/campaigns/{campaign_id}/timeline")).json()
    timeline["steps"][5].update(deadline="2000-01-01")
    timeline = plain(timeline)
    assert (
        await admin.put(f"{BASE}/campaigns/{campaign_id}/timeline", json=timeline)
    ).status_code == 200
    mine = await assign(admin, campaign_id, facility, 6, product_id=product_id, quantity=10)
    theirs = await assign(admin, campaign_id, another, 7)
    assert mine["overdue"] and mine["effective_deadline"] == "2000-01-01"
    assert mine["step_name"] == "Sản xuất" and mine["campaign_name"] == "Đợt thử"
    assert mine["facility_name"] == "Factory A" and mine["product_name"]
    listed = (await staff.get(f"{BASE}/assignments", params={"facility_id": another["id"]})).json()
    assert [row["id"] for row in listed] == [mine["id"]]
    assert [row["id"] for row in (await other.get(f"{BASE}/assignments")).json()] == [theirs["id"]]
    url = f"{BASE}/assignments/{mine['id']}"
    assert (await other.put(f"{url}/progress", json={"status": "completed"})).status_code == 404
    assert (await other.get(f"{url}/audit")).status_code == 404
    assert (await other.delete(url)).status_code == 403
    assert (await staff.patch(url, json={"quantity": 5})).status_code == 403
    assert (await staff.patch(url, json={"deadline": None})).status_code == 403
    assert (
        await staff.post(
            f"{BASE}/assignments",
            json={"campaign_id": campaign_id, "step_position": 1, "facility_id": facility["id"]},
        )
    ).status_code == 403
    assert (await staff.delete(url)).status_code == 403
    assert (await staff.get(f"{BASE}/campaigns/{campaign_id}/progress")).status_code == 403
    assert (
        await staff.put(f"{url}/progress", json={"status": "completed", "deadline": None})
    ).status_code == 422
    assert (
        await staff.put(f"{BASE}/assignments/{theirs['id']}/progress", json={"status": "completed"})
    ).status_code == 404
    updated = await staff.put(f"{url}/progress", json={"status": "completed"})
    assert updated.status_code == 200 and not updated.json()["overdue"]
    assert [e["action"] for e in (await staff.get(f"{url}/audit")).json()] == ["update_progress"]
    audit = (await admin.get(f"{url}/audit")).json()
    assert [e["action"] for e in audit] == ["create", "update_progress"]
    assert all("password" not in str(entry) for entry in audit)
    disabled = await admin.patch(
        f"{BASE}/facilities/{facility['id']}/staff/{account['id']}", json={"disabled": True}
    )
    assert disabled.status_code == 200
    assert (await staff.get(f"{BASE}/assignments")).status_code == 401


async def test_assignment_validation_and_admin_crud(production_clients):
    admin, _, _, campaign_id, product_id = production_clients
    facility = await make_facility(admin, "Factory")
    partner = await make_facility(admin, "Partner")
    paused = await make_facility(admin, "Paused", "Tạm dừng/Không ưu tiên hợp tác")
    body = {"campaign_id": campaign_id, "step_position": 6, "facility_id": facility["id"]}
    path = f"{BASE}/assignments"
    assert (
        await admin.post(path, json={**body, "product_id": str(uuid.uuid4())})
    ).status_code == 422
    assert (await admin.post(path, json={**body, "quantity": 0})).status_code == 422
    assert (await admin.post(path, json={**body, "step_position": 11})).status_code == 422
    assert (
        await admin.post(path, json={**body, "campaign_id": str(uuid.uuid4())})
    ).status_code == 404
    inactive = await admin.post(path, json={**body, "facility_id": paused["id"]})
    assert inactive.status_code == 409 and inactive.json()["error"]["code"] == "facility_inactive"
    whole = await assign(admin, campaign_id, facility, 6)
    clash = await admin.post(path, json=body)
    assert clash.status_code == 409 and "Phân công" in clash.json()["error"]["message"]
    scoped = await assign(admin, campaign_id, facility, 6, product_id=product_id)
    assert (await admin.post(path, json={**body, "product_id": product_id})).status_code == 409
    url = f"{path}/{scoped['id']}"
    patched = await admin.patch(
        url, json={"quantity": 7, "deadline": "2030-01-01", "facility_id": partner["id"]}
    )
    assert patched.status_code == 200
    assert patched.json()["facility_name"] == "Partner" and patched.json()["quantity"] == 7
    cleared = await admin.patch(url, json={"quantity": None, "deadline": None, "content": "x"})
    assert cleared.json()["quantity"] is None and cleared.json()["deadline"] is None
    assert (await admin.patch(url, json={"status": None})).status_code == 422
    assert (await admin.patch(url, json={"facility_id": None})).status_code == 422
    assert (await admin.patch(url, json={"facility_id": paused["id"]})).status_code == 409
    assert (await admin.patch(url, json={"product_id": str(uuid.uuid4())})).status_code == 422
    assert (
        await admin.patch(url, json={"product_id": None, "facility_id": facility["id"]})
    ).status_code == 409
    done = await admin.patch(url, json={"status": "completed", "actual_at": "2026-10-30T10:00:00Z"})
    assert done.json()["status"] == "completed"
    actions = [e["action"] for e in (await admin.get(f"{url}/audit")).json()]
    assert actions[:2] == ["create", "update"]
    assert sorted(actions[2:]) == ["update", "update_progress", "update_progress"]
    assert (await admin.delete(url)).status_code == 204
    assert (await admin.delete(url)).status_code == 404
    async with SessionLocal() as session:
        deleted = await session.scalar(
            select(AuditLog).where(
                AuditLog.entity == "production_assignment",
                AuditLog.entity_id == uuid.UUID(scoped["id"]),
                AuditLog.action == "delete",
            )
        )
    assert deleted and deleted.before["quantity"] is None and deleted.after is None
    assert (await admin.get(path, params={"limit": 0})).status_code == 422
    rows = (await admin.get(path, params={"campaign_id": campaign_id})).json()
    assert [row["id"] for row in rows] == [whole["id"]]


async def test_progress_states_demand_and_multiple_partners(production_clients):
    admin, _, _, campaign_id, product_id = production_clients
    first = await make_facility(admin, "Factory 1")
    second = await make_facility(admin, "Factory 2")
    gile_id = FIXTURE_IDS["gile"]
    async with SessionLocal() as session:
        submitted = Order(
            campaign_id=uuid.UUID(campaign_id),
            code=f"T{uuid.uuid4().hex[:10]}",
            recipient_name="A",
            source="STAFF",
            status="SUBMITTED",
            submitted_at=datetime.now(UTC),
        )
        draft = Order(
            campaign_id=uuid.UUID(campaign_id),
            code=f"T{uuid.uuid4().hex[:10]}",
            recipient_name="B",
            source="STAFF",
        )
        for order, qty in ((submitted, 3), (submitted, 2), (draft, 9)):
            order.lines.append(
                OrderLine(
                    product_id=uuid.UUID(product_id),
                    size_label="M",
                    colour="ghi",
                    qty=qty,
                )
            )
        session.add_all([submitted, draft])
        await session.commit()
    a = await assign(admin, campaign_id, first, 6, product_id=product_id, quantity=3)
    b = await assign(admin, campaign_id, second, 6, product_id=product_id, quantity=2)
    await assign(admin, campaign_id, first, 6, product_id=gile_id)
    await assign(admin, campaign_id, second, 4)
    for row in (a, b):
        await admin.put(f"{BASE}/assignments/{row['id']}/progress", json={"status": "in_progress"})
    progress = (await admin.get(f"{BASE}/campaigns/{campaign_id}/progress")).json()
    assert progress["campaign"]["name"] == "Đợt thử"
    assert progress["campaign"]["status"] == "DRAFT"
    assert progress["campaign"]["submitted_orders"] == 1
    states = {step["position"]: step["state"] for step in progress["steps"]}
    assert len(progress["steps"]) == 10
    assert states[6] == "in_progress" and states[4] == "in_progress"
    assert states[1] == "unassigned" and states[2] == "unassigned"
    step6 = progress["steps"][5]["assignments"]
    assert len(step6) == 3 and {row["facility_name"] for row in step6} == {"Factory 1", "Factory 2"}
    demand = {row["product_id"]: row["ordered_qty"] for row in progress["demand"]}
    assert demand == {product_id: 5, gile_id: 0}
    for row in (a, b):
        await admin.put(f"{BASE}/assignments/{row['id']}/progress", json={"status": "completed"})
    mixed = (await admin.get(f"{BASE}/campaigns/{campaign_id}/progress")).json()
    assert mixed["steps"][5]["state"] == "in_progress"
    assert mixed["steps"][3]["state"] == "in_progress"
    only = await admin.get(f"{BASE}/assignments", params={"campaign_id": campaign_id})
    assert [r["step_position"] for r in only.json()] == [4, 6, 6, 6]
    done = await assign(admin, campaign_id, first, 8)
    await admin.put(f"{BASE}/assignments/{done['id']}/progress", json={"status": "completed"})
    final = (await admin.get(f"{BASE}/campaigns/{campaign_id}/progress")).json()
    assert final["steps"][7]["state"] == "completed"
    assert (await admin.get(f"{BASE}/campaigns/{uuid.uuid4()}/progress")).status_code == 404


async def test_timeline_validation_assignment_scope_and_session_revocation(production_clients):
    admin, staff, _, campaign_id, product_id = production_clients
    base = BASE
    facility = await make_facility(admin, "Factory")
    account = (
        await admin.post(
            f"{base}/facilities/{facility['id']}/staff",
            json={"username": "factory", "password": "secure-password"},
        )
    ).json()
    assert (
        await staff.post(
            f"{base}/login", json={"username": "factory", "password": "secure-password"}
        )
    ).status_code == 200
    timeline = (await admin.get(f"{base}/campaigns/{campaign_id}/timeline")).json()
    timeline["steps"][0]["position"] = 2
    timeline = plain(timeline)
    assert (
        await admin.put(f"{base}/campaigns/{campaign_id}/timeline", json=timeline)
    ).status_code == 422
    assert (
        await admin.patch(
            f"{base}/facilities/{facility['id']}/staff/{account['id']}",
            json={"password": "another-password"},
        )
    ).status_code == 200
    assert (await staff.get(f"{base}/me")).status_code == 401
    assert (
        await staff.post(
            f"{base}/login", json={"username": "factory", "password": "another-password"}
        )
    ).status_code == 200
    assert (
        await admin.patch(
            f"{base}/facilities/{facility['id']}/staff/{account['id']}",
            json={"username": "factory-new"},
        )
    ).status_code == 200
    assert (await staff.get(f"{base}/me")).status_code == 401
    assert (
        await staff.post(
            f"{base}/login", json={"username": "factory-new", "password": "another-password"}
        )
    ).status_code == 200
    paused = {**facility["data"], "Trạng thái hợp tác": "Tạm dừng/Không ưu tiên hợp tác"}
    assert (
        await admin.put(f"/api/master-data/facilities/{facility['id']}", json={"data": paused})
    ).status_code == 200
    assert (await staff.get(f"{base}/me")).status_code == 401
    late = await admin.post(
        f"{base}/facilities/{facility['id']}/staff",
        json={"username": "factory-late", "password": "secure-password"},
    )
    assert late.status_code == 409
    async with SessionLocal() as session:
        rows = (
            await session.scalars(select(AuditLog).where(AuditLog.entity == "production_staff"))
        ).all()
        assert rows and all("password_hash" not in str(row.after) for row in rows)


async def test_audit_failure_rolls_back_assignment_changes(production_clients, monkeypatch):
    admin, _, _, campaign_id, _ = production_clients
    facility = await make_facility(admin, "Factory")
    other = await make_facility(admin, "Other")
    existing = await assign(admin, campaign_id, facility, 6)

    async def fail_record(*args, **kwargs):
        raise RuntimeError("audit unavailable")

    monkeypatch.setattr("app.features.production.router.record", fail_record)
    created = await admin.post(
        f"{BASE}/assignments",
        json={"campaign_id": campaign_id, "step_position": 7, "facility_id": facility["id"]},
    )
    progress = await admin.put(
        f"{BASE}/assignments/{existing['id']}/progress",
        json={"status": "completed", "content": "Done", "actual_at": "2026-10-29T10:00:00Z"},
    )
    patched = await admin.patch(
        f"{BASE}/assignments/{existing['id']}", json={"facility_id": other["id"]}
    )
    deleted = await admin.delete(f"{BASE}/assignments/{existing['id']}")
    assert {r.status_code for r in (created, progress, patched, deleted)} == {500}
    async with SessionLocal() as session:
        rows = (
            await session.execute(
                text(
                    "SELECT step_position, status, content, facility_id FROM production_assignments"
                )
            )
        ).all()
    assert [tuple(r) for r in rows] == [(6, "pending", None, uuid.UUID(facility["id"]))]


async def test_progress_history_preserves_omitted_fields(production_clients):
    admin, staff, other, campaign_id, _ = production_clients
    facility = await make_facility(admin, "Factory")
    listed = (await admin.get(f"{BASE}/facilities")).json()
    row = next(row for row in listed if row["id"] == facility["id"])
    assert (row["name"], row["active"]) == ("Factory", True)
    await login_staff(admin, staff, facility, "factory")
    assert (await staff.get("/api/master-data/facilities")).status_code == 401
    await login_staff(admin, other, await make_facility(admin, "Other"), "other")
    assignment = await assign(admin, campaign_id, facility, 1)
    url = f"{BASE}/assignments/{assignment['id']}/progress"
    assert (
        await staff.put(url, json={"status": "in_progress", "actual_at": "2026-10-29T10:00:00"})
    ).status_code == 422
    first = await staff.put(
        url,
        json={
            "status": "in_progress",
            "content": "Started",
            "actual_at": "2026-10-29T10:00:00+07:00",
        },
    )
    assert first.status_code == 200 and first.json()["content"] == "Started"
    assert len(first.json()["history"]) == 1
    second = await admin.put(
        url,
        json={
            "status": "completed",
            "content": "Finished",
            "actual_at": "2026-10-30T12:00:00+07:00",
        },
    )
    assert second.status_code == 200
    kept = (await staff.put(url, json={"status": "completed"})).json()
    assert kept["content"] == "Finished"
    assert datetime.fromisoformat(
        kept["actual_at"].replace("Z", "+00:00")
    ) == datetime.fromisoformat("2026-10-30T12:00:00+07:00")
    assert [e["content"] for e in kept["history"]] == ["Started", "Finished"]
    assert kept["history"][0]["actor"].startswith("production_staff:")
    cleared = (
        await staff.put(url, json={"status": "pending", "content": None, "actual_at": None})
    ).json()
    assert cleared["content"] is None and cleared["actual_at"] is None


async def test_patch_progress_fields_audit_and_unique_conflict(production_clients):
    admin, staff, other, campaign_id, product_id = production_clients
    facility = await make_facility(admin, "Factory")
    partner = await make_facility(admin, "Partner")
    await login_staff(admin, staff, facility, "factory")
    await login_staff(admin, other, partner, "partner")
    mine = await assign(admin, campaign_id, facility, 6, product_id=product_id)
    clash = await assign(admin, campaign_id, partner, 6, product_id=product_id)
    url = f"{BASE}/assignments/{mine['id']}"
    patched = await admin.patch(url, json={"status": "in_progress", "content": "Cutting"})
    assert patched.status_code == 200
    assert [h["content"] for h in patched.json()["history"]] == ["Cutting"]
    assert [e["action"] for e in (await staff.get(f"{url}/audit")).json()] == ["update_progress"]
    assert (await admin.patch(url, json={"quantity": 4})).status_code == 200
    assert [e["action"] for e in (await staff.get(f"{url}/audit")).json()] == ["update_progress"]
    assert len((await admin.get(f"{url}/audit")).json()) == 3
    noop = await staff.put(f"{url}/progress", json={"status": "in_progress"})
    assert noop.status_code == 200
    assert len((await admin.get(f"{url}/audit")).json()) == 3
    conflict = await admin.patch(url, json={"facility_id": partner["id"]})
    assert conflict.status_code == 409 and "Phân công" in conflict.json()["error"]["message"]
    assert (await admin.get(f"{BASE}/assignments", params={"limit": 5})).status_code == 200
    seen = (await staff.get(f"{BASE}/assignments", params={"facility_id": partner["id"]})).json()
    assert [row["id"] for row in seen] == [mine["id"]] and clash["id"] not in str(seen)


async def set_mode(admin, campaign_id, position, mode):
    return await admin.patch(
        f"{BASE}/campaigns/{campaign_id}/steps/{position}", json={"mode": mode}
    )


async def test_step_mode_switch_conflicts_both_directions(production_clients):
    admin, _, _, campaign_id, _ = production_clients
    facility = await make_facility(admin, "Factory")
    steps = (await admin.get(f"{BASE}/campaigns/{campaign_id}/timeline")).json()["steps"]
    assert {step["mode"] for step in steps} == {"partners"}
    changed = await set_mode(admin, campaign_id, 3, "internal")
    assert changed.status_code == 200
    assert changed.json() == {
        "position": 3,
        "name": "Dự báo nguyên phụ liệu",
        "deadline": None,
        "mode": "internal",
    }
    steps = (await admin.get(f"{BASE}/campaigns/{campaign_id}/timeline")).json()["steps"]
    assert [step["mode"] for step in steps].count("internal") == 1
    put = await admin.put(f"{BASE}/campaigns/{campaign_id}/timeline", json=plain({"steps": steps}))
    assert put.status_code == 200 and put.json()["steps"][2]["mode"] == "internal"
    progress = (await admin.get(f"{BASE}/campaigns/{campaign_id}/progress")).json()
    assert progress["steps"][2]["mode"] == "internal"

    await assign(admin, campaign_id, facility, 6)
    refused = await set_mode(admin, campaign_id, 6, "internal")
    assert refused.status_code == 409 and "Hủy các phân công" in refused.json()["error"]["message"]
    created = await admin.post(
        f"{BASE}/assignments", json={"campaign_id": campaign_id, "step_position": 3}
    )
    assert created.status_code == 201
    assert (await set_mode(admin, campaign_id, 3, "partners")).status_code == 409
    assert (await set_mode(admin, campaign_id, 11, "partners")).status_code == 404
    assert (await set_mode(admin, campaign_id, 3, "other")).status_code == 422
    async with SessionLocal() as session:
        audit = (
            await session.scalars(
                select(AuditLog).where(
                    AuditLog.entity == "production_timeline",
                    AuditLog.entity_id == uuid.UUID(campaign_id),
                    AuditLog.after["mode"].is_not(None),
                )
            )
        ).all()
    assert [(a.before["mode"], a.after["mode"], a.after["position"]) for a in audit] == [
        ("partners", "internal", 3)
    ]


async def test_internal_assignment_rules(production_clients):
    admin, _, _, campaign_id, product_id = production_clients
    facility = await make_facility(admin, "Factory")
    assert (await set_mode(admin, campaign_id, 2, "internal")).status_code == 200
    url = f"{BASE}/assignments"
    body = {"campaign_id": campaign_id, "step_position": 2}
    for extra in (
        {"facility_id": facility["id"]},
        {"product_id": product_id},
        {"quantity": 5},
    ):
        assert (await admin.post(url, json={**body, **extra})).status_code == 422
    row = await admin.post(
        url,
        json={
            **body,
            "assignee": "Phòng Thiết kế",
            "status": "in_progress",
            "content": "Duyệt mẫu",
            "deadline": "2026-11-01",
        },
    )
    assert row.status_code == 201
    row = row.json()
    assert row["facility_id"] is None and row["facility_name"] is None
    assert row["assignee"] == "Phòng Thiết kế" and row["step_mode"] == "internal"
    assert row["status"] == "in_progress" and row["content"] == "Duyệt mẫu"
    assert (await admin.post(url, json=body)).status_code == 409
    item = f"{url}/{row['id']}"
    for patch in ({"facility_id": facility["id"]}, {"product_id": product_id}, {"quantity": 3}):
        assert (await admin.patch(item, json=patch)).status_code == 422
    done = await admin.patch(item, json={"assignee": "Anh Nam", "status": "completed"})
    assert done.status_code == 200 and done.json()["assignee"] == "Anh Nam"
    assert (await admin.patch(item, json={"assignee": None})).json()["assignee"] is None
    audit = (await admin.get(f"{item}/audit")).json()
    assert audit[0]["after"]["assignee"] == "Phòng Thiết kế"
    assert audit[0]["after"]["campaign_id"] == campaign_id

    partner = await assign(admin, campaign_id, facility, 6)
    assert (
        await admin.post(
            url, json={"campaign_id": campaign_id, "step_position": 7, "assignee": "X"}
        )
    ).status_code == 422
    assert (
        await admin.post(url, json={"campaign_id": campaign_id, "step_position": 7})
    ).status_code == 422
    assert (await admin.patch(f"{url}/{partner['id']}", json={"assignee": "X"})).status_code == 422


async def test_facility_cannot_see_or_touch_internal_rows(production_clients):
    admin, staff, _, campaign_id, _ = production_clients
    facility = await make_facility(admin, "Factory")
    await login_staff(admin, staff, facility, "factory-int")
    await set_mode(admin, campaign_id, 1, "internal")
    internal = (
        await admin.post(
            f"{BASE}/assignments", json={"campaign_id": campaign_id, "step_position": 1}
        )
    ).json()
    mine = await assign(admin, campaign_id, facility, 6)
    assert [r["id"] for r in (await staff.get(f"{BASE}/assignments")).json()] == [mine["id"]]
    url = f"{BASE}/assignments/{internal['id']}"
    assert (await staff.put(f"{url}/progress", json={"status": "completed"})).status_code == 404
    assert (await staff.get(f"{url}/audit")).status_code == 404


async def test_facility_list_exposes_main_stage(production_clients):
    admin, _, _, _, _ = production_clients
    data = {"Mã cơ sở": f"TEST-{uuid.uuid4().hex[:8]}", "Tên cơ sở/đối tác": "Stage"}
    staged = await admin.post(
        "/api/master-data/facilities",
        json={"data": {**data, "Công đoạn chính": "  May/lắp ráp "}},
    )
    blank = await make_facility(admin, "No stage")
    assert staged.status_code == 201
    rows = {r["id"]: r for r in (await admin.get(f"{BASE}/facilities")).json()}
    assert rows[staged.json()["id"]]["main_stage"] == "May/lắp ráp"
    assert rows[blank["id"]]["main_stage"] is None


async def test_campaign_activity_includes_deleted_and_mode_changes(production_clients):
    admin, _, _, campaign_id, product_id = production_clients
    facility = await make_facility(admin, "Factory A")
    url = f"{BASE}/campaigns/{campaign_id}/activity"
    assert (await admin.get(url, params={"limit": 0})).status_code == 422
    await set_mode(admin, campaign_id, 1, "internal")
    internal = (
        await admin.post(
            f"{BASE}/assignments",
            json={"campaign_id": campaign_id, "step_position": 1, "assignee": "Phòng KD"},
        )
    ).json()
    kept = await assign(admin, campaign_id, facility, 6, product_id=product_id, quantity=10)
    gone = await assign(admin, campaign_id, facility, 7)
    progress = await admin.put(
        f"{BASE}/assignments/{kept['id']}/progress",
        json={"status": "completed", "content": "Xong lô 1"},
    )
    assert progress.status_code == 200
    assert (await admin.delete(f"{BASE}/assignments/{gone['id']}")).status_code == 204
    assert (
        await admin.put(
            f"{BASE}/campaigns/{campaign_id}/timeline",
            json=plain((await admin.get(f"{BASE}/campaigns/{campaign_id}/timeline")).json()),
        )
    ).status_code == 200
    events = (await admin.get(url)).json()
    assert [(e["action"], e["step_position"]) for e in events] == [
        ("delete", 7),
        ("update_progress", 6),
        ("create", 7),
        ("create", 6),
        ("create", 1),
        ("mode", 1),
    ]
    delete, progress_event, _, _, created_internal, mode = events
    assert delete["partner"] == "Factory A" and delete["step_name"] == "Kiểm tra chất lượng"
    assert progress_event["status"] == "completed" and progress_event["note"] == "Xong lô 1"
    assert progress_event["product_name"] and progress_event["partner"] == "Factory A"
    assert created_internal["partner"] == "Phòng KD" and created_internal["product_name"] is None
    assert mode["note"] == "Nội bộ" and mode["partner"] is None
    assert internal["id"] and len((await admin.get(url, params={"limit": 2})).json()) == 2
