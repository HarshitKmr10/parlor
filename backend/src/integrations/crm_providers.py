"""Real outbound providers: Notion, HubSpot, Salesforce.

Each conforms to IntegrationProvider (kind, is_configured, deliver — never
raises). Payload builders are pure functions so they're unit-testable without
network or credentials; ``deliver`` performs the HTTP call when configured.
"""

from __future__ import annotations

from typing import Any, Dict

import httpx

from ..observability import get_logger
from .base import render_text
from .models import DeliveryResult, MeetingRecap

logger = get_logger(__name__)

_TIMEOUT = httpx.Timeout(15.0, connect=5.0)
_NOTION_VERSION = "2022-06-28"


# ── Pure payload builders ────────────────────────────────────────────────────
def notion_payload(recap: MeetingRecap, database_id: str) -> Dict[str, Any]:
    children: list[dict[str, Any]] = []

    def _para(text: str) -> dict[str, Any]:
        return {
            "object": "block",
            "type": "paragraph",
            "paragraph": {"rich_text": [{"type": "text", "text": {"content": text[:1900]}}]},
        }

    if recap.summary:
        children.append(_para(recap.summary))
    for p in recap.key_points[:25]:
        children.append(
            {
                "object": "block",
                "type": "bulleted_list_item",
                "bulleted_list_item": {
                    "rich_text": [{"type": "text", "text": {"content": p[:1900]}}]
                },
            }
        )
    for a in recap.action_items[:25]:
        children.append(
            {
                "object": "block",
                "type": "to_do",
                "to_do": {
                    "checked": False,
                    "rich_text": [{"type": "text", "text": {"content": a[:1900]}}],
                },
            }
        )
    return {
        "parent": {"database_id": database_id},
        "properties": {
            "Name": {"title": [{"text": {"content": recap.title[:200]}}]}
        },
        "children": children,
    }


def hubspot_payload(recap: MeetingRecap, timestamp_ms: int) -> Dict[str, Any]:
    return {
        "properties": {
            "hs_note_body": render_text(recap)[:65000],
            "hs_timestamp": timestamp_ms,
        }
    }


def salesforce_payload(recap: MeetingRecap) -> Dict[str, Any]:
    return {
        "Subject": f"Meeting recap: {recap.title}"[:255],
        "Description": render_text(recap)[:32000],
        "Status": "Completed",
    }


# ── Providers ────────────────────────────────────────────────────────────────
class NotionProvider:
    kind = "notion"

    def is_configured(self, config: Dict[str, Any]) -> bool:
        return bool(
            (config.get("token") or config.get("apiKey"))
            and (config.get("databaseId") or config.get("database_id"))
        )

    async def deliver(self, config: Dict[str, Any], recap: MeetingRecap) -> DeliveryResult:
        token = str(config.get("token") or config.get("apiKey"))
        database_id = str(config.get("databaseId") or config.get("database_id"))
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.post(
                    "https://api.notion.com/v1/pages",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Notion-Version": _NOTION_VERSION,
                        "Content-Type": "application/json",
                    },
                    json=notion_payload(recap, database_id),
                )
            if resp.status_code >= 400:
                return DeliveryResult(kind=self.kind, delivered=False, detail=f"notion {resp.status_code}")
            return DeliveryResult(kind=self.kind, delivered=True, detail="notion page created")
        except Exception as exc:  # noqa: BLE001
            return DeliveryResult(kind=self.kind, delivered=False, detail=str(exc))


class HubspotProvider:
    kind = "hubspot"

    def is_configured(self, config: Dict[str, Any]) -> bool:
        return bool(config.get("accessToken") or config.get("access_token"))

    async def deliver(self, config: Dict[str, Any], recap: MeetingRecap) -> DeliveryResult:
        from datetime import datetime, timezone

        token = str(config.get("accessToken") or config.get("access_token"))
        ts_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.post(
                    "https://api.hubapi.com/crm/v3/objects/notes",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json",
                    },
                    json=hubspot_payload(recap, ts_ms),
                )
            if resp.status_code >= 400:
                return DeliveryResult(kind=self.kind, delivered=False, detail=f"hubspot {resp.status_code}")
            return DeliveryResult(kind=self.kind, delivered=True, detail="hubspot note created")
        except Exception as exc:  # noqa: BLE001
            return DeliveryResult(kind=self.kind, delivered=False, detail=str(exc))


class SalesforceProvider:
    kind = "salesforce"
    _API_VERSION = "v59.0"

    def is_configured(self, config: Dict[str, Any]) -> bool:
        return bool(
            (config.get("instanceUrl") or config.get("instance_url"))
            and (config.get("accessToken") or config.get("access_token"))
        )

    async def deliver(self, config: Dict[str, Any], recap: MeetingRecap) -> DeliveryResult:
        instance = str(config.get("instanceUrl") or config.get("instance_url")).rstrip("/")
        token = str(config.get("accessToken") or config.get("access_token"))
        url = f"{instance}/services/data/{self._API_VERSION}/sobjects/Task"
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.post(
                    url,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json",
                    },
                    json=salesforce_payload(recap),
                )
            if resp.status_code >= 400:
                return DeliveryResult(kind=self.kind, delivered=False, detail=f"salesforce {resp.status_code}")
            return DeliveryResult(kind=self.kind, delivered=True, detail="salesforce task created")
        except Exception as exc:  # noqa: BLE001
            return DeliveryResult(kind=self.kind, delivered=False, detail=str(exc))
