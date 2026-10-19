import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.names import name_key
from app.features.students.models import Student


@pytest.mark.parametrize(
    ("a", "b"),
    [
        ("Nguyễn Văn An", "  nguyen   VAN an "),
        ("Đặng Thị Đào", "dang thi dao"),
        ("Nguyễn Văn An", "Nguye\u0302\u0303n Va\u0306n An"),
    ],
)
async def test_name_key_matches_variants(session: AsyncSession, a: str, b: str) -> None:
    assert await session.scalar(select(name_key(a) == name_key(b))) is True


async def test_name_key_keeps_different_names_apart(session: AsyncSession) -> None:
    assert (
        await session.scalar(select(name_key("Nguyễn Văn An") == name_key("Nguyễn Văn Anh")))
        is False
    )


async def test_name_key_accepts_orm_columns(session: AsyncSession) -> None:
    stmt = select(name_key(Student.full_name)).where(name_key(Student.full_name) == name_key("x"))
    assert (await session.execute(stmt)).all() == []
