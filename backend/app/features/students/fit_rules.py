"""Derived fitting size rules (pure)."""

from collections.abc import Iterable, Sequence


def derived_size(fit_sizes: Iterable[str], sizes: Sequence[str]) -> str | None:
    """Largest FITS size by position in `sizes`; None when there is none."""
    positions = {label: i for i, label in enumerate(sizes)}
    known = [s for s in fit_sizes if s in positions]
    return max(known, key=positions.__getitem__) if known else None
