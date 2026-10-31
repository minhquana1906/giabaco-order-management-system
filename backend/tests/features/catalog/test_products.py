import io
import uuid
from pathlib import Path
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from PIL import Image, ImageChops, ImageDraw
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.features.catalog import images
from app.features.catalog.models import Product, ProductImage
from app.features.master_data.models import MasterRecord
from app.features.students.models import Fit, FittingTrial
from app.main import app
from tests.features.conftest import MakeStudent


def encoded(fmt: str, size: tuple[int, int], mode: str = "RGB", **save: Any) -> bytes:
    out = io.BytesIO()
    Image.new(mode, size, "white").save(out, fmt, **save)
    return out.getvalue()


PNG = encoded("PNG", (30, 40))
WEBP = encoded("WEBP", (64, 80))
GUIDE = [
    {
        "size_label": "1",
        "height_min_cm": 100,
        "height_max_cm": 120,
        "weight_min_kg": 15,
        "weight_max_kg": 20,
    },
    {
        "size_label": "2",
        "height_min_cm": 120,
        "height_max_cm": None,
        "weight_min_kg": 20,
        "weight_max_kg": None,
    },
]


def product_body(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "code": f"sooc_{uuid.uuid4().hex[:6]}",
        "name": "Quần sooc kaki nam",
        "description": "Quần sooc",
        "sizes": ["1", "2", "3"],
        "size_guide": GUIDE,
        "colours": ["ghi", "navy"],
        "gender_target": "MALE",
    }
    body.update(overrides)
    return body


async def make_product(client: AsyncClient, **overrides: Any) -> dict[str, Any]:
    r = await client.post("/api/products", json=product_body(**overrides))
    assert r.status_code == 201, r.text
    return r.json()  # type: ignore[no-any-return]


def update_body(product: dict[str, Any], **overrides: Any) -> dict[str, Any]:
    keys = ("name", "description", "sizes", "size_guide", "colours", "gender_target", "active")
    return {**{k: product[k] for k in keys}, **overrides}


def upload(school_id: str, gender: str = "MALE", colour: str = "ghi", **kw: Any) -> dict[str, Any]:
    data = kw.pop("content", PNG)
    name = kw.pop("name", "a.png")
    return {
        "data": {"school_id": school_id, "gender": gender, "colour": colour},
        "files": {"file": (name, data, "image/webp")},
        **kw,
    }


async def audit_actions(session: AsyncSession) -> list[str]:
    rows = await session.execute(text("SELECT action FROM audit_logs ORDER BY at, id"))
    return [r[0] for r in rows]


async def test_create_and_list_product(client: AsyncClient, session: AsyncSession) -> None:
    created = await make_product(client, code="quan_sooc")
    assert created["active"] is True
    assert created["colours"] == ["ghi", "navy"]
    listed = (await client.get("/api/products")).json()
    assert "quan_sooc" in [p["code"] for p in listed]
    assert await audit_actions(session) == ["product.create"]


async def make_type(client: AsyncClient, label: str, **extra: Any) -> dict[str, Any]:
    response = await client.post("/api/measurement-types", json={"label": label, **extra})
    assert response.status_code == 201, response.text
    return response.json()  # type: ignore[no-any-return]


def field(kind: dict[str, Any], instruction: str = "Đo quanh ngực") -> dict[str, Any]:
    return {
        "key": kind["key"],
        "label": kind["label"],
        "instruction": instruction,
        "required": True,
    }


async def test_measurement_type_gets_generated_key_and_rejects_normalized_duplicates(
    client: AsyncClient,
) -> None:
    created = await make_type(client, "Vòng ngực")
    assert created["key"].startswith("sd_")
    duplicate = await client.post("/api/measurement-types", json={"label": "  VÒNG   NGỰC  "})
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "duplicate_measurement"


async def test_similar_measurement_name_needs_confirmation(client: AsyncClient) -> None:
    await make_type(client, "Vòng ngực")
    similar = await client.post("/api/measurement-types", json={"label": "Vong nguc."})
    assert similar.status_code == 409
    assert similar.json()["error"]["code"] == "similar_measurement"
    await make_type(client, "Vong nguc.", confirm_similar=True)


async def test_product_measurements_come_from_catalog(client: AsyncClient) -> None:
    kind = await make_type(client, "Vòng ngực")
    fields = [field(kind)]
    product = await make_product(client, tailor_measurements=fields)
    assert product["tailor_measurements"] == fields
    response = await client.patch(f"/api/products/{product['id']}", json=update_body(product))
    assert response.status_code == 200
    assert response.json()["tailor_measurements"] == fields
    response = await client.patch(
        f"/api/products/{product['id']}", json=update_body(product, tailor_measurements=fields * 2)
    )
    assert response.status_code == 422
    unknown = [{**fields[0], "key": "khong_co"}]
    response = await client.patch(
        f"/api/products/{product['id']}", json=update_body(product, tailor_measurements=unknown)
    )
    assert response.status_code == 422


async def test_rename_updates_product_labels_and_rejects_duplicates(client: AsyncClient) -> None:
    kind = await make_type(client, "Vòng ngực")
    product = await make_product(client, tailor_measurements=[field(kind)])
    renamed = await client.patch(
        f"/api/measurement-types/{kind['key']}", json={"label": "Chu vi ngực"}
    )
    assert renamed.status_code == 200
    assert renamed.json() == {"key": kind["key"], "label": "Chu vi ngực"}
    refreshed = (await client.get(f"/api/products/{product['id']}")).json()
    assert refreshed["tailor_measurements"][0]["label"] == "Chu vi ngực"
    assert refreshed["tailor_measurements"][0]["instruction"] == "Đo quanh ngực"
    other = await make_type(client, "Dài tay")
    clash = await client.patch(
        f"/api/measurement-types/{other['key']}", json={"label": "chu  VI ngực"}
    )
    assert clash.status_code == 409


@pytest.mark.parametrize(
    "overrides",
    [
        {"code": "Bad Code"},
        {"colours": []},
        {"colours": ["ghi", "ghi"]},
        {"colours": ["tim"]},
        {"sizes": ["1", "1"]},
        {"size_guide": [{**GUIDE[0], "size_label": "9"}]},
        {"size_guide": [{**GUIDE[0], "height_max_cm": 90}]},
    ],
)
async def test_create_product_rejects_invalid(
    client: AsyncClient, overrides: dict[str, Any]
) -> None:
    r = await client.post("/api/products", json=product_body(**overrides))
    assert r.status_code == 422


async def test_product_colours_carry_label_and_swatch(client: AsyncClient) -> None:
    body = (await client.get("/api/product-colours")).json()
    assert {"code": "navy", "label": "Navy", "hex": "#1b2b4b"} in body
    assert all(c["hex"].startswith("#") and len(c["hex"]) == 7 for c in body)


async def test_duplicate_code_conflicts(client: AsyncClient) -> None:
    await make_product(client, code="dup_code")
    r = await client.post("/api/products", json=product_body(code="dup_code"))
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "duplicate_product"


async def test_update_changes_size_suggestions_and_hides(
    client: AsyncClient, session: AsyncSession
) -> None:
    product = await make_product(client, code="sooc_guide")
    before = await client.get("/api/size-suggestions", params={"height_cm": 110, "weight_kg": 17})
    assert before.json()["sooc_guide"] == "1"
    new_guide = [{**GUIDE[0], "height_min_cm": 100, "height_max_cm": 105}, GUIDE[1]]
    r = await client.patch(
        f"/api/products/{product['id']}", json=update_body(product, size_guide=new_guide)
    )
    assert r.status_code == 200
    after = await client.get("/api/size-suggestions", params={"height_cm": 110, "weight_kg": 17})
    assert after.json()["sooc_guide"] == "1"
    shifted = await client.get("/api/size-suggestions", params={"height_cm": 106, "weight_kg": 5})
    assert shifted.json()["sooc_guide"] is None

    r = await client.patch(
        f"/api/products/{product['id']}", json=update_body(product, active=False)
    )
    assert r.json()["active"] is False
    assert "sooc_guide" not in [p["code"] for p in (await client.get("/api/products")).json()]
    with_inactive = await client.get("/api/products", params={"include_inactive": "true"})
    assert "sooc_guide" in [p["code"] for p in with_inactive.json()]
    assert await audit_actions(session) == ["product.create", "product.update", "product.hide"]


async def test_removing_used_size_or_colour_is_in_use(
    client: AsyncClient, make_student: MakeStudent, session: AsyncSession
) -> None:
    product = await make_product(client, code="sooc_used")
    row = (await session.scalars(select(Product).where(Product.code == "sooc_used"))).one()
    student = await make_student()
    session.add(
        FittingTrial(student_id=student.id, product_id=row.id, size_label="3", fit=Fit("FITS"))
    )
    await session.commit()
    r = await client.patch(
        f"/api/products/{product['id']}",
        json=update_body(product, sizes=["1", "2"], size_guide=None),
    )
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "in_use"
    r = await client.patch(
        f"/api/products/{product['id']}", json=update_body(product, sizes=["1", "2", "3", "4"])
    )
    assert r.status_code == 200


async def test_upload_replace_delete_and_audit(client: AsyncClient, session: AsyncSession) -> None:
    school = (await client.post("/api/schools", json={"name": "Trường Q", "code": "LQD"})).json()
    product = await make_product(client)
    url = f"/api/products/{product['id']}/images"
    first = await client.post(url, **upload(school["id"]))
    assert first.status_code == 201, first.text
    body = first.json()
    assert (body["width"], body["height"]) == (30, 40)
    assert body["url"].startswith("/media/products/lqd/")
    assert body["url"].endswith(".webp")
    assert (Path(get_settings().media_dir) / body["url"].removeprefix("/media/")).is_file()

    second = await client.post(url, **upload(school["id"], content=WEBP, name="b.webp"))
    assert second.status_code == 201
    assert (second.json()["width"], second.json()["height"]) == (64, 80)
    assert second.json()["url"].endswith(".webp")
    listed = (await client.get(url, params={"school_id": school["id"]})).json()
    assert [i["id"] for i in listed] == [second.json()["id"]]
    rows = (await session.scalars(select(ProductImage))).all()
    assert sorted(r.deleted_at is None for r in rows) == [False, True]

    counts = (await client.get(f"/api/products/{product['id']}")).json()["school_image_counts"]
    assert counts == {school["id"]: 1}

    gone = await client.delete(f"{url}/{second.json()['id']}")
    assert gone.status_code == 204
    assert (await client.get(url)).json() == []
    assert (await client.delete(f"{url}/{second.json()['id']}")).status_code == 404
    assert sorted(await audit_actions(session)) == [
        "product.create",
        "product_image.create",
        "product_image.create",
        "product_image.delete",
        "product_image.replace",
    ]


async def test_upload_rejects_fake_image_oversize_and_foreign_colour(client: AsyncClient) -> None:
    school = (await client.post("/api/schools", json={"name": "Trường Q", "code": "LQD"})).json()
    product = await make_product(client)
    url = f"/api/products/{product['id']}/images"

    exe = await client.post(url, **upload(school["id"], content=b"MZ\x90\x00" * 50, name="x.webp"))
    assert exe.status_code == 422
    assert "file" in exe.json()["error"]["fields"]

    big = await client.post(url, **upload(school["id"], content=PNG + b"0" * (5 * 1024 * 1024)))
    assert big.status_code == 422
    assert "file" in big.json()["error"]["fields"]

    foreign = await client.post(url, **upload(school["id"], colour="trang"))
    assert foreign.status_code == 422
    assert "colour" in foreign.json()["error"]["fields"]

    no_school = await client.post(url, **upload(str(uuid.uuid4())))
    assert no_school.status_code == 404


async def test_find_image_returns_none_without_school_image(
    client: AsyncClient, session: AsyncSession
) -> None:
    lqd = (await client.post("/api/schools", json={"name": "Trường Q", "code": "LQD"})).json()
    other = (await client.post("/api/schools", json={"name": "Trường N", "code": "ND"})).json()
    product = await make_product(client)
    r = await client.post(f"/api/products/{product['id']}/images", **upload(lqd["id"]))
    assert r.status_code == 201
    pid = uuid.UUID(product["id"])
    found = await images.find_image(session, uuid.UUID(lqd["id"]), pid, "MALE", "ghi")
    assert found is not None
    assert found.url == r.json()["url"]
    assert await images.find_image(session, uuid.UUID(other["id"]), pid, "MALE", "ghi") is None
    assert await images.find_image(session, uuid.UUID(lqd["id"]), pid, "FEMALE", "ghi") is None


async def test_media_served_with_immutable_cache(client: AsyncClient) -> None:
    school = (await client.post("/api/schools", json={"name": "Trường Q", "code": "LQD"})).json()
    product = await make_product(client)
    url = (
        await client.post(f"/api/products/{product['id']}/images", **upload(school["id"]))
    ).json()["url"]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as anon:
        r = await anon.get(url)
        assert r.status_code == 200
        assert r.content[:4] == b"RIFF" and r.content[8:12] == b"WEBP"
        assert r.headers["cache-control"] == "public, max-age=31536000, immutable"
        assert (await anon.get("/media/../../etc/passwd")).status_code == 404
        assert (await anon.get("/media/products/none.png")).status_code == 404


async def test_products_api_requires_admin(anon_client: AsyncClient) -> None:
    assert (await anon_client.post("/api/products", json=product_body())).status_code == 401


async def test_removing_colour_used_by_campaign_item_is_in_use(client: AsyncClient) -> None:
    school = (await client.post("/api/schools", json={"name": "Trường C", "code": "CMP"})).json()
    product = await make_product(client, code="sooc_camp")
    campaign = await client.post(
        "/api/campaigns",
        json={"school_id": school["id"], "name": "Đợt 1", "school_year": "2026-2027"},
    )
    assert campaign.status_code == 201, campaign.text
    items = await client.put(
        f"/api/campaigns/{campaign.json()['id']}/items",
        json={
            "items": [
                {"product_id": product["id"], "unit_price": None, "colour": "navy", "sort": 0}
            ]
        },
    )
    assert items.status_code == 200, items.text
    r = await client.patch(
        f"/api/products/{product['id']}", json=update_body(product, colours=["ghi"])
    )
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "in_use"


async def test_patch_requires_explicit_active(client: AsyncClient) -> None:
    product = await make_product(client)
    body = update_body(product)
    del body["active"]
    assert (await client.patch(f"/api/products/{product['id']}", json=body)).status_code == 422


async def test_master_product_link_must_be_a_base_product(
    client: AsyncClient, session: AsyncSession
) -> None:
    base, material = [
        str(await session.scalar(select(MasterRecord.id).where(MasterRecord.kind == kind).limit(1)))
        for kind in ("products", "materials")
    ]
    product = await make_product(client, master_product_id=base)
    assert product["master_product_id"] == base
    url = f"/api/products/{product['id']}"
    wrong = await client.patch(url, json=update_body(product, master_product_id=material))
    assert wrong.status_code == 422
    cleared = await client.patch(url, json=update_body(product, master_product_id=None))
    assert cleared.json()["master_product_id"] is None


async def test_media_rejects_null_byte_and_directories(client: AsyncClient) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as anon:
        assert (await anon.get("/media/products%00.png")).status_code == 404
        assert (await anon.get("/media/products")).status_code == 404
        assert (await anon.get("/media/%2e%2e/%2e%2e/etc/passwd")).status_code == 404


def test_optimize_converts_and_limits_long_edge() -> None:
    jpg = images.optimize(encoded("JPEG", (3200, 1600)))
    assert jpg is not None and (jpg.width, jpg.height) == (1600, 800)
    assert jpg.data[:4] == b"RIFF" and jpg.data[8:12] == b"WEBP"
    small = images.optimize(PNG)
    assert small is not None and (small.width, small.height) == (30, 40)
    with Image.open(io.BytesIO(small.data)) as img:
        assert (img.format, img.size) == ("WEBP", (30, 40))


def test_optimize_keeps_optimised_webp_and_resizes_oversized_webp() -> None:
    kept = images.optimize(WEBP)
    assert kept is not None and kept.data is WEBP and (kept.width, kept.height) == (64, 80)
    big = images.optimize(encoded("WEBP", (2000, 500)))
    assert big is not None and (big.width, big.height) == (1600, 400)


def test_optimize_keeps_text_sharp_for_png() -> None:
    chart = Image.new("RGB", (400, 300), "white")
    ImageDraw.Draw(chart).text((20, 20), "Size 140 - 152 cm", fill="black")
    out = io.BytesIO()
    chart.save(out, "PNG")
    result = images.optimize(out.getvalue())
    assert result is not None
    with Image.open(io.BytesIO(result.data)) as img:
        assert ImageChops.difference(img.convert("RGB"), chart).getbbox() is None


def test_optimize_rejects_bad_input_and_decompression_bombs(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    assert images.optimize(b"") is None
    assert images.optimize(b"GIF89a" + b"\x00" * 40) is None
    assert images.optimize(PNG[:20]) is None
    assert images.optimize(PNG[: len(PNG) // 2]) is None
    assert images.optimize(encoded("GIF", (10, 10))) is None
    assert images.optimize(encoded("BMP", (10, 10))) is None
    monkeypatch.setattr(images, "MAX_PIXELS", 1000)
    assert images.optimize(PNG) is None


async def test_upload_stores_converted_size_in_db(
    client: AsyncClient, session: AsyncSession
) -> None:
    school = (await client.post("/api/schools", json={"name": "Trường Q", "code": "LQD"})).json()
    product = await make_product(client)
    url = f"/api/products/{product['id']}/images"
    r = await client.post(
        url, **upload(school["id"], content=encoded("JPEG", (2400, 1200)), name="a.jpg")
    )
    assert r.status_code == 201, r.text
    assert (r.json()["width"], r.json()["height"]) == (1600, 800)
    row = await session.scalar(select(ProductImage))
    assert row is not None and (row.width, row.height) == (1600, 800)
    with Image.open(Path(get_settings().media_dir) / row.path) as img:
        assert img.size == (1600, 800)

    bomb = await client.post(
        url, **upload(school["id"], content=encoded("PNG", (6000, 5000)), name="b.png")
    )
    assert bomb.status_code == 422
    assert "file" in bomb.json()["error"]["fields"]


async def test_optimize_media_script_dry_run_then_commit(
    client: AsyncClient, session: AsyncSession, capsys: pytest.CaptureFixture[str]
) -> None:
    from scripts.optimize_media import run

    school = (await client.post("/api/schools", json={"name": "Trường Q", "code": "LQD"})).json()
    product = await make_product(client)
    relative = f"products/legacy_{uuid.uuid4().hex[:8]}.jpg"
    original = Path(get_settings().media_dir) / relative
    original.parent.mkdir(parents=True, exist_ok=True)
    original.write_bytes(encoded("JPEG", (3000, 2000), quality=100))
    session.add(
        ProductImage(
            school_id=uuid.UUID(school["id"]),
            product_id=uuid.UUID(product["id"]),
            gender="MALE",
            colour="ghi",
            path=relative,
            width=3000,
            height=2000,
        )
    )
    await session.commit()

    assert await run(commit=False) == 0
    assert "[DRY RUN] scanned=1 converted=1" in capsys.readouterr().out
    row = (await session.scalars(select(ProductImage))).one()
    assert (row.path, row.width, row.height) == (relative, 3000, 2000)

    assert await run(commit=True) == 0
    assert "[COMMIT] scanned=1 converted=1" in capsys.readouterr().out
    await session.refresh(row)
    assert row.path != relative and row.path.endswith(".webp")
    assert (row.width, row.height) == (1600, 1067)
    assert original.is_file()
    assert (Path(get_settings().media_dir) / row.path).is_file()

    assert await run(commit=True) == 0
    assert "converted=0" in capsys.readouterr().out
    assert (await audit_actions(session)).count("product_image.optimize") == 1
