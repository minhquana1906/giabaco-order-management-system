import csv
import io
from datetime import date, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.exports.handler import SURVEY_HEADERS

URL = "/api/public/surveys"


def survey_body(**overrides: Any) -> dict[str, Any]:
    body = {
        "school_name": " Tiểu học  Lê Quý Đôn ",
        "province": "Hà Nội",
        "ward": "Phường Ba Đình",
        "class_name": "2A1",
        "child_full_name": "  Trần   Bảo Ngọc ",
        "dob": "2018-03-04",
        "gender": "FEMALE",
        "parent_phone": "+84 912 345 678",
        "measured_on": date.today().isoformat(),
        "measure_method": "TAPE_TODAY",
        "height_cm": 128.5,
        "weight_kg": 26,
        "chest_cm": 62,
        "waist_cm": 55,
        "body_traits": ["TALL_SLIM"],
        "fit_preference": "REGULAR",
        "past_issues": [],
        "supply_option": "STANDARD",
    }
    return {**body, **overrides}


async def test_submissions_append_and_export_flags_latest_per_child(
    client: AsyncClient, anon_client: AsyncClient
) -> None:
    assert (await anon_client.post(URL, json=survey_body())).status_code == 201
    # Same child with different spacing/case/accents: a new row that becomes the latest one.
    again = survey_body(
        school_name="tieu hoc le quy don", child_full_name="tran bao ngoc", height_cm=129
    )
    assert (await anon_client.post(URL, json=again)).status_code == 201

    r = await client.get("/api/export/surveys.csv")
    rows = list(csv.DictReader(io.StringIO(r.content.decode("utf-8-sig"))))
    assert list(rows[0]) == SURVEY_HEADERS
    latest = {row["Chiều cao (cm)"]: row["Phiếu mới nhất"] for row in rows}
    assert latest == {"128.5": "False", "129.0": "True"}
    assert rows[0]["Trường"] == "Tiểu học Lê Quý Đôn"
    assert (rows[0]["Phường/Xã"], rows[0]["Khu vực trường"]) == ("Phường Ba Đình", "URBAN")
    assert rows[0]["Họ tên"] == "Trần Bảo Ngọc"
    assert rows[0]["SĐT Zalo"] == "0912345678"
    assert rows[0]["Vòng mông (cm)"] == ""


async def test_export_requires_admin(anon_client: AsyncClient) -> None:
    assert (await anon_client.get("/api/export/surveys.csv")).status_code == 401


@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"school_name": "   "}, "school_name"),
        ({"ward": " "}, "ward"),
        ({"province": ""}, "province"),
        ({"measured_on": (date.today() - timedelta(days=181)).isoformat()}, "measured_on"),
        ({"measured_on": (date.today() + timedelta(days=2)).isoformat()}, "measured_on"),
        ({"height_cm": 1.3}, "height_cm"),
        ({"chest_cm": 300}, "chest_cm"),
        ({"body_traits": ["NORMAL", "NORMAL"]}, "body_traits"),
    ],
)
async def test_rejects_invalid_input(
    anon_client: AsyncClient, overrides: dict[str, Any], field: str
) -> None:
    r = await anon_client.post(URL, json=survey_body(**overrides))
    assert r.status_code == 422
    assert field in r.json()["error"]["fields"]


async def test_responses_are_immutable_but_deletable(
    anon_client: AsyncClient, session: AsyncSession
) -> None:
    assert (await anon_client.post(URL, json=survey_body())).status_code == 201
    with pytest.raises(DBAPIError, match="immutable"):
        await session.execute(text("UPDATE survey_responses SET height_cm = 100"))
    await session.rollback()
    assert (await session.execute(text("DELETE FROM survey_responses"))).rowcount == 1


async def test_overview_counts_responses_and_dedups_children(
    client: AsyncClient, anon_client: AsyncClient
) -> None:
    await anon_client.post(URL, json=survey_body())
    await anon_client.post(
        URL, json=survey_body(school_name="tieu hoc le quy don", child_full_name="tran bao ngoc")
    )
    await anon_client.post(
        URL,
        json=survey_body(
            school_name="Trường Làng", ward="Xã Đông Anh", child_full_name="Lê An", hip_cm=70
        ),
    )

    body = (await client.get("/api/stats/surveys")).json()
    assert (body["total_responses"], body["unique_children"], body["with_all_girths"]) == (3, 2, 1)
    assert body["by_area"] == {"URBAN": 2, "RURAL": 1}
    assert [(s["school_name"], s["responses"]) for s in body["schools"]][0][1] == 2
    assert len(body["schools"]) == 2
