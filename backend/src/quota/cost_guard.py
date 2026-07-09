"""Enforcement point for the hosted-instance LLM spend cap.

Call ``enforce_cost_cap`` as the very first thing in a route that triggers an
ai-service call (summarize/ask), before any other work. When
``HOSTED_COST_CAP_ENABLED`` is unset/false this is a single cheap env-var
read and returns immediately — no DB round trip, so self-hosters pay zero
cost for a feature they never opted into.

Checks both the per-workspace lifetime cap and the global instance-wide
lifetime cap so that creating additional workspaces cannot be used to evade
the spend limit.
"""

from __future__ import annotations

from ..api.product.errors import ApiError
from ..usage import LlmUsageRepo
from .cost_config import get_hosted_cost_cap_config


async def enforce_cost_cap(db, workspace_id: str) -> None:
    config = get_hosted_cost_cap_config()
    if not config.enabled:
        return

    repo = LlmUsageRepo(db)

    if config.max_usd_per_workspace is not None:
        totals = await repo.get_totals(workspace_id)
        spent = totals["estimated_cost_usd"]
        if spent >= config.max_usd_per_workspace:
            raise ApiError(
                429,
                "cost_cap_exceeded",
                f"This hosted instance limits each workspace to "
                f"${config.max_usd_per_workspace:.2f} in lifetime LLM spend — "
                "self-host Parlor for unlimited use.",
                details={
                    "scope": "workspace",
                    "limitUsd": config.max_usd_per_workspace,
                    "spentUsd": spent,
                },
            )

    if config.max_usd_global is not None:
        global_totals = await repo.get_global_total()
        global_spent = global_totals["estimated_cost_usd"]
        if global_spent >= config.max_usd_global:
            raise ApiError(
                429,
                "cost_cap_exceeded",
                f"This hosted instance has reached its total lifetime LLM "
                f"spend cap of ${config.max_usd_global:.2f} — self-host "
                "Parlor for unlimited use.",
                details={
                    "scope": "global",
                    "limitUsd": config.max_usd_global,
                    "spentUsd": global_spent,
                },
            )
