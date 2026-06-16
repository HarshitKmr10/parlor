"""Outbound integrations: deliver meeting recaps to workspace destinations.

Public surface:

* :data:`PROVIDERS` — registry of ``kind -> provider`` (slack, email working;
  notion, hubspot registered as not-yet-implemented).
* :func:`deliver_recap` — deliver a recap to every *enabled + configured*
  integration of a workspace.
* :class:`IntegrationsRepo` — persistence for per-workspace config.
"""

from __future__ import annotations

from typing import Dict, List

from ..observability import get_logger
from .base import IntegrationProvider
from .email_provider import EmailProvider
from .models import DeliveryResult, MeetingRecap
from .repo import IntegrationsRepo
from .slack_provider import SlackProvider
from .stub_providers import HubspotProvider, NotionProvider

logger = get_logger(__name__)

PROVIDERS: Dict[str, IntegrationProvider] = {
    p.kind: p
    for p in (
        SlackProvider(),
        EmailProvider(),
        NotionProvider(),
        HubspotProvider(),
    )
}

#: Kinds the API will accept for PUT /api/v1/integrations.
KNOWN_KINDS = tuple(PROVIDERS.keys())


async def deliver_recap(
    db, workspace_id: str, recap: MeetingRecap
) -> List[DeliveryResult]:
    """Deliver ``recap`` to every enabled + configured workspace integration."""
    repo = IntegrationsRepo(db)
    rows = await repo.list_for_workspace(workspace_id)
    results: List[DeliveryResult] = []
    for row in rows:
        if not row.get("enabled"):
            continue
        kind = row["kind"]
        provider = PROVIDERS.get(kind)
        if provider is None:
            results.append(
                DeliveryResult(kind=kind, delivered=False, detail="unknown provider")
            )
            continue
        config = row.get("config") or {}
        if not provider.is_configured(config):
            results.append(
                DeliveryResult(kind=kind, delivered=False, detail="not configured")
            )
            continue
        try:
            results.append(await provider.deliver(config, recap))
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "integrations.deliver_error", kind=kind, error=str(exc)
            )
            results.append(
                DeliveryResult(kind=kind, delivered=False, detail=str(exc))
            )
    return results


__all__ = [
    "PROVIDERS",
    "KNOWN_KINDS",
    "deliver_recap",
    "IntegrationsRepo",
    "MeetingRecap",
    "DeliveryResult",
    "IntegrationProvider",
]
