import struct
import uuid
from pathlib import Path
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.features.catalog import images
from app.features.catalog.models import Product, ProductImage
from app.features.students.models import Fit, FittingTrial
from app.main import app
from tests.features.conftest import MakeStudent

PNG = (
    b"\x89PNG\r\n\x1a\n"
    + struct.pack(">I", 13)
    + b"IHDR"
    + struct.pack(">II", 30, 40)
    + b"\x08\x06\x00\x00\x00"
)
WEBP = (
    b"RIFF"
    + struct.pack("<I", 22)
    + b"WEBPVP8X"
    + struct.pack("<I", 10)
    + b"\x00" * 4
    + ((63).to_bytes(3, "little") + (79).to_bytes(3, "little"))
)
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
    assert body["url"].endswith(".png")
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
        assert r.content == PNG
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


async def test_media_rejects_null_byte_and_directories(client: AsyncClient) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as anon:
        assert (await anon.get("/media/products%00.png")).status_code == 404
        assert (await anon.get("/media/products")).status_code == 404
        assert (await anon.get("/media/%2e%2e/%2e%2e/etc/passwd")).status_code == 404


def jpeg(width: int, height: int) -> bytes:
    sof = b"\xff\xc0" + struct.pack(">HBHHB", 11, 8, height, width, 1) + b"\x01\x11\x00"
    return b"\xff\xd8\xff\xe0" + struct.pack(">H", 4) + b"\x00\x00" + sof


def test_sniff_reads_dimensions_and_rejects_truncated_or_empty() -> None:
    from app.features.catalog.images import sniff

    assert (sniff(PNG).ext, sniff(PNG).width, sniff(PNG).height) == ("png", 30, 40)  # type: ignore[union-attr]
    assert (sniff(WEBP).ext, sniff(WEBP).width, sniff(WEBP).height) == ("webp", 64, 80)  # type: ignore[union-attr]
    info = sniff(jpeg(50, 70))
    assert info is not None and (info.ext, info.width, info.height) == ("jpg", 50, 70)
    assert sniff(PNG[:20]) is None
    assert sniff(jpeg(50, 70)[:12]) is None
    assert sniff(jpeg(0, 70)) is None
    assert sniff(b"") is None
    assert sniff(b"GIF89a" + b"\x00" * 40) is None
