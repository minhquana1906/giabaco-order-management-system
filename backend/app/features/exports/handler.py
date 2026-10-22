import csv
import io
import re
import uuid
from collections import defaultdict
from collections.abc import Sequence
from datetime import date, datetime
from typing import Any

from openpyxl import Workbook
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import order_pivot as pivot
from app.core.errors import ApiError
from app.core.names import name_key
from app.features.campaigns.models import OPEN, Campaign, school_products
from app.features.catalog.models import Product, School, SchoolClass
from app.features.orders.models import SUBMITTED, Order
from app.features.students.models import DataSource, FittingTrial, Student
from app.features.surveys.models import SurveyResponse

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
    "data_source",
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


async def _open_orders(session: AsyncSession) -> dict[Any, Order]:
    """The live SUBMITTED order of each student in an OPEN campaign."""
    found = await session.scalars(
        select(Order)
        .join(Campaign, Campaign.id == Order.campaign_id)
        .where(
            Campaign.status == OPEN,
            Order.status == SUBMITTED,
            Order.student_id.is_not(None),
            Order.deleted_at.is_(None),
        )
    )
    return {o.student_id: o for o in found}


def _order_cells(order: Order | None, product_id: Any) -> tuple[Any, Any]:
    lines = [line for line in order.lines if line.product_id == product_id] if order else []
    if not lines:
        return (None, None)
    return (", ".join(sorted({line.size_label for line in lines})), sum(line.qty for line in lines))


def _order_total(order: Order | None) -> int | None:
    if order is None or order.totals.has_unpriced:
        return None
    return order.totals.amount


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


async def _live_trials(session: AsyncSession, *, measured_only: bool = False) -> list[FittingTrial]:
    query = (
        select(FittingTrial)
        .join(Student, Student.id == FittingTrial.student_id)
        .where(FittingTrial.deleted_at.is_(None), Student.deleted_at.is_(None))
        .order_by(FittingTrial.tried_at, FittingTrial.created_at)
    )
    if measured_only:
        query = query.where(Student.data_source == DataSource.ADMIN_MEASURED)
    return list(await session.scalars(query))


def _sheet_title(name: str, taken: set[str]) -> str:
    base = re.sub(r"[\[\]:*?/\\]", " ", name).strip().strip("'") or "Trường"
    title, n = base[:31], 1
    while title.casefold() in taken:
        n += 1
        suffix = f" ({n})"
        title = base[: 31 - len(suffix)] + suffix
    taken.add(title.casefold())
    return title


def _student_dataset(
    students: Sequence[Student],
    products: Sequence[Product],
    schools: dict[Any, School],
    classes: dict[Any, SchoolClass],
    counts: dict[Any, int],
    orders: dict[Any, Order],
) -> Dataset:
    headers = [
        *STUDENT_HEADERS,
        *(h for p in products for h in (f"{p.name} - cỡ đặt", f"{p.name} - số lượng đặt")),
        "Tạm tính đơn (đ)",
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
                _plain(s.data_source),
                *(cell for p in products for cell in _order_cells(orders.get(s.id), p.id)),
                _order_total(orders.get(s.id)),
                counts[s.id],
            ]
        )
    return headers, rows


async def student_datasets(
    session: AsyncSession, school_id: uuid.UUID | None = None
) -> dict[str, Dataset]:
    """One dataset per school, each with only that school's profile products."""
    schools = list(await session.scalars(select(School).order_by(School.name, School.code)))
    if school_id is not None:
        schools = [s for s in schools if s.id == school_id]
        if not schools:
            raise ApiError(404, "not_found", "Không tìm thấy trường")
    students = list(
        await session.scalars(
            select(Student).where(Student.deleted_at.is_(None)).order_by(Student.created_at)
        )
    )
    classes = {c.id: c for c in await session.scalars(select(SchoolClass))}
    counts: dict[Any, int] = defaultdict(int)
    for trial in await _live_trials(session):
        counts[trial.student_id] += 1
    orders = await _open_orders(session)
    by_id = {s.id: s for s in schools}
    taken = {"lần thử"}
    return {
        _sheet_title(school.name, taken): _student_dataset(
            [s for s in students if s.school_id == school.id],
            await school_products(session, school.id),
            by_id,
            classes,
            counts,
            orders,
        )
        for school in schools
    }


async def students_dataset(session: AsyncSession, school_id: uuid.UUID | None = None) -> Dataset:
    """Single table: the school's own columns, or the union of every profile when unfiltered."""
    if school_id is not None:
        return next(iter((await student_datasets(session, school_id)).values()))
    schools = {
        s.id: s for s in await session.scalars(select(School).order_by(School.name, School.code))
    }
    products: dict[Any, Product] = {}
    for school in schools.values():
        for p in await school_products(session, school.id):
            products.setdefault(p.id, p)
    students, _, _, classes = await _load(session)
    counts: dict[Any, int] = defaultdict(int)
    for trial in await _live_trials(session):
        counts[trial.student_id] += 1
    return _student_dataset(
        students, list(products.values()), schools, classes, counts, await _open_orders(session)
    )


async def trials_dataset(session: AsyncSession) -> Dataset:
    """One row per live trial of an admin-measured student; no derived-size label."""
    students, products, _, classes = await _load(session)
    by_id = {s.id: s for s in students}
    rows: list[Row] = []
    for t in await _live_trials(session, measured_only=True):
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


SURVEY_HEADERS = [
    "Mã phiếu",
    "Thời điểm gửi",
    "Phiên bản phiếu",
    "Phiếu mới nhất",
    "Trường",
    "Tỉnh/Thành phố",
    "Phường/Xã",
    "Khu vực trường",
    "Lớp",
    "Họ tên",
    "Ngày sinh",
    "Giới tính",
    "SĐT Zalo",
    "Ngày đo",
    "Tuổi lúc đo",
    "Cách đo",
    "Chiều cao (cm)",
    "Cân nặng (kg)",
    "BMI",
    "Vòng ngực (cm)",
    "Vòng eo (cm)",
    "Vòng mông (cm)",
    "Đặc điểm hình thể",
    "Phom ưa thích",
    "Vấn đề năm trước",
    "Hình thức cung ứng",
]


async def surveys_dataset(session: AsyncSession) -> Dataset:
    """One row per survey response; `Phiếu mới nhất` marks the latest per child for dedup."""
    rank = (
        func.row_number()
        .over(
            partition_by=(
                SurveyResponse.parent_phone,
                name_key(SurveyResponse.child_full_name),
                SurveyResponse.dob,
            ),
            order_by=SurveyResponse.created_at.desc(),
        )
        .label("rank")
    )
    query = select(SurveyResponse, rank).order_by(
        name_key(SurveyResponse.school_name),
        SurveyResponse.class_name,
        SurveyResponse.created_at,
    )
    rows: list[Row] = []
    for r, position in await session.execute(query):
        height_m = float(r.height_cm) / 100
        rows.append(
            [
                str(r.id),
                _plain(r.created_at),
                r.form_version,
                position == 1,
                r.school_name,
                r.province,
                r.ward,
                r.school_area,
                r.class_name,
                r.child_full_name,
                _plain(r.dob),
                r.gender,
                r.parent_phone,
                _plain(r.measured_on),
                round((r.measured_on - r.dob).days / 365.25, 1),
                r.measure_method,
                _plain(r.height_cm),
                _plain(r.weight_kg),
                round(float(r.weight_kg) / (height_m * height_m), 1),
                _plain(r.chest_cm),
                _plain(r.waist_cm),
                _plain(r.hip_cm),
                ", ".join(r.body_traits),
                r.fit_preference,
                ", ".join(r.past_issues),
                r.supply_option,
            ]
        )
    return SURVEY_HEADERS, rows


GENDER_LABEL = {"MALE": "Nam", "FEMALE": "Nữ", None: ""}
CAMPAIGN_ORDER_HEADERS = ["Mã đơn", "Người nhận", "Phụ huynh", "Giới tính", "Lớp", "Cỡ chung"]
CAMPAIGN_ORDER_TAIL = ["Số bộ", "Thành tiền", "Ghi chú"]
PIVOT_HEADERS = ["Nhóm", "Tên", "Cỡ", "Nam", "Nữ", "Chưa rõ", "Tổng"]


async def campaign_orders_dataset(
    session: AsyncSession, campaign_id: uuid.UUID, submitted_until: date | None = None
) -> Dataset:
    """One row per submitted order: qty per campaign product, kit count and priced total."""
    campaign = await pivot.campaign_or_404(session, campaign_id)
    columns = [i.product_id for i in campaign.items]
    products = {
        p.id: p.name for p in await session.scalars(select(Product).where(Product.id.in_(columns)))
    }
    orders = await session.scalars(
        pivot.submitted_orders(campaign_id, submitted_until).order_by(Order.code)
    )
    rows: list[Row] = []
    for order in orders:
        qty: dict[uuid.UUID, int] = defaultdict(int)
        for line in order.lines:
            qty[line.product_id] += line.qty
        rows.append(
            [
                order.code,
                order.recipient_name,
                order.parent_name,
                GENDER_LABEL[order.gender],
                order.class_label,
                order.default_size,
                *(qty.get(product_id) for product_id in columns),
                sum(k.qty for k in order.kit_lines),
                None if order.totals.has_unpriced else order.totals.amount,
                order.note,
            ]
        )
    headers = [*CAMPAIGN_ORDER_HEADERS, *(products[p] for p in columns), *CAMPAIGN_ORDER_TAIL]
    return headers, rows


async def campaign_pivot_dataset(
    session: AsyncSession, campaign_id: uuid.UUID, submitted_until: date | None = None
) -> Dataset:
    """Both pivot groups (by product, by kit) stacked, one line per size plus a total line."""
    rows: list[Row] = []
    groups: list[tuple[pivot.Group, str]] = [("product", "Món"), ("kit", "Bộ")]
    for group, label in groups:
        result = await pivot.campaign_pivot(
            session, campaign_id, "qty", group, submitted_until=submitted_until
        )
        for block in result.blocks:
            rows += [
                [label, block.name, r.size_label, r.male, r.female, r.unknown, r.total]
                for r in block.rows
            ]
            t = block.totals
            rows.append([label, block.name, "Tổng", t.male, t.female, t.unknown, t.total])
    return PIVOT_HEADERS, rows


_FORMULA_TRIGGERS = ("=", "+", "-", "@", "\t", "\r")


def _safe(row: Sequence[Any]) -> Row:
    """Prefix text a spreadsheet would run as a formula; user-typed names and notes reach cells."""
    return [
        f"'{cell}" if isinstance(cell, str) and cell.startswith(_FORMULA_TRIGGERS) else cell
        for cell in row
    ]


def to_csv(headers: Sequence[str], rows: Sequence[Row]) -> bytes:
    """Encode as UTF-8 CSV with BOM so Excel keeps Vietnamese diacritics."""
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(_safe(headers))
    writer.writerows(_safe(row) for row in rows)
    return buffer.getvalue().encode("utf-8-sig")


def to_xlsx(sheets: dict[str, Dataset]) -> bytes:
    """Encode datasets as one workbook, one sheet each."""
    workbook = Workbook()
    if sheets:
        workbook.remove(workbook.active)
    for title, (headers, rows) in sheets.items():
        sheet = workbook.create_sheet(title)
        sheet.append(_safe(headers))
        for row in rows:
            sheet.append(_safe(row))
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()
