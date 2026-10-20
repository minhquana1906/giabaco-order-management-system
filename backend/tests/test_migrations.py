import asyncio
import uuid
from types import SimpleNamespace

import psycopg
import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory

from tests.conftest import BACKEND_DIR, TEST_DB_URL

SERVER_DSN = TEST_DB_URL.replace("+psycopg", "")


def scalar(dsn: str, sql: str) -> object:
    with psycopg.connect(dsn, autocommit=True) as db:
        row = db.execute(sql).fetchone()
    assert row is not None
    return row[0]


async def test_upgrade_marks_existing_students_as_admin_measured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    name = f"guniform_migration_{uuid.uuid4().hex[:8]}"
    scratch_dsn = SERVER_DSN.rsplit("/", 1)[0] + f"/{name}"
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    head = ScriptDirectory.from_config(cfg).get_current_head()
    monkeypatch.setattr(
        "app.core.config.get_settings",
        lambda: SimpleNamespace(
            database_url=scratch_dsn.replace("postgresql://", "postgresql+psycopg://")
        ),
    )
    shared_students = scalar(SERVER_DSN, "SELECT count(*) FROM students")
    with psycopg.connect(SERVER_DSN, autocommit=True) as server:
        server.execute(f'CREATE DATABASE "{name}"')
    try:
        await asyncio.to_thread(command.upgrade, cfg, "0001")
        assert scalar(scratch_dsn, "SELECT version_num FROM alembic_version") == "0001"
        has_column = (
            "SELECT count(*) FROM information_schema.columns "
            "WHERE table_name = 'students' AND column_name = 'data_source'"
        )
        assert scalar(scratch_dsn, has_column) == 0
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

        assert scalar(scratch_dsn, "SELECT version_num FROM alembic_version") == head
        with psycopg.connect(scratch_dsn) as db:
            rows = db.execute("SELECT full_name, data_source FROM students").fetchall()
        assert rows == [("Học Sinh Cũ", "ADMIN_MEASURED")]
        assert scalar(SERVER_DSN, "SELECT count(*) FROM students") == shared_students
        assert scalar(SERVER_DSN, "SELECT version_num FROM alembic_version") == head
    finally:
        with psycopg.connect(SERVER_DSN, autocommit=True) as server:
            server.execute(f'DROP DATABASE "{name}" WITH (FORCE)')


async def test_size_choice_colour_migration_round_trip(monkeypatch: pytest.MonkeyPatch) -> None:
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
    has_colour = (
        "SELECT count(*) FROM information_schema.columns "
        "WHERE table_name = 'parent_size_choices' AND column_name = 'colour'"
    )
    with psycopg.connect(SERVER_DSN, autocommit=True) as server:
        server.execute(f'CREATE DATABASE "{name}"')
    try:
        await asyncio.to_thread(command.upgrade, cfg, "0002")
        assert scalar(scratch_dsn, has_colour) == 0
        with psycopg.connect(scratch_dsn, autocommit=True) as db:
            school = db.execute(
                "INSERT INTO schools (name, code) VALUES ('Trường cũ', 'OLD') RETURNING id"
            ).fetchone()
            assert school is not None
            klass = db.execute(
                "INSERT INTO school_classes (school_id, grade, name) VALUES (%s, 2, '2A1') "
                "RETURNING id",
                school,
            ).fetchone()
            assert klass is not None
            student = db.execute(
                "INSERT INTO students (school_id, class_id, full_name, dob, gender, height_cm, "
                "weight_kg, portal_token) VALUES (%s, %s, 'Học Sinh Cũ', '2018-03-14', 'MALE', "
                "126.5, 24, 'old-token') RETURNING id",
                (school[0], klass[0]),
            ).fetchone()
            product = db.execute(
                "INSERT INTO products (code, name, sizes) VALUES ('blazer', 'Blazer', '[\"3\"]') "
                "RETURNING id"
            ).fetchone()
            assert student is not None and product is not None
            db.execute(
                "INSERT INTO parent_size_choices (student_id, product_id, size_label) "
                "VALUES (%s, %s, '3')",
                (student[0], product[0]),
            )

        await asyncio.to_thread(command.upgrade, cfg, "0003")

        assert scalar(scratch_dsn, has_colour) == 1
        assert scalar(scratch_dsn, "SELECT colour FROM parent_size_choices") is None
        with psycopg.connect(scratch_dsn, autocommit=True) as db:
            db.execute("UPDATE parent_size_choices SET colour = 'ghi'")
            with pytest.raises(psycopg.errors.CheckViolation):
                db.execute("UPDATE parent_size_choices SET colour = 'red'")

        await asyncio.to_thread(command.downgrade, cfg, "0002")

        assert scalar(scratch_dsn, has_colour) == 0
        assert scalar(scratch_dsn, "SELECT count(*) FROM parent_size_choices") == 1
    finally:
        with psycopg.connect(SERVER_DSN, autocommit=True) as server:
            server.execute(f'DROP DATABASE "{name}" WITH (FORCE)')


async def test_staff_accounts_migration_round_trip(monkeypatch: pytest.MonkeyPatch) -> None:
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
    has_table = "SELECT count(*) FROM information_schema.tables WHERE table_name = 'staff_accounts'"
    with psycopg.connect(SERVER_DSN, autocommit=True) as server:
        server.execute(f'CREATE DATABASE "{name}"')
    try:
        await asyncio.to_thread(command.upgrade, cfg, "0003")
        assert scalar(scratch_dsn, has_table) == 0

        await asyncio.to_thread(command.upgrade, cfg, "0004")

        assert scalar(scratch_dsn, has_table) == 1
        with psycopg.connect(scratch_dsn, autocommit=True) as db:
            db.execute("INSERT INTO staff_accounts (username, password_hash) VALUES ('lan', 'h')")
            with pytest.raises(psycopg.errors.UniqueViolation):
                db.execute(
                    "INSERT INTO staff_accounts (username, password_hash) VALUES ('lan', 'h')"
                )

        await asyncio.to_thread(command.downgrade, cfg, "0003")

        assert scalar(scratch_dsn, has_table) == 0
    finally:
        with psycopg.connect(SERVER_DSN, autocommit=True) as server:
            server.execute(f'DROP DATABASE "{name}" WITH (FORCE)')
