from app.features.students.fit_rules import derived_size

SIZES = ["1", "2", "3", "4", "5", "6", "7"]


def test_no_fits_returns_none() -> None:
    assert derived_size([], SIZES) is None


def test_largest_by_position_not_lexicographic() -> None:
    assert derived_size(["2", "4", "3"], SIZES) == "4"
    assert derived_size(["S", "M"], ["S", "M", "L"]) == "M"
    assert derived_size(["10", "9"], ["9", "10"]) == "10"


def test_unknown_labels_ignored() -> None:
    assert derived_size(["99"], SIZES) is None
