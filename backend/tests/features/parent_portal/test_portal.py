import uuid
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import AuditLog
from app.core.events import bus
from app.features.campaigns.models import Campaign
from app.features.catalog.models import ProductImage
from app.features.orders.models import Order
from app.features.parent_portal import handler
from app.features.students.models import Gender, Student
from tests.conftest import Payload
from tests.features.conftest import OpenCampaign

GHI = {"code": "ghi", "label": "Ghi", "hex": "#a3a9b3"}


async def make_student(client: AsyncClient, payload: Payload) -> dict[str, Any]:
    trials = [{"product_code": "blazer", "size_label": "2", "fit": "FITS", "note": "bí mật"}]
    r = await client.post(
        "/api/students",
        json=payload(parent_email="phu.huynh@example.com", parent_name="Phụ Huynh", trials=trials),
    )
    return r.json()  # type: ignore[no-any-return]


async def test_public_view_has_no_pii(client: AsyncClient, student_payload: Payload) -> None:
    student = await make_student(client, student_payload)
    r = await client.get(f"/api/public/students/{student['portal_token']}")
    assert r.status_code == 200
    body = r.json()
    assert body["full_name"] == "Nguyễn Minh Khang" and body["class_name"] == "2A1"
    assert body["trials"] == [
        {
            "product_code": "blazer",
            "product_name": "Áo Blazer (Vest)",
            "size_label": "2",
            "fit": "FITS",
        }
    ]
    assert [p["code"] for p in body["products"]] == ["blazer", "gile"]
    raw = r.text
    for secret in ("0912345678", "phu.huynh", "2018-03-14", "dob", "parent_", "bí mật"):
        assert secret not in raw
    assert r.headers["x-robots-tag"] == "noindex"


async def test_bad_token_404(anon_client: AsyncClient) -> None:
    r = await anon_client.get("/api/public/students/does-not-exist")
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"
    assert r.headers["x-robots-tag"] == "noindex"


def lines(products: dict[str, Any], campaign: Campaign, **overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "kit_lines": [
            {
                "kit_id": str(campaign.kits[0].id),
                "qty": 1,
                "size_label": "3",
                "slots": [{"slot_id": str(campaign.kits[0].slots[1].id), "size_label": "4"}],
            }
        ],
        "item_lines": [{"product_id": str(products["blazer"].id), "size_label": "2", "qty": 2}],
    }
    return body | overrides


async def test_ordering_without_open_campaign_is_empty(
    client: AsyncClient, student_payload: Payload
) -> None:
    student = await make_student(client, student_payload)
    r = await client.get(f"/api/public/students/{student['portal_token']}/ordering")
    assert r.status_code == 200
    assert r.json() == {
        "campaign": None,
        "kits": [],
        "items": [],
        "suggested_sizes": {},
        "order": None,
    }


async def test_ordering_view_has_kits_items_prices_and_images(
    client: AsyncClient,
    student_payload: Payload,
    school_class: dict[str, Any],
    products: dict[str, Any],
    open_campaign: OpenCampaign,
    session: AsyncSession,
) -> None:
    campaign = await open_campaign(school_class["school_id"])
    session.add(
        ProductImage(
            school_id=uuid.UUID(school_class["school_id"]),
            product_id=products["blazer"].id,
            gender="MALE",
            colour="ghi",
            path="products/x/blazer.webp",
            width=640,
            height=800,
        )
    )
    await session.commit()
    student = await make_student(client, student_payload)

    body = (await client.get(f"/api/public/students/{student['portal_token']}/ordering")).json()

    assert body["campaign"]["status"] == "OPEN" and body["campaign"]["closes_at"] is None
    assert body["order"] is None
    assert set(body["suggested_sizes"]) == {"blazer", "gile"}
    kit = body["kits"][0]
    assert kit["price"] is None
    assert kit["image"] == {"url": "/media/products/x/blazer.webp", "width": 640, "height": 800}
    assert [s["label"] for s in kit["slots"]] == ["Blazer", "Gile"]
    option = kit["slots"][0]["options"][0]
    assert option["code"] == "blazer" and option["suggested"] is True
    assert option["colours"] == [GHI] and option["sizes"][0] == "1"
    assert kit["slots"][1]["options"][0]["image"] is None
    blazer, gile = body["items"]
    assert (blazer["price"], blazer["colours"]) == (500_000, [GHI])
    assert blazer["image"]["width"] == 640
    assert (gile["price"], gile["image"]) == (None, None)
    assert str(campaign.id) == body["campaign"]["id"]


async def test_put_order_creates_submits_and_replaces_one_order(
    client: AsyncClient,
    student_payload: Payload,
    school_class: dict[str, Any],
    products: dict[str, Any],
    open_campaign: OpenCampaign,
    session: AsyncSession,
) -> None:
    campaign = await open_campaign(school_class["school_id"])
    student = await make_student(client, student_payload)
    base = f"/api/public/students/{student['portal_token']}"

    async with bus.subscribe() as queue:
        r = await client.put(f"{base}/order", json=lines(products, campaign))
        assert queue.get_nowait() == {"orders"}
    assert r.status_code == 200, r.text
    order = r.json()["order"]
    assert order["status"] == "SUBMITTED" and order["submitted_at"] is not None
    assert order["total"] == 1_500_000 and order["has_unpriced"] is True
    assert order["item_lines"] == [
        {
            "product_id": str(products["blazer"].id),
            "size_label": "2",
            "colour": "ghi",
            "qty": 2,
        }
    ]
    kit_line = order["kit_lines"][0]
    assert (kit_line["qty"], kit_line["size_label"]) == (1, "3")
    assert {(s["size_label"], s["colour"]) for s in kit_line["slots"]} == {
        ("3", "ghi"),
        ("4", "ghi"),
    }

    again = await client.put(f"{base}/order", json=lines(products, campaign, kit_lines=[]))
    assert again.json()["order"]["id"] == order["id"]
    assert again.json()["order"]["kit_lines"] == []
    assert (await client.get(f"{base}/ordering")).json()["order"]["id"] == order["id"]

    stored = (await session.scalars(select(Order))).all()
    assert len(stored) == 1
    assert (stored[0].source, stored[0].student_id, stored[0].class_label) == (
        "PARENT",
        uuid.UUID(student["id"]),
        "2A1",
    )
    assert (stored[0].recipient_name, stored[0].gender) == ("Nguyễn Minh Khang", "MALE")
    logs = (await session.scalars(select(AuditLog).where(AuditLog.entity == "order"))).all()
    assert {log.actor for log in logs} == {"parent"}
    assert sorted(log.action for log in logs) == [
        "order.create",
        "order.lines.replace",
        "order.lines.replace",
    ]


async def test_put_order_validation(
    client: AsyncClient,
    student_payload: Payload,
    school_class: dict[str, Any],
    products: dict[str, Any],
    open_campaign: OpenCampaign,
    session: AsyncSession,
) -> None:
    campaign = await open_campaign(school_class["school_id"])
    student = await make_student(client, student_payload)
    url = f"/api/public/students/{student['portal_token']}/order"

    empty = await client.put(url, json={"kit_lines": [], "item_lines": []})
    bad_size = await client.put(
        url,
        json=lines(
            products,
            campaign,
            kit_lines=[],
            item_lines=[{"product_id": str(products["blazer"].id), "size_label": "99", "qty": 1}],
        ),
    )
    bad_colour = await client.put(
        url,
        json=lines(
            products,
            campaign,
            kit_lines=[],
            item_lines=[
                {
                    "product_id": str(products["blazer"].id),
                    "size_label": "2",
                    "qty": 1,
                    "colour": "navy",
                }
            ],
        ),
    )

    assert empty.status_code == 422
    assert (
        bad_size.status_code == 422
        and "item_lines.0.size_label" in bad_size.json()["error"]["fields"]
    )
    assert bad_colour.status_code == 422
    assert (await session.scalars(select(Order))).all() == []


async def test_put_order_without_open_campaign_or_when_locked_is_409(
    client: AsyncClient,
    student_payload: Payload,
    school_class: dict[str, Any],
    products: dict[str, Any],
    open_campaign: OpenCampaign,
    session: AsyncSession,
) -> None:
    student = await make_student(client, student_payload)
    base = f"/api/public/students/{student['portal_token']}"
    body = {
        "kit_lines": [],
        "item_lines": [{"product_id": str(products["blazer"].id), "size_label": "2", "qty": 1}],
    }

    none_open = await client.put(f"{base}/order", json=body)
    assert none_open.status_code == 409 and none_open.json()["error"]["code"] == "campaign_locked"

    campaign = await open_campaign(school_class["school_id"])
    assert (await client.put(f"{base}/order", json=body)).status_code == 200
    campaign.status = "LOCKED"
    await session.commit()

    locked = await client.put(f"{base}/order", json=body)
    assert locked.status_code == 409 and locked.json()["error"]["code"] == "campaign_locked"
    view = (await client.get(f"{base}/ordering")).json()
    assert view["campaign"]["status"] == "LOCKED" and view["order"]["status"] == "SUBMITTED"
    assert len((await session.scalars(select(Order))).all()) == 1


async def test_ordering_bad_token_404(anon_client: AsyncClient) -> None:
    assert (await anon_client.get("/api/public/students/bad/ordering")).status_code == 404
    assert (
        await anon_client.put("/api/public/students/bad/order", json={"item_lines": []})
    ).status_code == 404


async def test_size_choice_endpoints_are_gone(
    client: AsyncClient, student_payload: Payload
) -> None:
    student = await make_student(client, student_payload)
    url = f"/api/public/students/{student['portal_token']}/size-choices/blazer"
    assert (await client.put(url, json={"size_label": "3"})).status_code in (404, 405)
    assert (await client.delete(url)).status_code in (404, 405)


async def test_deleted_student_token_404(client: AsyncClient, student_payload: Payload) -> None:
    student = await make_student(client, student_payload)
    await client.delete(f"/api/students/{student['id']}")
    assert (await client.get(f"/api/public/students/{student['portal_token']}")).status_code == 404


async def test_public_rate_limit(anon_client: AsyncClient) -> None:
    codes = {(await anon_client.get("/api/public/students/x")).status_code for _ in range(61)}
    assert codes == {404, 429}


async def test_put_order_rejects_a_colour_the_campaign_does_not_sell(
    client: AsyncClient,
    student_payload: Payload,
    school_class: dict[str, Any],
    products: dict[str, Any],
    open_campaign: OpenCampaign,
    session: AsyncSession,
) -> None:
    products["blazer"].colours = ["ghi", "navy"]
    await session.commit()
    campaign = await open_campaign(school_class["school_id"])
    student = await make_student(client, student_payload)
    url = f"/api/public/students/{student['portal_token']}/order"
    item = {"product_id": str(products["blazer"].id), "size_label": "2", "qty": 1}

    navy = await client.put(
        url, json=lines(products, campaign, item_lines=[item | {"colour": "navy"}])
    )
    ghi = await client.put(
        url, json=lines(products, campaign, item_lines=[item | {"colour": "ghi"}])
    )

    assert navy.status_code == 422 and "item_lines.0.colour" in navy.json()["error"]["fields"]
    assert ghi.status_code == 200


async def test_put_order_survives_a_concurrent_first_submit(
    client: AsyncClient,
    student_payload: Payload,
    school_class: dict[str, Any],
    products: dict[str, Any],
    open_campaign: OpenCampaign,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    campaign = await open_campaign(school_class["school_id"])
    student = await make_student(client, student_payload)
    url = f"/api/public/students/{student['portal_token']}/order"
    assert (await client.put(url, json=lines(products, campaign))).status_code == 200

    real = handler._order_of
    calls = 0

    async def stale_first(*args: Any) -> Any:
        nonlocal calls
        calls += 1
        return None if calls == 1 else await real(*args)

    monkeypatch.setattr(handler, "_order_of", stale_first)
    r = await client.put(url, json=lines(products, campaign, kit_lines=[]))

    assert r.status_code == 200, r.text
    assert r.json()["order"]["kit_lines"] == []


async def test_resubmit_refreshes_the_order_snapshot_from_the_student(
    client: AsyncClient,
    student_payload: Payload,
    school_class: dict[str, Any],
    products: dict[str, Any],
    open_campaign: OpenCampaign,
    session: AsyncSession,
) -> None:
    campaign = await open_campaign(school_class["school_id"])
    student = await make_student(client, student_payload)
    url = f"/api/public/students/{student['portal_token']}/order"
    assert (await client.put(url, json=lines(products, campaign))).status_code == 200

    row = await session.get(Student, uuid.UUID(student["id"]))
    assert row is not None
    row.gender = Gender.FEMALE
    row.parent_phone = "0987654321"
    await session.commit()
    assert (await client.put(url, json=lines(products, campaign))).status_code == 200

    order = (await session.scalars(select(Order).execution_options(populate_existing=True))).one()
    assert (order.gender, order.parent_phone) == ("FEMALE", "0987654321")
    updates = (
        await session.scalars(select(AuditLog).where(AuditLog.action == "order.update"))
    ).all()
    assert len(updates) == 1 and updates[0].after["gender"] == "FEMALE"
