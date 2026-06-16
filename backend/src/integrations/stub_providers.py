"""Registered-but-not-yet-implemented providers (notion, hubspot).

They're listed in the registry so the API can report them as known integration
kinds, but delivery is a no-op that reports "not implemented" so callers get an
honest signal rather than a silent drop.
"""

from __future__ import annotations

from typing import Any, Dict

from .models import DeliveryResult, MeetingRecap


class _NotImplementedProvider:
    kind = "stub"

    def is_configured(self, config: Dict[str, Any]) -> bool:  # noqa: ARG002
        return False

    async def deliver(
        self, config: Dict[str, Any], recap: MeetingRecap  # noqa: ARG002
    ) -> DeliveryResult:
        return DeliveryResult(
            kind=self.kind,
            delivered=False,
            detail="not configured (integration not yet implemented)",
        )


class NotionProvider(_NotImplementedProvider):
    kind = "notion"


class HubspotProvider(_NotImplementedProvider):
    kind = "hubspot"
