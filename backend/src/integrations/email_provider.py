"""Email recap delivery via SMTP (env-configured), or log-only in dev.

Config shape: ``{"to": ["a@example.com", "b@example.com"]}``.
SMTP transport comes from ``settings.SMTP_*``. If ``SMTP_HOST`` is unset, the
provider logs the rendered recap instead of sending — dev-friendly and never a
hard failure.
"""

from __future__ import annotations

import asyncio
import smtplib
from email.message import EmailMessage
from typing import Any, Dict, List

from shared.config import settings

from ..observability import get_logger
from .base import render_text
from .models import DeliveryResult, MeetingRecap

logger = get_logger(__name__)


def _recipients(config: Dict[str, Any]) -> List[str]:
    raw = config.get("to") or config.get("recipients") or []
    if isinstance(raw, str):
        raw = [r.strip() for r in raw.split(",") if r.strip()]
    return [str(r) for r in raw if r]


class EmailProvider:
    kind = "email"

    def is_configured(self, config: Dict[str, Any]) -> bool:
        return len(_recipients(config)) > 0

    async def deliver(
        self, config: Dict[str, Any], recap: MeetingRecap
    ) -> DeliveryResult:
        recipients = _recipients(config)
        if not recipients:
            return DeliveryResult(
                kind=self.kind, delivered=False, detail="no recipients configured"
            )

        body = render_text(recap)
        subject = f"Meeting recap: {recap.title}"

        # Dev / no-SMTP path: log instead of sending.
        if not settings.SMTP_HOST:
            logger.info(
                "integrations.email.logged",
                to=recipients,
                subject=subject,
                body_preview=body[:500],
            )
            return DeliveryResult(
                kind=self.kind, delivered=True, detail="logged (SMTP not configured)"
            )

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM
        msg["To"] = ", ".join(recipients)
        msg.set_content(body)

        try:
            # SMTP is blocking; run it off the event loop.
            await asyncio.to_thread(self._send, msg)
            return DeliveryResult(kind=self.kind, delivered=True)
        except Exception as exc:  # noqa: BLE001
            logger.warning("integrations.email.error", error=str(exc))
            return DeliveryResult(kind=self.kind, delivered=False, detail=str(exc))

    def _send(self, msg: EmailMessage) -> None:
        """Synchronous SMTP send (kept small so it can run in a thread)."""
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
            if settings.SMTP_USE_TLS:
                smtp.starttls()
            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(msg)
