"""Slack recap delivery via an incoming-webhook URL.

Config shape: ``{"webhookUrl": "https://hooks.slack.com/services/..."}``.
Posts a formatted summary + action items to the channel bound to the webhook.
"""

from __future__ import annotations

from typing import Any, Dict

import httpx

from ..observability import get_logger
from .base import render_text
from .models import DeliveryResult, MeetingRecap

logger = get_logger(__name__)

_TIMEOUT = httpx.Timeout(10.0, connect=5.0)


class SlackProvider:
    kind = "slack"

    def is_configured(self, config: Dict[str, Any]) -> bool:
        url = str(config.get("webhookUrl") or config.get("webhook_url") or "")
        return url.startswith("https://hooks.slack.com/")

    def _blocks(self, recap: MeetingRecap) -> Dict[str, Any]:
        blocks: list[dict[str, Any]] = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": recap.title[:150]},
            }
        ]
        if recap.summary:
            blocks.append(
                {
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": recap.summary[:2900]},
                }
            )
        if recap.action_items:
            items = "\n".join(f"• {a}" for a in recap.action_items[:20])
            blocks.append(
                {
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": f"*Action items*\n{items}"[:2900]},
                }
            )
        return {"text": render_text(recap)[:3000], "blocks": blocks}

    async def deliver(
        self, config: Dict[str, Any], recap: MeetingRecap
    ) -> DeliveryResult:
        if not self.is_configured(config):
            return DeliveryResult(
                kind=self.kind, delivered=False, detail="not configured"
            )
        url = str(config.get("webhookUrl") or config.get("webhook_url"))
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.post(url, json=self._blocks(recap))
            if resp.status_code >= 400:
                logger.warning(
                    "integrations.slack.error",
                    status=resp.status_code,
                    body=resp.text[:200],
                )
                return DeliveryResult(
                    kind=self.kind,
                    delivered=False,
                    detail=f"slack returned {resp.status_code}",
                )
            return DeliveryResult(kind=self.kind, delivered=True)
        except httpx.HTTPError as exc:
            logger.warning("integrations.slack.exception", error=str(exc))
            return DeliveryResult(kind=self.kind, delivered=False, detail=str(exc))
