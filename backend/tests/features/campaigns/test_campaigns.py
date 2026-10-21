import asyncio
import uuid
from collections.abc import AsyncIterator
from typing import Any

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.campaigns.models import open_campaign_for_school
from app.features.campaigns.pricing import kit_price, suggest_option
from app.features.catalog.models import School
from app.main import app
from tests.conftest import ADMIN_PASSWORD, ADMIN_USERNAME

BASE = "/api/campaigns"


async def make_school(client: AsyncClient, code: str | None = None) -> str:
    code = code or uuid.uuid4().hex[:6]
    r = await client.post("/api/schools", json={"name": f"Trường {code}", "code": code})
    return str(r.json()["id"])


async def make_product(client: AsyncClient, **overrides: Any) -> dict[str, Any]:
    body = {
        "code": f"p_{uuid.uuid4().hex[:8]}",
        "name": "Sản phẩm",
        "sizes": ["1", "2"],
        "colours": ["ghi", "navy"],
        "gender_target": "UNISEX",
        **overrides,
    }
    r = await client.post("/api/products", json=body)
    assert r.status_code == 201, r.text
    return r.json()  # type: ignore[no-any-return]


def item(
    product: dict[str, Any], price: int | None = 100_000, colour: str = "ghi"
) -> dict[str, Any]:
    return {"product_id": product["id"], "unit_price": price, "colour": colour, "sort": 0}


async def make_campaign(client: AsyncClient, school_id: str, **overrides: Any) -> str:
    r = await client.post(
        BASE,
        json={"school_id": school_id, "name": "Tây Mỗ", "school_year": "2026-2027", **overrides},
    )
    assert r.status_code == 201, r.text
    return str(r.json()["id"])


async def put_items(client: AsyncClient, cid: str, *items: dict[str, Any]) -> Any:
    return await client.put(f"{BASE}/{cid}/items", json={"items": list(items)})


async def put_kits(client: AsyncClient, cid: str, *kits: dict[str, Any]) -> Any:
    return await client.put(f"{BASE}/{cid}/kits", json={"kits": list(kits)})


def kit(code: str, *slots: tuple[str, int, list[str]]) -> dict[str, Any]:
    return {
        "code": code,
        "name": code,
        "slots": [{"label": label, "qty": qty, "product_ids": ids} for label, qty, ids in slots],
    }


async def audit_actions(session: AsyncSession) -> list[str]:
    rows = await session.execute(
        text("SELECT action FROM audit_logs WHERE entity = 'campaign' ORDER BY at, id")
    )
    return [r[0] for r in rows]


async def test_fsm_edges_and_audit(client: AsyncClient, session: AsyncSession) -> None:
    school = await make_school(client)
    shirt = await make_product(client)
    cid = await make_campaign(client, school)
    assert (await client.post(f"{BASE}/{cid}/open")).json()["error"]["code"] == "no_items"
    assert (await client.post(f"{BASE}/{cid}/lock")).json()["error"]["code"] == "invalid_transition"
    assert (await put_items(client, cid, item(shirt))).status_code == 200
    for action, status in (("open", "OPEN"), ("lock", "LOCKED"), ("reopen", "OPEN")):
        r = await client.post(f"{BASE}/{cid}/{action}")
        assert r.status_code == 200 and r.json()["status"] == status
    assert (await client.post(f"{BASE}/{cid}/open")).status_code == 409
    assert await audit_actions(session) == [
        "campaign.create",
        "campaign.items.replace",
        "campaign.open",
        "campaign.lock",
        "campaign.reopen",
    ]


async def test_second_open_campaign_same_school_rejected(client: AsyncClient) -> None:
    school, other_school = await make_school(client), await make_school(client)
    shirt = await make_product(client)
    ids = []
    for school_id in (school, school, other_school):
        cid = await make_campaign(client, school_id)
        await put_items(client, cid, item(shirt))
        ids.append(cid)
    assert (await client.post(f"{BASE}/{ids[0]}/open")).status_code == 200
    r = await client.post(f"{BASE}/{ids[1]}/open")
    assert r.status_code == 409 and r.json()["error"]["code"] == "school_has_open_campaign"
    assert (await client.post(f"{BASE}/{ids[2]}/open")).status_code == 200
    await client.post(f"{BASE}/{ids[0]}/lock")
    assert (await client.post(f"{BASE}/{ids[1]}/open")).status_code == 200
    r = await client.post(f"{BASE}/{ids[0]}/reopen")
    assert r.status_code == 409 and r.json()["error"]["code"] == "school_has_open_campaign"


@pytest_asyncio.fixture
async def second_client(client: AsyncClient) -> AsyncIterator[AsyncClient]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            "/api/auth/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
        )
        assert r.status_code == 200
        yield c


async def test_parallel_open_allows_exactly_one(
    client: AsyncClient, second_client: AsyncClient
) -> None:
    school = await make_school(client)
    shirt = await make_product(client)
    ids = [await make_campaign(client, school) for _ in range(2)]
    for cid in ids:
        await put_items(client, cid, item(shirt))
    results = await asyncio.gather(
        client.post(f"{BASE}/{ids[0]}/open"), second_client.post(f"{BASE}/{ids[1]}/open")
    )
    assert sorted(r.status_code for r in results) == [200, 409]


async def test_locked_campaign_rejects_item_and_kit_edits(client: AsyncClient) -> None:
    school = await make_school(client)
    shirt = await make_product(client)
    cid = await make_campaign(client, school)
    await put_items(client, cid, item(shirt))
    await client.post(f"{BASE}/{cid}/open")
    await client.post(f"{BASE}/{cid}/lock")
    r = await put_items(client, cid, item(shirt, 5))
    assert r.status_code == 409 and r.json()["error"]["code"] == "campaign_locked"
    r = await put_kits(client, cid, kit("ke", ("Áo", 1, [shirt["id"]])))
    assert r.status_code == 409 and r.json()["error"]["code"] == "campaign_locked"


async def test_summer_kit_with_two_options_round_trips_and_keeps_kit_ids(
    client: AsyncClient,
) -> None:
    school = await make_school(client)
    shirt = await make_product(client)
    shorts = await make_product(client, gender_target="MALE")
    skirt = await make_product(client, gender_target="FEMALE")
    cid = await make_campaign(client, school)
    await put_items(client, cid, item(shirt), item(shorts, 200_000), item(skirt, None))
    summer = kit("bo_he", ("Áo", 2, [shirt["id"]]), ("Quần/Váy", 1, [shorts["id"], skirt["id"]]))
    r = await put_kits(client, cid, summer)
    assert r.status_code == 200, r.text
    first = r.json()["kits"][0]
    assert [s["product_ids"] for s in first["slots"]] == [
        [shirt["id"]],
        [shorts["id"], skirt["id"]],
    ]
    again = (await put_kits(client, cid, summer, kit("bo_dong", ("Áo", 1, [shirt["id"]])))).json()
    assert again["kits"][0]["id"] == first["id"] and len(again["kits"]) == 2


async def test_kit_validation_and_item_removal_guard(client: AsyncClient) -> None:
    school = await make_school(client)
    shirt, stray = await make_product(client), await make_product(client)
    cid = await make_campaign(client, school)
    await put_items(client, cid, item(shirt))
    r = await put_kits(client, cid, kit("bo", ("Áo", 1, [stray["id"]])))
    assert r.status_code == 422
    assert (await put_kits(client, cid, kit("bo", ("Áo", 11, [shirt["id"]])))).status_code == 422
    await put_kits(client, cid, kit("bo", ("Áo", 1, [shirt["id"]])))
    r = await put_items(client, cid)
    assert r.status_code == 409 and r.json()["error"]["code"] == "in_use"


async def test_item_rules(client: AsyncClient) -> None:
    school = await make_school(client)
    shirt = await make_product(client, colours=["ghi"])
    hidden = await make_product(client)
    detail = (await client.get(f"/api/products/{hidden['id']}")).json()
    keys = ("name", "description", "sizes", "size_guide", "colours", "gender_target")
    await client.patch(
        f"/api/products/{hidden['id']}",
        json={**{k: detail[k] for k in keys}, "active": False},
    )
    cid = await make_campaign(client, school)
    assert (await put_items(client, cid, item(shirt), item(shirt))).status_code == 422
    assert (await put_items(client, cid, item(shirt, colour="navy"))).status_code == 422
    assert (await put_items(client, cid, item(hidden))).status_code == 422
    assert (await put_items(client, cid, item(shirt, -1))).status_code == 422
    r = await put_items(client, cid, item(shirt, None))
    assert r.status_code == 200 and r.json()["items"][0]["unit_price"] is None


async def test_open_campaign_allows_adding_items_and_repricing(client: AsyncClient) -> None:
    school = await make_school(client)
    shirt, shorts = await make_product(client), await make_product(client)
    cid = await make_campaign(client, school)
    await put_items(client, cid, item(shirt))
    await client.post(f"{BASE}/{cid}/open")
    r = await put_items(client, cid, item(shirt, 150_000), item(shorts))
    assert r.status_code == 200
    assert {i["unit_price"] for i in r.json()["items"]} == {150_000, 100_000}


async def test_open_campaign_blocks_removing_items_and_kits_with_orders(
    client: AsyncClient, session: AsyncSession
) -> None:
    shirt, shorts, cap = [await make_product(client) for _ in range(3)]
    school = await make_school(client)
    cid = await make_campaign(client, school)
    await put_items(client, cid, item(shirt), item(shorts), item(cap))
    await put_kits(
        client, cid, kit("ka", ("Áo", 1, [shirt["id"]])), kit("kb", ("Quần", 1, [shorts["id"]]))
    )
    await client.post(f"{BASE}/{cid}/open")
    kits = (await client.get(f"{BASE}/{cid}")).json()["kits"]
    kit_a = next(k["id"] for k in kits if k["code"] == "ka")
    order_id, kit_line_id = uuid.uuid4(), uuid.uuid4()
    params = {"o": order_id, "c": cid, "p": cap["id"], "k": kit_a, "l": kit_line_id}
    for sql in (
        "INSERT INTO orders (id, campaign_id, code, recipient_name, source, deleted_at) "
        "VALUES (:o, :c, 'T1', 'x', 'STAFF', now())",
        "INSERT INTO order_kit_lines (id, order_id, kit_id, qty) VALUES (:l, :o, :k, 1)",
        "INSERT INTO order_lines (order_id, product_id, size_label, colour, qty) "
        "VALUES (:o, :p, '1', 'ghi', 1)",
    ):
        await session.execute(text(sql), params)
    await session.commit()
    try:
        r = await put_kits(client, cid, kit("kb", ("Quần", 1, [shorts["id"]])))
        assert r.status_code == 409 and r.json()["error"]["code"] == "in_use"
        assert (await put_items(client, cid, item(shirt), item(shorts))).status_code == 200
        assert (
            await put_items(client, cid, item(shirt), item(shorts), item(cap))
        ).status_code == 200
        await session.execute(text("UPDATE orders SET deleted_at = NULL WHERE id = :o"), params)
        await session.commit()
        r = await put_items(client, cid, item(shirt), item(shorts))
        assert r.status_code == 409 and r.json()["error"]["code"] == "in_use"
        r = await put_items(client, cid, item(shirt), item(shorts), item(cap, colour="navy"))
        assert r.status_code == 409
        r = await put_kits(client, cid, kit("ka", ("Áo", 1, [shirt["id"]])))
        assert r.status_code == 200 and [k["code"] for k in r.json()["kits"]] == ["ka"]
    finally:
        await session.execute(text("DELETE FROM orders WHERE id = :o"), params)
        await session.commit()


def test_kit_price_sums_qty_times_price_and_is_null_when_unpriced() -> None:
    a, b = uuid.uuid4(), uuid.uuid4()
    assert kit_price([(2, a), (1, b)], {a: 100_000, b: 50_000}) == 250_000
    assert kit_price([(2, a), (1, b)], {a: 100_000, b: None}) is None
    assert kit_price([(1, a)], {}) is None


def test_suggest_option_prefers_matching_gender_else_first() -> None:
    shorts, skirt = uuid.uuid4(), uuid.uuid4()
    genders = {shorts: "MALE", skirt: "FEMALE"}
    assert suggest_option([shorts, skirt], genders, "FEMALE") == skirt
    assert suggest_option([shorts, skirt], genders, "MALE") == shorts
    assert suggest_option([shorts, skirt], {shorts: "UNISEX", skirt: "UNISEX"}, "FEMALE") == shorts
    assert suggest_option([shorts, skirt], genders, None) == shorts


async def test_open_campaign_for_school_helper(client: AsyncClient, session: AsyncSession) -> None:
    school = await make_school(client)
    shirt = await make_product(client)
    cid = await make_campaign(client, school)
    await put_items(client, cid, item(shirt))
    school_uuid = uuid.UUID(school)
    assert await open_campaign_for_school(session, school_uuid) is None
    await client.post(f"{BASE}/{cid}/open")
    view = await open_campaign_for_school(session, school_uuid)
    assert view is not None and str(view.id) == cid and len(view.items) == 1
    assert (await session.scalar(select(School.id).where(School.id == school_uuid))) is not None


async def test_campaign_api_requires_admin(anon_client: AsyncClient) -> None:
    assert (await anon_client.get(BASE)).status_code == 401


async def test_campaign_window_validation_returns_422(client: AsyncClient) -> None:
    school = await make_school(client)
    base = {"school_id": school, "name": "Tây Mỗ", "school_year": "2026-2027"}
    for extra in (
        {"closes_at": "2000-01-01T00:00:00+00:00"},
        {"opens_at": "2026-01-01T00:00:00", "closes_at": "2026-02-01T00:00:00+00:00"},
        {"opens_at": "2026-03-01T00:00:00+00:00", "closes_at": "2026-02-01T00:00:00+00:00"},
    ):
        r = await client.post(BASE, json={**base, **extra})
        assert r.status_code == 422, extra


async def test_school_products_profile(client: AsyncClient) -> None:
    school = await make_school(client)
    url = f"/api/schools/{school}/products"
    assert (await client.get(url)).json() == []
    assert (await client.get(f"/api/schools/{uuid.uuid4()}/products")).status_code == 404

    a, b, c, dead = [await make_product(client) for _ in range(4)]
    old = await make_campaign(client, school, name="Cũ")
    await put_items(client, old, item(a), item(dead), item(c))
    assert [p["id"] for p in (await client.get(url)).json()] == [a["id"], dead["id"], c["id"]]

    body = {k: dead[k] for k in ("code", "name", "description", "sizes", "size_guide", "colours")}
    body["gender_target"] = dead["gender_target"]
    r = await client.patch(f"/api/products/{dead['id']}", json={**body, "active": False})
    assert r.status_code == 200, r.text
    new = await make_campaign(client, school, name="Mới")
    await put_items(client, new, {**item(b), "sort": 0}, {**item(a), "sort": 1})
    body = (await client.get(url)).json()
    assert [p["id"] for p in body] == [b["id"], a["id"], c["id"]]
    assert set(body[0]) == set((await client.get("/api/products")).json()[0])
    other = await make_school(client)
    assert (await client.get(f"/api/schools/{other}/products")).json() == []
