"""Alembic environment using the async engine."""

import asyncio

from alembic import context
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.audit import AuditLog  # noqa: F401
from app.core.config import get_settings
from app.core.db import Base
from app.features.auth import models as _auth  # noqa: F401
from app.features.catalog import models as _catalog  # noqa: F401
from app.features.students import models as _students  # noqa: F401

target_metadata = Base.metadata


def _run(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def _run_async() -> None:
    engine = create_async_engine(get_settings().database_url)
    async with engine.connect() as connection:
        await connection.run_sync(_run)
    await engine.dispose()


asyncio.run(_run_async())
