import json
from collections.abc import Iterator
from typing import Any

import psycopg
import pytest
from alembic import command
from alembic.config import Config

from tests.conftest import BACKEND_DIR, TEST_DB_URL

DSN = TEST_DB_URL.replace("+psycopg", "")
BEFORE, REVISION = "step_mode_20261031", "measurement_types_20261031"


def field(key: str, label: str) -> dict[str, Any]:
    return {"key": key, "label": label, "instruction": "", "required": True}


@pytest.fixture
def config() -> Iterator[Config]:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    command.downgrade(cfg, BEFORE)
    yield cfg
    with psycopg.connect(DSN, autocommit=True) as conn:
        conn.execute("DELETE FROM products WHERE code LIKE 'mt_%'")
    command.upgrade(cfg, "head")


def add_product(code: str, fields: list[dict[str, Any]]) -> None:
    with psycopg.connect(DSN, autocommit=True) as conn:
        conn.execute(
            "INSERT INTO products (code, name, sizes, colours, tailor_measurements)"
            " VALUES (%s, %s, '[\"1\"]', '[\"ghi\"]', %s)",
            (code, code, json.dumps(fields)),
        )


def catalog() -> dict[str, str]:
    with psycopg.connect(DSN) as conn:
        return dict(conn.execute("SELECT key, label FROM measurement_types").fetchall())


def test_backfill_keeps_keys_and_shares_types_between_products(config: Config) -> None:
    add_product("mt_a", [field("vong_nguc", "Vòng ngực"), field("dai_tay", "Dài tay")])
    add_product("mt_b", [field("vong_nguc", "  vòng   ngực ")])
    command.upgrade(config, REVISION)
    assert catalog() == {"vong_nguc": "Vòng ngực", "dai_tay": "Dài tay"}


@pytest.mark.parametrize(
    "second",
    [field("vong_nguc", "Chu vi ngực"), field("chu_vi_nguc", "Vòng ngực")],
    ids=["same key, different name", "same name, different key"],
)
def test_backfill_stops_on_conflicting_configurations(
    config: Config, second: dict[str, Any]
) -> None:
    add_product("mt_a", [field("vong_nguc", "Vòng ngực")])
    add_product("mt_b", [second])
    with pytest.raises(RuntimeError, match="resolve these product configurations"):
        command.upgrade(config, REVISION)
    with psycopg.connect(DSN) as conn:
        assert conn.execute("SELECT to_regclass('measurement_types')").fetchone() == (None,)
