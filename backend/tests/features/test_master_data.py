import unicodedata
import uuid
from pathlib import Path

import pytest
import pytest_asyncio
import yaml
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, func, select

from app.core.audit import AuditLog
from app.core.db import get_session
from app.core.errors import install_error_handlers
from app.core.security import require_admin
from app.features.master_data.fields import FIELDS, REQUIRED, missing_fields
from app.features.master_data.models import Facility, MasterRecord
from app.features.master_data.router import router
from app.features.production.models import FacilityStaff

SEED = yaml.safe_load(
    (Path(__file__).resolve().parents[2] / "config" / "master.seed.yaml").read_text("utf-8")
)
COUNTS = {"facilities": 10, "materials": 26, "suppliers": 10, "products": 59}


@pytest_asyncio.fixture
async def client(session):
    app = FastAPI()
    app.include_router(router)
    install_error_handlers(app)
    app.dependency_overrides[require_admin] = lambda: "admin"
    app.dependency_overrides[get_session] = lambda: session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as http:
        yield http
    await session.execute(delete(MasterRecord).where(MasterRecord.code.like("TEST-%")))
    await session.execute(delete(Facility).where(Facility.code.like("TEST-%")))
    await session.commit()


def supplier(code, **extra):
    return {"data": {"Mã NCC": code, **extra}}


@pytest.mark.parametrize("kind", FIELDS)
def test_seed_file_shape(kind):
    entries = SEED[kind]
    codes = [entry[FIELDS[kind][0]] for entry in entries]
    assert len(entries) == COUNTS[kind]
    assert len(set(codes)) == len(codes)
    assert all(set(entry) <= set(FIELDS[kind]) for entry in entries)
    assert all(isinstance(value, str) and value for entry in entries for value in entry.values())


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", FIELDS)
async def test_migration_loads_seed(session, kind):
    codes = {entry[FIELDS[kind][0]] for entry in SEED[kind]}
    query = (
        select(Facility.code)
        if kind == "facilities"
        else select(MasterRecord.code).where(MasterRecord.kind == kind)
    )
    assert codes <= set(await session.scalars(query))


def test_missing_fields_follow_dictionary():
    assert missing_fields("suppliers", {}) == list(REQUIRED["suppliers"])
    full = {field: "x" for field in REQUIRED["materials"]}
    assert missing_fields("materials", full) == []
    assert missing_fields("materials", {**full, "Tên NPL": "  "}) == ["Tên NPL"]


def test_material_conditional_fields():
    data = {field: "x" for field in REQUIRED["materials"]}
    data["Nhóm NPL"] = "Vải dệt kim"
    assert missing_fields("materials", data) == ["Thành phần"]
    data["Trạng thái phê duyệt"] = "Đã phê duyệt"
    assert missing_fields("materials", data) == ["NCC", "Thành phần", "Xuất xứ"]
    data.update({"Thành phần": "Cotton", "NCC": "A", "Xuất xứ": "Việt Nam"})
    assert missing_fields("materials", data) == []


def test_facility_in_use_needs_address_and_legal_documents():
    data = {field: "x" for field in REQUIRED["facilities"]}
    data["Trạng thái hợp tác"] = "Đang đánh giá"
    assert missing_fields("facilities", data) == []
    data["Trạng thái hợp tác"] = "Đang sử dụng"
    assert missing_fields("facilities", data) == ["Địa chỉ", "Hồ sơ pháp lý"]


@pytest.mark.asyncio
async def test_create_flags_missing_fields_and_audits(client, session):
    created = await client.post(
        "/api/master-data/suppliers", json=supplier("TEST-1", **{"Tên NCC/Đối tác": "Alpha"})
    )
    assert created.status_code == 201
    body = created.json()
    assert "Mã NCC" not in body["missing_fields"]
    assert "Đầu mối" in body["missing_fields"]
    listed = (await client.get("/api/master-data/suppliers")).json()
    assert next(row for row in listed if row["data"]["Mã NCC"] == "TEST-1") == body
    log = (await session.scalars(select(AuditLog).where(AuditLog.action == "create"))).one()
    assert (log.entity, str(log.entity_id), log.after) == (
        "master_suppliers",
        body["id"],
        {"code": "TEST-1"},
    )


@pytest.mark.asyncio
async def test_create_rejects_duplicate_blank_and_unknown_fields(client):
    assert (
        await client.post("/api/master-data/suppliers", json=supplier("TEST-2"))
    ).status_code == 201
    assert (
        await client.post("/api/master-data/suppliers", json=supplier("TEST-2"))
    ).status_code == 409
    # The same code is allowed in another kind.
    other = {"data": {"Mã NPL": "TEST-2"}}
    assert (await client.post("/api/master-data/materials", json=other)).status_code == 201
    assert (await client.post("/api/master-data/suppliers", json=supplier(" "))).status_code == 422
    assert (
        await client.post("/api/master-data/suppliers", json=supplier("TEST-3", Lạ="x"))
    ).status_code == 422


@pytest.mark.asyncio
async def test_update_keeps_code_and_audits_changed_field_names_only(client, session):
    record = (await client.post("/api/master-data/suppliers", json=supplier("TEST-4"))).json()
    data = {**record["data"], "Đầu mối": "Mr A"}
    updated = await client.put(f"/api/master-data/suppliers/{record['id']}", json={"data": data})
    assert updated.status_code == 200
    assert "Đầu mối" not in updated.json()["missing_fields"]
    log = (await session.scalars(select(AuditLog).where(AuditLog.action == "update"))).one()
    assert log.after == {"code": "TEST-4", "fields": ["Đầu mối"]}
    renamed = {**data, "Mã NCC": "TEST-OTHER"}
    assert (
        await client.put(f"/api/master-data/suppliers/{record['id']}", json={"data": renamed})
    ).status_code == 422
    missing = f"/api/master-data/suppliers/{uuid.uuid4()}"
    assert (await client.put(missing, json={"data": data})).status_code == 404


@pytest.mark.asyncio
async def test_delete_writes_audit_and_404s(client, session):
    record = (await client.post("/api/master-data/suppliers", json=supplier("TEST-5"))).json()
    assert (await client.delete(f"/api/master-data/suppliers/{record['id']}")).status_code == 204
    gone = await session.scalar(select(MasterRecord).where(MasterRecord.code == "TEST-5"))
    assert gone is None
    log = (await session.scalars(select(AuditLog).where(AuditLog.action == "delete"))).one()
    assert (log.entity, str(log.entity_id), log.before) == (
        "master_suppliers",
        record["id"],
        {"code": "TEST-5"},
    )
    assert (await client.delete(f"/api/master-data/suppliers/{record['id']}")).status_code == 404
    wrong_kind = await client.delete(f"/api/master-data/materials/{record['id']}")
    assert wrong_kind.status_code == 404


@pytest.mark.asyncio
async def test_summary_counts_records_needing_attention(client, session):
    before = (await client.get("/api/master-data/summary")).json()
    await client.post("/api/master-data/products", json={"data": {"Mã SP nền": "TEST-6"}})
    after = (await client.get("/api/master-data/summary")).json()
    assert after["products"]["total"] == before["products"]["total"] + 1
    assert after["products"]["needs_attention"] == before["products"]["needs_attention"] + 1
    facilities = await session.scalar(select(func.count()).select_from(Facility))
    records = await session.scalar(select(func.count()).select_from(MasterRecord))
    assert facilities + records == sum(kind["total"] for kind in after.values())
    assert after["facilities"]["total"] == facilities


@pytest.mark.asyncio
async def test_facility_status_controls_activity_and_in_use_blocks_delete(client, session):
    data = {"Mã cơ sở": "TEST-F1", "Tên cơ sở/đối tác": "Xưởng A"}
    record = (await client.post("/api/master-data/facilities", json={"data": data})).json()
    facility = await session.get(Facility, uuid.UUID(record["id"]))
    assert facility is not None and (facility.name, facility.active) == ("Xưởng A", True)
    paused = {**data, "Trạng thái hợp tác": "Tạm dừng/Không ưu tiên hợp tác"}
    url = f"/api/master-data/facilities/{record['id']}"
    assert (await client.put(url, json={"data": paused})).status_code == 200
    await session.refresh(facility)
    assert facility.active is False
    log = (
        await session.scalars(
            select(AuditLog).where(
                AuditLog.entity == "production_facility", AuditLog.action == "update"
            )
        )
    ).one()
    assert (log.before, log.after["active"]) == ({"active": True}, False)
    facility_id = facility.id
    session.add(FacilityStaff(facility_id=facility_id, username="test-f1", password_hash="x"))
    await session.commit()
    assert (await client.delete(url)).status_code == 409
    await session.execute(delete(FacilityStaff).where(FacilityStaff.facility_id == facility_id))
    await session.commit()
    assert (await client.delete(url)).status_code == 204


@pytest.mark.parametrize(
    ("status", "active"),
    [
        ("Đang sử dụng", True),
        ("Đang đánh giá", True),
        ("tạm dừng", False),
        ("  Ngưng hợp tác", False),
        ("Ngừng", False),
        (unicodedata.normalize("NFD", "Tạm dừng"), False),
        (None, True),
    ],
)
def test_facility_active_ignores_case_spacing_and_unicode_form(status, active):
    assert Facility(code="X", data={"Trạng thái hợp tác": status}).active is active


@pytest.mark.asyncio
async def test_base_product_lists_linked_catalog_products_and_blocks_delete(
    client, session, products
):
    record = (
        await client.post("/api/master-data/products", json={"data": {"Mã SP nền": "TEST-P1"}})
    ).json()
    product = products["blazer"]
    product.master_product_id = uuid.UUID(record["id"])
    await session.commit()
    try:
        listed = (await client.get("/api/master-data/products")).json()
        row = next(row for row in listed if row["id"] == record["id"])
        assert row["linked_products"] == [{"id": str(product.id), "name": product.name}]
        assert (await client.delete(f"/api/master-data/products/{record['id']}")).status_code == 409
    finally:
        product.master_product_id = None
        await session.commit()
