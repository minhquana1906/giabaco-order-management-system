"""Re-encode existing product images to WebP (long edge <= 1600 px).

Usage (cwd: backend/):
  uv run python -m scripts.optimize_media            # dry run, writes nothing
  uv run python -m scripts.optimize_media --commit   # writes new files, updates the DB
Each converted image gets a NEW file name (media is served as immutable); old files stay on disk.
Paths, widths and heights are updated in one transaction; new files are removed if it fails.
Images that are already optimal WebP, or would not shrink, are left alone.
"""

import argparse
import asyncio
import sys
import uuid
from pathlib import Path

from sqlalchemy import select

from app.core import audit
from app.core.db import SessionLocal, engine
from app.features.catalog.handler import image_snapshot, media_root
from app.features.catalog.images import optimize
from app.features.catalog.models import ProductImage

ACTOR = "optimize_media"


async def run(commit: bool) -> int:
    root = media_root()
    created: list[Path] = []
    scanned = converted = missing = unreadable = 0
    total_before = total_after = 0
    async with SessionLocal() as session:
        rows = await session.scalars(
            select(ProductImage).where(ProductImage.deleted_at.is_(None)).order_by(ProductImage.id)
        )
        try:
            for image in rows:
                scanned += 1
                source = (root / image.path).resolve()
                if not source.is_relative_to(root) or not source.is_file():
                    missing += 1
                    continue
                original = source.read_bytes()
                result = await asyncio.to_thread(optimize, original)
                if result is None:
                    unreadable += 1
                    continue
                total_before += len(original)
                if result.data is original or len(result.data) >= len(original):
                    total_after += len(original)
                    continue
                converted += 1
                total_after += len(result.data)
                if commit:
                    old = image_snapshot(image)
                    target = source.with_name(f"{source.stem}_{uuid.uuid4().hex[:8]}.webp")
                    target.write_bytes(result.data)
                    created.append(target)
                    image.path = target.relative_to(root).as_posix()
                    image.width, image.height = result.width, result.height
                    await audit.record(
                        session, ACTOR, "product_image.optimize", "product_image", image.id,
                        old, image_snapshot(image),
                    )  # fmt: skip
            if commit:
                await session.commit()
        except BaseException:
            await session.rollback()
            for path in created:
                path.unlink(missing_ok=True)
            raise
    mode = "COMMIT" if commit else "DRY RUN"
    print(f"[{mode}] scanned={scanned} converted={converted}", end=" ")
    print(f"missing={missing} unreadable={unreadable}")
    print(
        f"size before={total_before} B after={total_after} B saved={total_before - total_after} B"
    )
    return 0


async def amain(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0] if __doc__ else None)
    parser.add_argument("--dry-run", action="store_true", help="report only (default)")
    parser.add_argument("--commit", action="store_true", help="write files and update the DB")
    args = parser.parse_args(argv)
    if args.dry_run and args.commit:
        parser.error("--dry-run and --commit are mutually exclusive")
    try:
        return await run(args.commit)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    sys.exit(asyncio.run(amain(sys.argv[1:])))
