import uuid
from pathlib import Path
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.catalog.models import Product
from app.features.catalog.seed import seed_catalog, validate_product

SEED = Path(__file__).resolve().parents[3] / "config" / "catalog.seed.yaml"


def test_seed_rejects_guide_label_outside_sizes() -> None:
    spec = {
        "code": "x",
        "name": "X",
        "sizes": ["1", "2"],
        "size_guide": [{"size_label": "9"}],
    }
    with pytest.raises(ValueError, match="size_guide"):
        validate_product(spec)


def test_seed_rejects_duplicate_sizes() -> None:
    with pytest.raises(ValueError, match="sizes"):
        validate_product({"code": "x", "name": "X", "sizes": ["1", "1"]})


async def test_seed_is_idempotent(session: AsyncSession) -> None:
    await seed_catalog(session, SEED)
    await seed_catalog(session, SEED)
    assert await session.scalar(select(func.count()).select_from(Product)) == 2


async def test_products_endpoint(client: AsyncClient) -> None:
    r = await client.get("/api/products")
    body = r.json()
    assert [p["code"] for p in body] == ["blazer", "gile"]
    assert body[0]["name"] == "Áo Blazer (Vest)"
    assert body[0]["sizes"] == ["1", "2", "3", "4", "5", "6", "7"]
    assert body[0]["has_size_guide"] is True


@pytest.mark.parametrize(
    ("h", "w", "expected"),
    [(140, 32, "4"), (120, 18, "2"), (95, 12, None)],
)
async def test_size_suggestions(
    client: AsyncClient, h: float, w: float, expected: str | None
) -> None:
    r = await client.get("/api/size-suggestions", params={"height_cm": h, "weight_kg": w})
    assert r.json() == {"blazer": expected, "gile": expected}


async def test_schools_and_classes(client: AsyncClient) -> None:
    r = await client.post("/api/schools", json={"name": "Trường B", "code": "TB"})
    assert r.status_code == 201
    school = r.json()
    dup = await client.post("/api/schools", json={"name": "Khác", "code": "TB"})
    assert dup.status_code == 409 and dup.json()["error"]["code"] == "duplicate_school"

    for grade, name in [(3, "3A1"), (2, "2A2"), (2, "2A1")]:
        assert (
            await client.post(
                f"/api/schools/{school['id']}/classes", json={"grade": grade, "name": name}
            )
        ).status_code == 201
    dup_class = await client.post(
        f"/api/schools/{school['id']}/classes", json={"grade": 2, "name": "2A1"}
    )
    assert dup_class.json()["error"]["code"] == "duplicate_class"
    listing: list[dict[str, Any]] = (
        await client.get(f"/api/schools/{school['id']}/classes")
    ).json()
    assert [c["name"] for c in listing] == ["2A1", "2A2", "3A1"]

    bad = await client.post(f"/api/schools/{school['id']}/classes", json={"grade": 13, "name": "X"})
    assert bad.status_code == 422 and "grade" in bad.json()["error"]["fields"]
    missing = await client.get("/api/schools/00000000-0000-0000-0000-000000000000/classes")
    assert missing.status_code == 404


async def _school_with_classes(client: AsyncClient, *names: tuple[int, str]) -> dict[str, Any]:
    school = (await client.post("/api/schools", json={"name": "Trường C", "code": "TC"})).json()
    classes = [
        (
            await client.post(f"/api/schools/{school['id']}/classes", json={"grade": g, "name": n})
        ).json()
        for g, n in names
    ]
    return {"school": school, "classes": classes}


@pytest.mark.parametrize(("grade", "name"), [(3, "1A1"), (1, "10A1"), (3, "A3"), (10, "1A1")])
async def test_class_name_must_start_with_grade(client: AsyncClient, grade: int, name: str) -> None:
    school = (await client.post("/api/schools", json={"name": "Trường D", "code": "TD"})).json()
    r = await client.post(
        f"/api/schools/{school['id']}/classes", json={"grade": grade, "name": name}
    )
    assert r.status_code == 422
    assert f"khối {grade}" in r.json()["error"]["fields"]["name"]


async def test_class_valid_for_two_digit_grade(client: AsyncClient) -> None:
    school = (await client.post("/api/schools", json={"name": "Trường D", "code": "TD"})).json()
    r = await client.post(
        f"/api/schools/{school['id']}/classes", json={"grade": 10, "name": "10A1"}
    )
    assert r.status_code == 201 and r.json()["grade"] == 10


async def test_rename_school(client: AsyncClient) -> None:
    school = (await client.post("/api/schools", json={"name": "Truong E", "code": "TE"})).json()
    r = await client.patch(f"/api/schools/{school['id']}", json={"name": "  Trường E  "})
    assert r.status_code == 200
    assert r.json() == {"id": school["id"], "name": "Trường E", "code": "TE"}
    missing = await client.patch(
        "/api/schools/00000000-0000-0000-0000-000000000000", json={"name": "X"}
    )
    assert missing.status_code == 404


async def test_edit_class(client: AsyncClient) -> None:
    data = await _school_with_classes(client, (3, "3A1"))
    school_id, class_id = data["school"]["id"], data["classes"][0]["id"]
    r = await client.patch(
        f"/api/schools/{school_id}/classes/{class_id}", json={"grade": 4, "name": "4A1"}
    )
    assert r.status_code == 200
    assert (r.json()["grade"], r.json()["name"]) == (4, "4A1")
    bad = await client.patch(
        f"/api/schools/{school_id}/classes/{class_id}", json={"grade": 5, "name": "4A1"}
    )
    assert bad.status_code == 422
    other = await client.patch(
        f"/api/schools/{uuid.uuid4()}/classes/{class_id}", json={"grade": 4, "name": "4A1"}
    )
    assert other.status_code == 404


async def test_edit_class_conflict(client: AsyncClient) -> None:
    data = await _school_with_classes(client, (3, "3A1"), (3, "3A2"))
    school_id, second = data["school"]["id"], data["classes"][1]["id"]
    r = await client.patch(
        f"/api/schools/{school_id}/classes/{second}", json={"grade": 3, "name": "3A1"}
    )
    assert r.status_code == 409 and r.json()["error"]["code"] == "duplicate_class"
