import csv
import io
from collections import defaultdict
from collections.abc import Sequence
from datetime import date, datetime
from typing import Any

from openpyxl import Workbook
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.catalog.models import Product, School, SchoolClass
from app.features.students.fit_rules import derived_size
from app.features.students.models import Fit, FittingTrial, Student

Row = list[Any]
Dataset = tuple[list[str], list[Row]]

CSV_MEDIA_TYPE = "text/csv; charset=utf-8"
XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

STUDENT_HEADERS = [
    "Trường",
    "Khối",
    "Lớp",
    "Họ và tên",
    "Ngày sinh",
    "Giới tính",
    "Tuổi lúc đo",
    "Chiều cao (cm)",
    "Cân nặng (kg)",
    "Họ tên phụ huynh",
    "SĐT phụ huynh",
    "Email phụ huynh",
]
TRIAL_HEADERS = [
    "Giới tính",
    "Tuổi lúc đo",
    "Khối",
    "Chiều cao (cm)",
    "Cân nặng (kg)",
    "Sản phẩm",
    "Cỡ thử",
    "Mức vừa",
    "Ghi chú",
    "Cỡ gợi ý",
]


def age_at(dob: date, measured_at: datetime) -> float:
    """Age in years (one decimal) at the measurement date."""
    return round((measured_at.date() - dob).days / 365.25, 1)


def _plain(value: Any) -> Any:
    if isinstance(value, datetime | date):
        return value.isoformat()
    if hasattr(value, "is_finite"):
        return float(value)
    return getattr(value, "value", value)


async def _load(
    session: AsyncSession,
) -> tuple[list[Student], dict[Any, Product], dict[Any, School], dict[Any, SchoolClass]]:
    students = list(
        await session.scalars(
            select(Student).where(Student.deleted_at.is_(None)).order_by(Student.created_at)
        )
    )
    products = list(
        await session.scalars(select(Product).order_by(Product.created_at, Product.code))
    )
    schools = list(await session.scalars(select(School)))
    classes = list(await session.scalars(select(SchoolClass)))
    return (
        students,
        {p.id: p for p in products},
        {s.id: s for s in schools},
        {c.id: c for c in classes},
    )


async def _live_trials(session: AsyncSession) -> list[FittingTrial]:
    result = await session.scalars(
        select(FittingTrial)
        .join(Student, Student.id == FittingTrial.student_id)
        .where(FittingTrial.deleted_at.is_(None), Student.deleted_at.is_(None))
        .order_by(FittingTrial.tried_at, FittingTrial.created_at)
    )
    return list(result)


async def students_dataset(session: AsyncSession) -> Dataset:
    """One row per live student, with derived size per product and trial count."""
    students, products, schools, classes = await _load(session)
    trials = await _live_trials(session)
    active = [p for p in products.values() if p.active]
    fits: dict[tuple[Any, Any], list[str]] = defaultdict(list)
    counts: dict[Any, int] = defaultdict(int)
    for trial in trials:
        counts[trial.student_id] += 1
        if trial.fit == Fit.FITS:
            fits[(trial.student_id, trial.product_id)].append(trial.size_label)
    headers = [
        *STUDENT_HEADERS,
        *(f"Cỡ vừa suy ra - {p.name}" for p in active),
        "Số lần thử",
    ]
    rows: list[Row] = []
    for s in students:
        klass = classes[s.class_id]
        rows.append(
            [
                schools[s.school_id].name,
                klass.grade,
                klass.name,
                s.full_name,
                _plain(s.dob),
                _plain(s.gender),
                age_at(s.dob, s.measured_at),
                _plain(s.height_cm),
                _plain(s.weight_kg),
                s.parent_name,
                s.parent_phone,
                s.parent_email,
                *(derived_size(fits.get((s.id, p.id), []), p.sizes) for p in active),
                counts[s.id],
            ]
        )
    return headers, rows


async def trials_dataset(session: AsyncSession) -> Dataset:
    """One row per live trial with student features; no derived-size label."""
    students, products, _, classes = await _load(session)
    by_id = {s.id: s for s in students}
    rows: list[Row] = []
    for t in await _live_trials(session):
        s = by_id[t.student_id]
        rows.append(
            [
                _plain(s.gender),
                age_at(s.dob, s.measured_at),
                classes[s.class_id].grade,
                _plain(s.height_cm),
                _plain(s.weight_kg),
                products[t.product_id].name,
                t.size_label,
                _plain(t.fit),
                t.note,
                t.suggested_size_label,
            ]
        )
    return TRIAL_HEADERS, rows


def to_csv(headers: Sequence[str], rows: Sequence[Row]) -> bytes:
    """Encode as UTF-8 CSV with BOM so Excel keeps Vietnamese diacritics."""
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(headers)
    writer.writerows(rows)
    return buffer.getvalue().encode("utf-8-sig")


def to_xlsx(sheets: dict[str, Dataset]) -> bytes:
    """Encode datasets as one workbook, one sheet each."""
    workbook = Workbook()
    workbook.remove(workbook.active)
    for title, (headers, rows) in sheets.items():
        sheet = workbook.create_sheet(title)
        sheet.append(list(headers))
        for row in rows:
            sheet.append(row)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()
