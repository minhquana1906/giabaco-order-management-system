"""Text validators shared by parent-facing input schemas."""

import unicodedata


def reject_control_chars(value: str) -> str:
    """Reject control characters; Postgres cannot store NUL in text and the rest is never typed."""
    if any(unicodedata.category(ch) == "Cc" for ch in value):
        raise ValueError("Chứa ký tự không hợp lệ")
    return value
