import json
import logging

from app.core.logging import JsonFormatter, mask_text, mask_value


def test_mask_text_hides_email_and_phone() -> None:
    masked = mask_text("liên hệ a.b@example.com hoặc 0912345678 / +84 912 345 678")
    assert "example.com" not in masked
    assert "0912345678" not in masked
    assert "912 345 678" not in masked


def test_mask_text_keeps_innocuous_numbers() -> None:
    assert mask_text("status=200 ms=12.5") == "status=200 ms=12.5"


def test_mask_value_masks_pii_keys_recursively() -> None:
    masked = mask_value(
        {"full_name": "Nguyễn A", "nested": [{"parent_phone": "0912345678", "ok": 1}], "path": "/x"}
    )
    assert masked == {
        "full_name": "***",
        "nested": [{"parent_phone": "***", "ok": 1}],
        "path": "/x",
    }


def test_json_formatter_masks_message_and_ctx() -> None:
    record = logging.LogRecord("t", logging.INFO, "f", 1, "student 0912345678", None, None)
    record.ctx = {"parent_email": "a@b.vn", "status": 200}
    out = json.loads(JsonFormatter().format(record))
    assert "0912345678" not in out["message"]
    assert out["parent_email"] == "***"
    assert out["status"] == 200


def test_mask_value_masks_parent_credentials() -> None:
    assert mask_value({"identifier": "a@b.vn", "password": "secret-123"}) == {
        "identifier": "***",
        "password": "***",
    }
