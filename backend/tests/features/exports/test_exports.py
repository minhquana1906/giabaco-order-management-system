import csv
import io
from typing import Any

import pytest
from openpyxl import load_workbook

from app.features.exports.handler import STUDENT_HEADERS, TRIAL_HEADERS
from app.features.parent_portal.models import ParentSizeChoice
from app.features.students.models import DataSource, Gender

URLS = [
    "/api/export/students.csv",
    "/api/export/students.xlsx",
    "/api/export/trials.csv",
    "/api/export/trials.xlsx",
    "/api/export/all.xlsx",
]


@pytest.fixture
async def seeded(make_student: Any) -> None:
    await make_student(
        "Nguyễn Minh Khang",
        [
            ("blazer", "2", "FITS", "3"),
            ("blazer", "4", "FITS", "3"),
            ("gile", "2", "TOO_TIGHT", "3"),
        ],
        note="Rộng vai, cần sửa",
    )
    await make_student("Lê Thị Ánh", [("blazer", "5", "TOO_LOOSE", None)], gender=Gender.FEMALE)
    await make_student("Đã Xóa", [("blazer", "3", "FITS", "3")], deleted=True)
    await make_student("Trần Văn Bình", [], deleted_trials=[("gile", "3", "FITS", "3")])


def read_csv(content: bytes) -> list[list[str]]:
    assert content.startswith(b"\xef\xbb\xbf")
    return list(csv.reader(io.StringIO(content.decode("utf-8-sig"))))


def read_sheet(content: bytes, name: str) -> list[list[Any]]:
    sheet = load_workbook(io.BytesIO(content))[name]
    return [list(row) for row in sheet.iter_rows(values_only=True)]


@pytest.mark.parametrize("url", URLS)
async def test_exports_require_session(anon_client: Any, url: str) -> None:
    assert (await anon_client.get(url)).status_code == 401


@pytest.mark.parametrize("url", URLS)
async def test_exports_are_attachments(client: Any, seeded: None, url: str) -> None:
    response = await client.get(url)

    assert response.status_code == 200
    filename = url.rsplit("/", 1)[1]
    assert response.headers["content-disposition"].startswith("attachment;")
    assert filename in response.headers["content-disposition"]


async def test_students_csv(client: Any, seeded: None) -> None:
    rows = read_csv((await client.get("/api/export/students.csv")).content)

    header, body = rows[0], rows[1:]
    assert header[: len(STUDENT_HEADERS)] == STUDENT_HEADERS
    assert header[len(STUDENT_HEADERS) :] == [
        "Cỡ vừa suy ra - Áo Blazer (Vest)",
        "Cỡ vừa suy ra - Áo Gile",
        "Áo Blazer (Vest) - cỡ phụ huynh chọn",
        "Áo Blazer (Vest) - thời điểm chọn",
        "Áo Gile - cỡ phụ huynh chọn",
        "Áo Gile - thời điểm chọn",
        "Số lần thử",
    ]
    assert len(body) == 3
    names = {r[header.index("Họ và tên")] for r in body}
    assert names == {"Nguyễn Minh Khang", "Lê Thị Ánh", "Trần Văn Bình"}
    khang = next(r for r in body if r[3] == "Nguyễn Minh Khang")
    assert khang[header.index("Tuổi lúc đo")] == "8.0"
    assert khang[header.index("SĐT phụ huynh")] == "0912345678"
    assert khang[header.index("Cỡ vừa suy ra - Áo Blazer (Vest)")] == "4"
    assert khang[header.index("Cỡ vừa suy ra - Áo Gile")] == ""
    assert khang[header.index("Số lần thử")] == "3"
    binh = next(r for r in body if r[3] == "Trần Văn Bình")
    assert binh[header.index("Số lần thử")] == "0"


async def test_trials_csv_is_raw_dataset(client: Any, seeded: None) -> None:
    rows = read_csv((await client.get("/api/export/trials.csv")).content)

    header, body = rows[0], rows[1:]
    assert header == TRIAL_HEADERS
    assert not any("suy ra" in column for column in header)
    assert len(body) == 4
    assert {r[header.index("Mức vừa")] for r in body} == {"FITS", "TOO_TIGHT", "TOO_LOOSE"}
    assert [r[header.index("Cỡ thử")] for r in body].count("3") == 0
    notes = [r[header.index("Ghi chú")] for r in body]
    assert "Rộng vai, cần sửa" in notes
    girl = next(r for r in body if r[header.index("Cỡ thử")] == "5")
    assert girl[header.index("Giới tính")] == "FEMALE"
    assert girl[header.index("Khối")] != ""
    assert girl[header.index("Cỡ gợi ý")] == ""
    boy = next(
        r for r in body if r[header.index("Cỡ thử")] == "2" and r[header.index("Sản phẩm")] != ""
    )
    assert boy[header.index("Cỡ gợi ý")] == "3"


async def test_xlsx_matches_csv(client: Any, seeded: None) -> None:
    students_csv = read_csv((await client.get("/api/export/students.csv")).content)
    students_xlsx = read_sheet((await client.get("/api/export/students.xlsx")).content, "Học sinh")
    trials_csv = read_csv((await client.get("/api/export/trials.csv")).content)
    trials_xlsx = read_sheet((await client.get("/api/export/trials.xlsx")).content, "Lần thử")

    assert students_xlsx[0] == students_csv[0]
    assert len(students_xlsx) == len(students_csv) == 4
    assert {r[3] for r in students_xlsx[1:]} == {r[3] for r in students_csv[1:]}
    assert trials_xlsx[0] == trials_csv[0] == TRIAL_HEADERS
    assert len(trials_xlsx) == len(trials_csv) == 5


async def test_all_xlsx_has_both_sheets(client: Any, seeded: None) -> None:
    content = (await client.get("/api/export/all.xlsx")).content

    assert load_workbook(io.BytesIO(content)).sheetnames == ["Học sinh", "Lần thử"]
    assert len(read_sheet(content, "Học sinh")) == 4
    assert len(read_sheet(content, "Lần thử")) == 5


async def test_empty_database_exports_headers_only(client: Any) -> None:
    rows = read_csv((await client.get("/api/export/trials.csv")).content)

    assert rows == [TRIAL_HEADERS]


async def test_students_export_has_data_source_and_parent_choices(
    client: Any, make_student: Any, session: Any, products: Any
) -> None:
    measured = await make_student("Nguyễn Minh Khang", [("blazer", "2", "FITS", "3")])
    declared = await make_student("Lê Tự Khai", data_source=DataSource.PARENT_DECLARED)
    gone = await make_student("Đã Xóa", deleted=True)
    chosen = [(measured, "blazer", "3"), (declared, "blazer", "5"), (declared, "gile", "2")]
    for student, code, size in [*chosen, (gone, "blazer", "1")]:
        session.add(
            ParentSizeChoice(student_id=student.id, product_id=products[code].id, size_label=size)
        )
    await session.commit()

    rows = read_csv((await client.get("/api/export/students.csv")).content)

    header, body = rows[0], rows[1:]
    assert {r[3] for r in body} == {"Nguyễn Minh Khang", "Lê Tự Khai"}
    by_name = {r[3]: r for r in body}
    for name, source in [
        ("Nguyễn Minh Khang", "ADMIN_MEASURED"),
        ("Lê Tự Khai", "PARENT_DECLARED"),
    ]:
        assert by_name[name][header.index("data_source")] == source
    blazer = header.index("Áo Blazer (Vest) - cỡ phụ huynh chọn")
    gile = header.index("Áo Gile - cỡ phụ huynh chọn")
    assert by_name["Nguyễn Minh Khang"][blazer] == "3" and by_name["Nguyễn Minh Khang"][gile] == ""
    assert by_name["Lê Tự Khai"][blazer] == "5" and by_name["Lê Tự Khai"][gile] == "2"
    assert by_name["Lê Tự Khai"][blazer + 1].startswith("20")
    assert by_name["Nguyễn Minh Khang"][gile + 1] == ""
    assert by_name["Lê Tự Khai"][header.index("Số lần thử")] == "0"


async def test_trials_export_excludes_parent_declared_students(
    client: Any, make_student: Any
) -> None:
    await make_student("Nguyễn Minh Khang", [("blazer", "2", "FITS", "3")])
    await make_student(
        "Lê Tự Khai", [("blazer", "4", "FITS", "4")], data_source=DataSource.PARENT_DECLARED
    )

    csv_rows = read_csv((await client.get("/api/export/trials.csv")).content)
    xlsx_rows = read_sheet((await client.get("/api/export/trials.xlsx")).content, "Lần thử")
    all_rows = read_sheet((await client.get("/api/export/all.xlsx")).content, "Lần thử")

    assert len(csv_rows) == len(xlsx_rows) == len(all_rows) == 2
    assert csv_rows[1][csv_rows[0].index("Cỡ thử")] == "2"
