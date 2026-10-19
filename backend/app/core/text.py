"""Text validators shared by parent-facing input schemas."""

import unicodedata


def reject_control_chars(value: str) -> str:
    """Reject control characters and lone surrogates; Postgres cannot store NUL in text."""
    if any(unicodedata.category(ch) in {"Cc", "Cs"} for ch in value):
        raise ValueError("Chứa ký tự không hợp lệ")
    return value
