import asyncio
import uuid
from types import SimpleNamespace

import psycopg
import pytest
from alembic import command
from alembic.config import Config

from tests.conftest import BACKEND_DIR, TEST_DB_URL

SERVER_DSN = TEST_DB_URL.replace("+psycopg", "")


async def test_upgrade_marks_existing_students_as_admin_measured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    name = f"guniform_migration_{uuid.uuid4().hex[:8]}"
    scratch_dsn = SERVER_DSN.rsplit("/", 1)[0] + f"/{name}"
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    monkeypatch.setattr(
        "app.core.config.get_settings",
        lambda: SimpleNamespace(
            database_url=scratch_dsn.replace("postgresql://", "postgresql+psycopg://")
        ),
    )
    with psycopg.connect(SERVER_DSN, autocommit=True) as server:
        server.execute(f'CREATE DATABASE "{name}"')
    try:
        await asyncio.to_thread(command.upgrade, cfg, "0001")
        with psycopg.connect(scratch_dsn, autocommit=True) as db:
            school_id = db.execute(
                "INSERT INTO schools (name, code) VALUES ('Trường cũ', 'OLD') RETURNING id"
            ).fetchone()
            assert school_id is not None
            class_id = db.execute(
                "INSERT INTO school_classes (school_id, grade, name) VALUES (%s, 2, '2A1') "
                "RETURNING id",
                school_id,
            ).fetchone()
            assert class_id is not None
            db.execute(
                "INSERT INTO students (school_id, class_id, full_name, dob, gender, height_cm, "
                "weight_kg, portal_token) VALUES (%s, %s, 'Học Sinh Cũ', '2018-03-14', 'MALE', "
                "126.5, 24, 'old-token')",
                (school_id[0], class_id[0]),
            )

        await asyncio.to_thread(command.upgrade, cfg, "head")

        with psycopg.connect(scratch_dsn) as db:
            rows = db.execute("SELECT full_name, data_source FROM students").fetchall()
        assert rows == [("Học Sinh Cũ", "ADMIN_MEASURED")]
    finally:
        with psycopg.connect(SERVER_DSN, autocommit=True) as server:
            server.execute(f'DROP DATABASE "{name}" WITH (FORCE)')
