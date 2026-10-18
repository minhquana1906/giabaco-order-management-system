"""Provisional size-guide lookup (pure)."""

from collections.abc import Mapping, Sequence
from typing import Any


def _match(value: float, rows: Sequence[Mapping[str, Any]], lo: str, hi: str) -> str | None:
    for row in rows:
        upper = row[hi]
        if value >= row[lo] and (upper is None or value < upper):
            return str(row["size_label"])
    return None


def suggest(
    height_cm: float,
    weight_kg: float,
    size_guide: Sequence[Mapping[str, Any]] | None,
    sizes: Sequence[str],
) -> str | None:
    """Larger (by position in `sizes`) of the height and weight matches; None if neither."""
    if not size_guide:
        return None
    matches = [
        m
        for m in (
            _match(height_cm, size_guide, "height_min_cm", "height_max_cm"),
            _match(weight_kg, size_guide, "weight_min_kg", "weight_max_kg"),
        )
        if m in sizes
    ]
    return max(matches, key=sizes.index) if matches else None
