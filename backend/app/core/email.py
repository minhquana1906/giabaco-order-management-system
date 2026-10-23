"""Transactional email through the Resend HTTP API."""

import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)
_RESEND_URL = "https://api.resend.com/emails"


async def send(to: str, subject: str, html: str, text: str) -> None:
    """Send one email; failures are logged without the address and never raised."""
    settings = get_settings()
    if not settings.resend_api_key or not settings.mail_from:
        logger.error("email not sent: RESEND_API_KEY or MAIL_FROM is not configured")
        return
    payload = {
        "from": settings.mail_from,
        "to": [to],
        "subject": subject,
        "html": html,
        "text": text,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                _RESEND_URL,
                json=payload,
                headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        status = exc.response.status_code if isinstance(exc, httpx.HTTPStatusError) else None
        logger.error("email not sent: %s status=%s", type(exc).__name__, status)
