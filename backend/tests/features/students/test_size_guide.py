from pathlib import Path

import pytest
import yaml

from app.features.students.size_guide import suggest

SEED = Path(__file__).resolve().parents[3] / "config" / "catalog.seed.yaml"
PRODUCT = yaml.safe_load(SEED.read_text(encoding="utf-8"))["products"][0]
GUIDE, SIZES = PRODUCT["size_guide"], PRODUCT["sizes"]


@pytest.mark.parametrize(
    ("height", "weight", "expected"),
    [
        (120, 20, "2"),
        (140, 32, "4"),
        (120, 18, "2"),
        (95, 12, None),
        (99.9, 14.9, None),
        (100, 15, "1"),
        (119.9, 19.9, "1"),
        (190, 90, "7"),
        (165, 20, "7"),
        (110, 100, "7"),
        (110, 12, "1"),
        (80, 32, "4"),
    ],
)
def test_suggest(height: float, weight: float, expected: str | None) -> None:
    assert suggest(height, weight, GUIDE, SIZES) == expected


def test_product_without_guide() -> None:
    assert suggest(130, 25, None, SIZES) is None
    assert suggest(130, 25, [], SIZES) is None
