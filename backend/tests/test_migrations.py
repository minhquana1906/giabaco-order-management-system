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


async def test_parent_orders_cutover_converts_lqd_choices_to_ghi_orders(
    monkeypatch: pytest.MonkeyPatch, capfd: pytest.CaptureFixture[str]
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
        await asyncio.to_thread(command.upgrade, cfg, "0007")
        with psycopg.connect(scratch_dsn, autocommit=True) as db:

            def one(sql: str, params: tuple[object, ...] = ()) -> object:
                row = db.execute(sql, params).fetchone()
                assert row is not None
                return row[0]

            def school(code: str) -> tuple[object, object]:
                sid = one(
                    "INSERT INTO schools (name, code) VALUES (%s, %s) RETURNING id", (code, code)
                )
                cid = one(
                    "INSERT INTO school_classes (school_id, grade, name) VALUES (%s, 2, '2A1') "
                    "RETURNING id",
                    (sid,),
                )
                return sid, cid

            def student(sid: object, cid: object, token: str) -> object:
                return one(
                    "INSERT INTO students (school_id, class_id, full_name, dob, gender, "
                    "height_cm, weight_kg, portal_token, parent_name) VALUES "
                    "(%s, %s, %s, '2018-03-14', 'FEMALE', 126.5, 24, %s, 'PH') RETURNING id",
                    (sid, cid, f"HS {token}", token),
                )

            def choose(
                student_id: object, product_id: object, size: str, colour: str | None
            ) -> None:
                db.execute(
                    "INSERT INTO parent_size_choices (student_id, product_id, size_label, colour) "
                    "VALUES (%s, %s, %s, %s)",
                    (student_id, product_id, size, colour),
                )

            sizes = '["3","4","5"]'
            blazer = one(
                "INSERT INTO products (code, name, sizes) VALUES ('blazer', 'Blazer', %s) "
                "RETURNING id",
                (sizes,),
            )
            gile = one(
                "INSERT INTO products (code, name, sizes) VALUES ('gile', 'Gile', %s) RETURNING id",
                (sizes,),
            )
            lqd_school, lqd_class = school("LQD")
            other_school, other_class = school("NDU")
            navy = student(lqd_school, lqd_class, "navy")
            student(lqd_school, lqd_class, "nochoice")
            plain = student(lqd_school, lqd_class, "ghi")
            outside = student(other_school, other_class, "outside")
            choose(navy, blazer, "3", "navy")
            choose(navy, gile, "4", None)
            choose(plain, blazer, "5", "ghi")
            choose(outside, blazer, "3", "navy")

        await asyncio.to_thread(command.upgrade, cfg, "0008")

        out = capfd.readouterr().out
        assert "converted 2 LQD orders" in out and "1 parent size choices outside LQD" in out
        with psycopg.connect(scratch_dsn, autocommit=True) as db:
            campaigns = db.execute(
                "SELECT c.status, count(i.id), count(i.unit_price), array_agg(DISTINCT i.colour) "
                "FROM campaigns c JOIN campaign_items i ON i.campaign_id = c.id "
                "JOIN schools s ON s.id = c.school_id WHERE s.code = 'LQD' GROUP BY c.status"
            ).fetchall()
            assert campaigns == [("OPEN", 2, 0, ["ghi"])]
            orders = db.execute(
                "SELECT s.full_name, o.status, o.source, o.submitted_at IS NOT NULL, "
                "o.class_label, o.parent_name, o.gender FROM orders o "
                "JOIN students s ON s.id = o.student_id ORDER BY s.full_name"
            ).fetchall()
            assert orders == [
                ("HS ghi", "SUBMITTED", "PARENT", True, "2A1", "PH", "FEMALE"),
                ("HS navy", "SUBMITTED", "PARENT", True, "2A1", "PH", "FEMALE"),
            ]
            lines = db.execute(
                "SELECT s.full_name, p.code, l.size_label, l.colour, l.qty, l.unit_price, "
                "l.kit_line_id FROM order_lines l JOIN orders o ON o.id = l.order_id "
                "JOIN students s ON s.id = o.student_id JOIN products p ON p.id = l.product_id "
                "ORDER BY s.full_name, p.code"
            ).fetchall()
            assert lines == [
                ("HS ghi", "blazer", "5", "ghi", 1, None, None),
                ("HS navy", "blazer", "3", "ghi", 1, None, None),
                ("HS navy", "gile", "4", "ghi", 1, None, None),
            ]
            logs = db.execute(
                "SELECT a.actor, a.before, a.after->>'status' FROM audit_logs a "
                "JOIN orders o ON o.id = a.entity_id JOIN students s ON s.id = o.student_id "
                "WHERE a.action = 'order.create' AND s.full_name = 'HS navy'"
            ).fetchall()
            assert logs == [
                ("system:colour-policy", {"colours": {"blazer": "navy", "gile": None}}, "SUBMITTED")
            ]
            assert db.execute("SELECT count(*) FROM legacy_parent_size_choices").fetchone() == (4,)
            assert db.execute("SELECT to_regclass('parent_size_choices')").fetchone() == (None,)
    finally:
        with psycopg.connect(SERVER_DSN, autocommit=True) as server:
            server.execute(f'DROP DATABASE "{name}" WITH (FORCE)')


async def test_parent_orders_cutover_aborts_without_school_then_env_override_converts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    name = f"guniform_migration_{uuid.uuid4().hex[:8]}"
    scratch_dsn = SERVER_DSN.rsplit("/", 1)[0] + f"/{name}"
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    monkeypatch.delenv("CUTOVER_SCHOOL_CODE", raising=False)
    monkeypatch.setattr(
        "app.core.config.get_settings",
        lambda: SimpleNamespace(
            database_url=scratch_dsn.replace("postgresql://", "postgresql+psycopg://")
        ),
    )
    with psycopg.connect(SERVER_DSN, autocommit=True) as server:
        server.execute(f'CREATE DATABASE "{name}"')
    try:
        await asyncio.to_thread(command.upgrade, cfg, "0007")
        with psycopg.connect(scratch_dsn, autocommit=True) as db:
            row = db.execute(
                "INSERT INTO schools (name, code) VALUES ('Le Quy Don', 'LQD_NEW') RETURNING id"
            ).fetchone()
            assert row is not None
            class_row = db.execute(
                "INSERT INTO school_classes (school_id, grade, name) VALUES (%s, 2, '2A1') "
                "RETURNING id",
                (row[0],),
            ).fetchone()
            assert class_row is not None
            student_row = db.execute(
                "INSERT INTO students (school_id, class_id, full_name, dob, gender, "
                "height_cm, weight_kg, portal_token) VALUES "
                "(%s, %s, 'HS', '2018-03-14', 'FEMALE', 126.5, 24, 'tok') RETURNING id",
                (row[0], class_row[0]),
            ).fetchone()
            assert student_row is not None
            for code in ("blazer", "gile"):
                db.execute(
                    "INSERT INTO products (code, name, sizes) VALUES (%s, %s, '[\"3\"]')",
                    (code, code),
                )
            product = db.execute("SELECT id FROM products WHERE code = 'blazer'").fetchone()
            assert product is not None
            db.execute(
                "INSERT INTO parent_size_choices (student_id, product_id, size_label, colour) "
                "VALUES (%s, %s, '3', 'navy')",
                (student_row[0], product[0]),
            )

        with pytest.raises(RuntimeError, match="CUTOVER_SCHOOL_CODE"):
            await asyncio.to_thread(command.upgrade, cfg, "0008")
        assert scalar(scratch_dsn, "SELECT to_regclass('parent_size_choices')") is not None
        assert scalar(scratch_dsn, "SELECT count(*) FROM parent_size_choices") == 1

        monkeypatch.setenv("CUTOVER_SCHOOL_CODE", "LQD_NEW")
        await asyncio.to_thread(command.upgrade, cfg, "0008")

        assert scalar(scratch_dsn, "SELECT count(*) FROM orders") == 1
        assert scalar(scratch_dsn, "SELECT count(*) FROM legacy_parent_size_choices") == 1
    finally:
        with psycopg.connect(SERVER_DSN, autocommit=True) as server:
            server.execute(f'DROP DATABASE "{name}" WITH (FORCE)')
