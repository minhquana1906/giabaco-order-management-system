"""Idempotent catalog seed from YAML, keyed by product code."""

import asyncio
import sys
from pathlib import Path
from typing import Any

import yaml
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.catalog.models import Product


def validate_product(spec: dict[str, Any]) -> None:
    """Raise ValueError when sizes or size_guide are inconsistent."""
    code = spec.get("code")
    sizes = spec.get("sizes")
    if not code or not spec.get("name"):
        raise ValueError("product needs code and name")
    if not sizes or len(set(sizes)) != len(sizes) or not all(isinstance(s, str) for s in sizes):
        raise ValueError(f"{code}: sizes must be a non-empty list of unique strings")
    unknown = {row["size_label"] for row in spec.get("size_guide") or []} - set(sizes)
    if unknown:
        raise ValueError(f"{code}: size_guide labels not in sizes: {sorted(unknown)}")


async def seed_catalog(session: AsyncSession, path: Path) -> int:
    """Insert products missing from the DB, never overwriting; returns the spec count."""
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    specs: list[dict[str, Any]] = data.get("products", [])
    for spec in specs:
        validate_product(spec)
    existing = {p.code: p for p in (await session.scalars(select(Product))).all()}
    for position, spec in enumerate(specs):
        if spec["code"] in existing:
            continue
        session.add(
            Product(
                code=spec["code"],
                name=spec["name"],
                description=spec.get("description"),
                sizes=list(spec["sizes"]),
                size_guide=spec.get("size_guide"),
                colours=list(spec.get("colours", ["ghi"])),
                gender_target=spec.get("gender_target", "UNISEX"),
                position=position,
                active=spec.get("active", True),
            )
        )
    await session.commit()
    return len(specs)


async def _main(path: Path) -> None:
    from app.core.db import SessionLocal, engine

    async with SessionLocal() as session:
        count = await seed_catalog(session, path)
    await engine.dispose()
    print(f"seeded {count} products")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: python -m app.features.catalog.seed <catalog.seed.yaml>")
    asyncio.run(_main(Path(sys.argv[1])))
