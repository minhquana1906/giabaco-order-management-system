import secrets
import uuid
from datetime import date
from typing import Any

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.names import name_key
from app.features.students.models import Gender, Student


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


async def test_name_key_matches_stored_students_whatever_the_whitespace(
    session: AsyncSession, school_class: dict[str, Any]
) -> None:
    stored = {
        "clean": "Nguyễn Văn An",
        "dirty": "\t Nguyễn \t Văn\u00a0\u00a0An \n",
        "nbsp_edges": "\u00a0Nguyễn Văn An\u00a0",
        "stroke": "Đặng Thị Đào",
        "longer": "Nguyễn Văn Anh",
    }
    ids: dict[str, uuid.UUID] = {}
    for label, full_name in stored.items():
        student = Student(
            school_id=uuid.UUID(school_class["school_id"]),
            class_id=uuid.UUID(school_class["class_id"]),
            full_name=full_name,
            dob=date(2018, 3, 14),
            gender=Gender.MALE,
            height_cm=126.5,
            weight_kg=24,
            portal_token=secrets.token_urlsafe(16),
        )
        session.add(student)
        await session.flush()
        ids[label] = student.id
    await session.commit()

    async def matching(typed: str) -> set[uuid.UUID]:
        query = select(Student.id).where(name_key(Student.full_name) == name_key(typed))
        return set(await session.scalars(query))

    assert await matching("nguyen van an") == {ids["clean"], ids["dirty"], ids["nbsp_edges"]}
    assert await matching(" NGUYỄN\tVĂN\u00a0AN\n") == {
        ids["clean"],
        ids["dirty"],
        ids["nbsp_edges"],
    }
    assert await matching("dang thi dao") == {ids["stroke"]}
    assert await matching("ĐẶNG THỊ ĐÀO") == {ids["stroke"]}
