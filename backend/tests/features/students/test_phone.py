import pytest

from app.features.students.schemas import normalize_phone


@pytest.mark.parametrize(
    "raw",
    [
        "0912345678",
        "+84912345678",
        "84912345678",
        "091 234 5678",
        "0912.345.678",
        "+84 912-345-678",
    ],
)
def test_normalizes_to_leading_zero(raw: str) -> None:
    assert normalize_phone(raw) == "0912345678"


@pytest.mark.parametrize("raw", ["12345", "abcdefghij", "091234567", "09123456789", "+8412345"])
def test_rejects_malformed(raw: str) -> None:
    with pytest.raises(ValueError):
        normalize_phone(raw)
