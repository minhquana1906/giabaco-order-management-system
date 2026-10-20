from collections.abc import Callable
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.parent_accounts.models import LinkOrigin, ParentAccount, ParentStudentLink
from app.features.students.models import DataSource, Student


async def _rejected(session: AsyncSession, *rows: object) -> bool:
    session.add_all(rows)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        return True
    return False


async def test_admin_student_defaults_to_admin_measured(
    client: AsyncClient, session: AsyncSession, student_payload: Callable[..., dict[str, Any]]
) -> None:
    created = (await client.post("/api/students", json=student_payload())).json()
    student = await session.scalar(select(Student).where(Student.full_name == created["full_name"]))
    assert student is not None and student.data_source is DataSource.ADMIN_MEASURED


@pytest.mark.parametrize(
    "rows",
    [
        lambda: [ParentAccount(full_name="A", password_hash="h")],
        lambda: [
            ParentAccount(full_name="A", email="a@x.vn", password_hash="h"),
            ParentAccount(full_name="B", email="a@x.vn", password_hash="h"),
        ],
        lambda: [
            ParentAccount(full_name="A", phone="0912345678", password_hash="h"),
            ParentAccount(full_name="B", phone="0912345678", password_hash="h"),
        ],
    ],
)
async def test_parent_account_identifier_rules(
    session: AsyncSession, rows: Callable[[], list[ParentAccount]]
) -> None:
    assert await _rejected(session, *rows())


async def test_link_is_unique_per_parent_and_student(
    client: AsyncClient, session: AsyncSession, student_payload: Callable[..., dict[str, Any]]
) -> None:
    created = (await client.post("/api/students", json=student_payload())).json()
    parent = ParentAccount(full_name="A", email="a@x.vn", password_hash="h")
    session.add(parent)
    await session.commit()
    link = ParentStudentLink(
        parent_id=parent.id, student_id=created["id"], origin=LinkOrigin.CLAIMED
    )
    assert not await _rejected(session, link)
    again = ParentStudentLink(
        parent_id=parent.id, student_id=created["id"], origin=LinkOrigin.CREATED
    )
    assert await _rejected(session, again)
