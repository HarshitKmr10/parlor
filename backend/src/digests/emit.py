"""Deliver a rendered digest to email (SMTP) or Slack (incoming webhook).

Dev-friendly: when SMTP is unconfigured (or the channel is email with no SMTP
host) the body is logged instead of sent, so the whole path is exercisable
without credentials — mirroring the recap email provider's behavior.
"""

from __future__ import annotations

import logging
import smtplib
from email.mime.text import MIMEText
from typing import Any, Mapping

import httpx

from shared.config import settings

from .render import render_digest_text

logger = logging.getLogger("digests.emit")

_TIMEOUT = httpx.Timeout(15.0, connect=5.0)


async def emit_digest(
    pref: Mapping[str, Any], digest: Mapping[str, Any], workspace_name: str = "your workspace"
) -> dict[str, Any]:
    """Returns {delivered: bool, detail: str}. Never raises."""
    channel = str(pref.get("channel", "email"))
    target = pref.get("target")
    body = render_digest_text(digest, workspace_name)

    if not target:
        return {"delivered": False, "detail": "no target configured"}

    try:
        if channel == "slack":
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.post(str(target), json={"text": body})
            if resp.status_code >= 400:
                return {"delivered": False, "detail": f"slack {resp.status_code}"}
            return {"delivered": True, "detail": "slack"}

        # email channel
        if not settings.SMTP_HOST:
            logger.info(
                "digests.email.logged", extra={"to": target, "preview": body[:300]}
            )
            return {"delivered": True, "detail": "logged (SMTP not configured)"}

        msg = MIMEText(body)
        msg["Subject"] = f"Verdant digest — {workspace_name}"
        msg["From"] = settings.SMTP_FROM
        msg["To"] = str(target)
        # smtplib is blocking; for the low cadence of digests this is acceptable.
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
            if settings.SMTP_USE_TLS:
                smtp.starttls()
            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(msg)
        return {"delivered": True, "detail": "email"}
    except Exception as exc:  # noqa: BLE001 — emit is best-effort
        logger.warning("digests.emit_failed: %s", exc)
        return {"delivered": False, "detail": str(exc)}
