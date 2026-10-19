import uuid
from collections import defaultdict

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ApiError
from app.features.catalog.models import Product, School, SchoolClass
from app.features.parent_portal.models import ParentSizeChoice
from app.features.stats.schemas import (
    ClassMatrix,
    MatrixRow,
    MatrixTotals,
    OrderProduct,
    Orders,
    OrderSize,
    Overview,
    ProductUsage,
    SizeCount,
    SizeDistribution,
    SizeGuideAccuracy,
)
from app.features.students.fit_rules import derived_size
from app.features.students.models import DataSource, Fit, FittingTrial, Student


def _percent(count: int, total: int) -> float:
    return round(count * 100 / total, 1) if total else 0.0


async def _active_products(session: AsyncSession) -> list[Product]:
    result = await session.scalars(
        select(Product).where(Product.active.is_(True)).order_by(Product.created_at, Product.code)
    )
    return list(result)


async def _product_by_code(session: AsyncSession, code: str) -> Product:
    product = await session.scalar(select(Product).where(Product.code == code))
    if product is None:
        raise ApiError(404, "not_found", "Không tìm thấy sản phẩm.")
    return product


async def _students(session: AsyncSession, school_id: uuid.UUID | None) -> list[Student]:
    """Live students measured by an admin: parent-declared records are not measurement data."""
    query = select(Student).where(
        Student.deleted_at.is_(None), Student.data_source == DataSource.ADMIN_MEASURED
    )
    if school_id is not None:
        query = query.where(Student.school_id == school_id)
    return list(await session.scalars(query))


async def _trials(session: AsyncSession, student_ids: set[uuid.UUID]) -> list[FittingTrial]:
    if not student_ids:
        return []
    result = await session.scalars(
        select(FittingTrial).where(
            FittingTrial.deleted_at.is_(None), FittingTrial.student_id.in_(student_ids)
        )
    )
    return list(result)


def _derived_by_student(trials: list[FittingTrial], product: Product) -> dict[uuid.UUID, str]:
    fits: dict[uuid.UUID, list[str]] = defaultdict(list)
    for trial in trials:
        if trial.product_id == product.id and trial.fit == Fit.FITS:
            fits[trial.student_id].append(trial.size_label)
    derived = {sid: derived_size(labels, product.sizes) for sid, labels in fits.items()}
    return {sid: size for sid, size in derived.items() if size is not None}


def _suggested_by_student(trials: list[FittingTrial], product: Product) -> dict[uuid.UUID, str]:
    latest: dict[uuid.UUID, FittingTrial] = {}
    for trial in trials:
        if trial.product_id != product.id or trial.fit != Fit.FITS:
            continue
        current = latest.get(trial.student_id)
        if current is None or trial.tried_at > current.tried_at:
            latest[trial.student_id] = trial
    return {
        sid: trial.suggested_size_label
        for sid, trial in latest.items()
        if trial.suggested_size_label is not None
    }


def _accuracy(trials: list[FittingTrial], product: Product) -> SizeGuideAccuracy:
    derived = _derived_by_student(trials, product)
    suggested = _suggested_by_student(trials, product)
    position = {label: i for i, label in enumerate(product.sizes)}
    exact = one = two_plus = 0
    for sid, size in derived.items():
        guess = suggested.get(sid)
        if guess is None or guess not in position:
            continue
        distance = abs(position[size] - position[guess])
        if distance == 0:
            exact += 1
        elif distance == 1:
            one += 1
        else:
            two_plus += 1
    evaluated = exact + one + two_plus
    return SizeGuideAccuracy(
        product_code=product.code,
        product_name=product.name,
        evaluated=evaluated,
        exact=exact,
        off_by_one=one,
        off_by_two_plus=two_plus,
        exact_rate=exact / evaluated if evaluated else None,
    )


async def overview(session: AsyncSession, school_id: uuid.UUID | None) -> Overview:
    """Aggregate headline counts and size-guide accuracy."""
    students = await _students(session, school_id)
    trials = await _trials(session, {s.id for s in students})
    products = await _active_products(session)
    by_product = []
    for product in products:
        product_trials = [t for t in trials if t.product_id == product.id]
        by_product.append(
            ProductUsage(
                product_code=product.code,
                product_name=product.name,
                students_tried=len({t.student_id for t in product_trials}),
                trials=len(product_trials),
            )
        )
    return Overview(
        total_students=len(students),
        students_with_trials=len({t.student_id for t in trials}),
        total_trials=len(trials),
        students_with_notes=len({t.student_id for t in trials if t.note and t.note.strip()}),
        by_product=by_product,
        size_guide_accuracy=[_accuracy(trials, p) for p in products],
    )


async def size_distribution(
    session: AsyncSession, product_code: str, school_id: uuid.UUID | None
) -> SizeDistribution:
    """Count students per derived size, with an unknown bucket."""
    product = await _product_by_code(session, product_code)
    students = await _students(session, school_id)
    trials = await _trials(session, {s.id for s in students})
    derived = _derived_by_student(trials, product)
    total = len(students)
    counts: dict[str | None, int] = dict.fromkeys([*product.sizes, None], 0)
    for student in students:
        counts[derived.get(student.id)] += 1
    return SizeDistribution(
        product_code=product.code,
        total=total,
        sizes=[
            SizeCount(size_label=label, count=n, percent=_percent(n, total))
            for label, n in counts.items()
        ],
    )


async def class_matrix(
    session: AsyncSession, product_code: str, school_id: uuid.UUID
) -> ClassMatrix:
    """Class by derived size matrix for one school, including empty classes."""
    product = await _product_by_code(session, product_code)
    if await session.get(School, school_id) is None:
        raise ApiError(404, "not_found", "Không tìm thấy trường.")
    classes = list(
        await session.scalars(
            select(SchoolClass)
            .where(SchoolClass.school_id == school_id)
            .order_by(SchoolClass.grade, SchoolClass.name)
        )
    )
    students = await _students(session, school_id)
    derived = _derived_by_student(await _trials(session, {s.id for s in students}), product)
    rows = {
        c.id: MatrixRow(
            class_id=str(c.id),
            class_name=c.name,
            grade=c.grade,
            counts=dict.fromkeys(product.sizes, 0),
            unknown=0,
            total=0,
        )
        for c in classes
    }
    totals = MatrixTotals(counts=dict.fromkeys(product.sizes, 0), unknown=0, total=0)
    for student in students:
        row = rows[student.class_id]
        size = derived.get(student.id)
        for bucket in (row, totals):
            if size is None:
                bucket.unknown += 1
            else:
                bucket.counts[size] += 1
            bucket.total += 1
    return ClassMatrix(
        product_code=product.code,
        sizes=list(product.sizes),
        rows=[rows[c.id] for c in classes],
        totals=totals,
    )


async def orders(session: AsyncSession, school_id: uuid.UUID | None) -> Orders:
    """Parent size choices per product and size, for live students of any data source."""
    query = (
        select(ParentSizeChoice.product_id, ParentSizeChoice.size_label, func.count())
        .join(Student, Student.id == ParentSizeChoice.student_id)
        .where(Student.deleted_at.is_(None))
        .group_by(ParentSizeChoice.product_id, ParentSizeChoice.size_label)
    )
    if school_id is not None:
        query = query.where(Student.school_id == school_id)
    counts = {(pid, label): n for pid, label, n in await session.execute(query)}
    products = []
    for product in await _active_products(session):
        sizes = [
            OrderSize(size_label=s, count=counts.get((product.id, s), 0)) for s in product.sizes
        ]
        products.append(
            OrderProduct(
                product_code=product.code,
                product_name=product.name,
                sizes=sizes,
                total=sum(s.count for s in sizes),
            )
        )
    return Orders(products=products)
