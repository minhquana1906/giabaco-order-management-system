import os
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from pathlib import Path
from typing import Any

import psycopg
import pytest
import pytest_asyncio
from alembic import command
from alembic.config import Config
from argon2 import PasswordHasher
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

TEST_DB_URL = "postgresql+psycopg://guniform:guniform_test@127.0.0.1:55433/guniform_test"
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "test-password"
BACKEND_DIR = Path(__file__).resolve().parent.parent

os.environ.update(
    DATABASE_URL=TEST_DB_URL,
    SESSION_SECRET="test-secret",
    ADMIN_USERNAME=ADMIN_USERNAME,
    ADMIN_PASSWORD_HASH=PasswordHasher().hash(ADMIN_PASSWORD),
    PUBLIC_BASE_URL="http://testserver",
    COOKIE_SECURE="false",
)

from app.core.db import SessionLocal  # noqa: E402
from app.core.security import (  # noqa: E402
    login_limiter,
    parent_auth_limiter,
    parent_match_limiter,
    public_limiter,
)
from app.features.catalog.models import Product  # noqa: E402
from app.features.catalog.seed import seed_catalog  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def migrated_db() -> None:
    dsn = TEST_DB_URL.replace("+psycopg", "")
    with psycopg.connect(dsn, autocommit=True) as conn:
        conn.execute("DROP SCHEMA public CASCADE")
        conn.execute("CREATE SCHEMA public")
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    command.upgrade(cfg, "head")


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _seeded(migrated_db: None) -> None:
    async with SessionLocal() as s:
        await seed_catalog(s, BACKEND_DIR / "config" / "catalog.seed.yaml")


@pytest_asyncio.fixture(autouse=True)
async def _clean() -> AsyncIterator[None]:
    login_limiter.reset()
    public_limiter.reset()
    parent_auth_limiter.reset()
    parent_match_limiter.reset()
    yield
    async with SessionLocal() as s:
        await s.execute(
            text(
                "TRUNCATE audit_logs, parent_student_links, parent_accounts, parent_size_choices, "
                "fitting_trials, students, school_classes, schools"
            )
        )
        await s.commit()


@pytest_asyncio.fixture
async def session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as s:
        yield s


@pytest_asyncio.fixture
async def anon_client() -> AsyncIterator[AsyncClient]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def client(anon_client: AsyncClient) -> AsyncClient:
    r = await anon_client.post(
        "/api/auth/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
    )
    assert r.status_code == 200
    return anon_client


class ParentClient(AsyncClient):
    """Client with its own cookie jar, signed in as one parent account."""

    parent_id: str


MakeParent = Callable[..., Awaitable[ParentClient]]
Payload = Callable[..., dict[str, Any]]
CHILDREN = "/api/parent/children"


def child_body(school_class: dict[str, Any], **overrides: Any) -> dict[str, Any]:
    """Body of a self-declared child, distinct from the `student_payload` identity."""
    return {
        "school_id": school_class["school_id"],
        "class_id": school_class["class_id"],
        "full_name": "Lê Minh Anh",
        "dob": "2017-09-01",
        "gender": "FEMALE",
        "height_cm": 128.5,
        "weight_kg": 25.0,
        "parent_phone": "0912345678",
        **overrides,
    }


async def declare_child(
    parent: ParentClient, school_class: dict[str, Any], **overrides: Any
) -> dict[str, Any]:
    r = await parent.post(CHILDREN, json=child_body(school_class, **overrides))
    assert r.status_code == 201, r.text
    return r.json()  # type: ignore[no-any-return]


def claim_key(school_class: dict[str, Any], **overrides: Any) -> dict[str, Any]:
    """Lookup/claim key of the child `student_payload` creates."""
    return {
        "school_id": school_class["school_id"],
        "full_name": "Nguyễn Minh Khang",
        "dob": "2018-03-14",
        **overrides,
    }


async def claimed_student(
    admin: AsyncClient,
    parent: ParentClient,
    payload: Payload,
    school_class: dict[str, Any],
    **overrides: Any,
) -> dict[str, Any]:
    """An admin-measured student the parent has claimed."""
    created = (await admin.post("/api/students", json=payload(**overrides))).json()
    claim = await parent.post(f"{CHILDREN}/claim", json=claim_key(school_class))
    assert claim.status_code == 200, claim.text
    return created  # type: ignore[no-any-return]


def register_body(**overrides: Any) -> dict[str, Any]:
    """Parent registration body; the email is mixed case so normalization shows up."""
    return {
        "full_name": "Trần Thị Hoa",
        "email": "Hoa.Tran@Example.com",
        "password": "mat-khau-123",
        **overrides,
    }


async def count_rows(session: AsyncSession, model: Any) -> int:
    return int(await session.scalar(select(func.count()).select_from(model)) or 0)


@pytest_asyncio.fixture
async def make_parent() -> AsyncIterator[MakeParent]:
    clients: list[ParentClient] = []

    async def make(
        *,
        email: str | None = None,
        phone: str | None = None,
        full_name: str = "Phụ Huynh",
        password: str = "mat-khau-123",
    ) -> ParentClient:
        parent = ParentClient(transport=ASGITransport(app=app), base_url="http://test")
        clients.append(parent)
        if email is None and phone is None:
            email = f"{uuid.uuid4().hex[:10]}@example.com"
        r = await parent.post(
            "/api/parent/auth/register",
            json={"full_name": full_name, "email": email, "phone": phone, "password": password},
        )
        assert r.status_code == 201, r.text
        parent.parent_id = r.json()["id"]
        return parent

    yield make
    for parent in clients:
        await parent.aclose()


@pytest_asyncio.fixture
async def products(session: AsyncSession) -> dict[str, Product]:
    return {p.code: p for p in (await session.scalars(select(Product))).all()}


@pytest_asyncio.fixture
async def school_class(client: AsyncClient) -> dict[str, Any]:
    code = uuid.uuid4().hex[:6]
    school = (await client.post("/api/schools", json={"name": "Trường A", "code": code})).json()
    cls = (
        await client.post(f"/api/schools/{school['id']}/classes", json={"grade": 2, "name": "2A1"})
    ).json()
    return {"school_id": school["id"], "class_id": cls["id"], "grade": 2}


@pytest.fixture
def student_payload(school_class: dict[str, Any]) -> Callable[..., dict[str, Any]]:
    def make(**overrides: Any) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "school_id": school_class["school_id"],
            "class_id": school_class["class_id"],
            "full_name": "Nguyễn Minh Khang",
            "dob": "2018-03-14",
            "gender": "MALE",
            "height_cm": 126.5,
            "weight_kg": 24.0,
            "parent_name": None,
            "parent_phone": "0912345678",
            "parent_email": None,
            "trials": [],
            "force": False,
        }
        payload.update(overrides)
        return payload

    return make
