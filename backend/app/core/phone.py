"""Vietnamese phone number normalization."""

import re

_PHONE_RE = re.compile(r"^0\d{9}$")


def normalize_phone(raw: str) -> str:
    """Normalize +84/84 prefixes to 0xxxxxxxxx; raise ValueError when malformed."""
    cleaned = re.sub(r"[\s.\-()]", "", raw)
    if cleaned.startswith("+84"):
        cleaned = "0" + cleaned[3:]
    elif cleaned.startswith("84") and len(cleaned) == 11:
        cleaned = "0" + cleaned[2:]
    if not _PHONE_RE.match(cleaned):
        raise ValueError("Số điện thoại không hợp lệ")
    return cleaned
