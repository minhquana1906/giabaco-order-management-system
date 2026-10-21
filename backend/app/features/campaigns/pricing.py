"""Kit price math and slot option suggestion."""

import uuid
from collections.abc import Mapping, Sequence


def kit_price(
    selection: Sequence[tuple[int, uuid.UUID]], prices: Mapping[uuid.UUID, int | None]
) -> int | None:
    """Sum of qty x unit_price over chosen (slot qty, product) pairs; None if any is unpriced."""
    total = 0
    for qty, product_id in selection:
        price = prices.get(product_id)
        if price is None:
            return None
        total += price * qty
    return total


def suggest_option(
    product_ids: Sequence[uuid.UUID], gender_of: Mapping[uuid.UUID, str], gender: str | None
) -> uuid.UUID:
    """First option whose gender_target matches the student's gender, else the first option."""
    if gender is not None:
        for product_id in product_ids:
            if gender_of.get(product_id) == gender:
                return product_id
    return product_ids[0]
