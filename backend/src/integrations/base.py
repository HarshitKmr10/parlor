"""Provider interface for outbound recap delivery.

A provider takes a per-workspace ``config`` dict (the JSONB stored in
``workspace_integrations.config``) and a :class:`MeetingRecap`, and delivers it.
Providers are stateless and registered by ``kind`` in ``__init__.py``.
"""

from __future__ import annotations

from typing import Any, Dict, Protocol, runtime_checkable

from .models import DeliveryResult, MeetingRecap


@runtime_checkable
class IntegrationProvider(Protocol):
    """Outbound recap delivery provider."""

    #: Stable identifier matching ``workspace_integrations.kind``.
    kind: str

    def is_configured(self, config: Dict[str, Any]) -> bool:
        """True if ``config`` carries everything the provider needs."""
        ...

    async def deliver(
        self, config: Dict[str, Any], recap: MeetingRecap
    ) -> DeliveryResult:
        """Deliver ``recap`` using ``config``. Must not raise; return a result."""
        ...


def render_text(recap: MeetingRecap) -> str:
    """Plain-text recap rendering shared by text-oriented providers."""
    lines = [f"Meeting recap: {recap.title}", ""]
    if recap.summary:
        lines += ["Summary:", recap.summary, ""]
    if recap.key_points:
        lines.append("Key points:")
        lines += [f"  - {p}" for p in recap.key_points]
        lines.append("")
    if recap.action_items:
        lines.append("Action items:")
        lines += [f"  - {a}" for a in recap.action_items]
    return "\n".join(lines).rstrip()
