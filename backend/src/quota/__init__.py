"""Hosted-instance workspace meeting quota.

Purely additive, opt-in guardrail for the small public hosted deployment of
this repo (Cloud Run, not part of this repo's own deploy tooling) where
strangers can sign up for free and data persists normally. Self-hosters never
set ``HOSTED_QUOTA_ENABLED`` and this module is then a complete no-op — not
even a DB query runs. See ``config.py`` for the lifetime-vs-monthly design
rationale, and ``guard.py`` for the enforcement point.

This is NOT the request-rate limiter in ``src/ratelimit`` (requests/second)
and NOT billing/usage-tracking (``src/usage``, which explicitly never gates
anything). It caps total accumulated workspace storage/DB cost over time.
"""

from __future__ import annotations

from .config import HostedQuotaConfig, get_hosted_quota_config
from .cost_config import HostedCostCapConfig, get_hosted_cost_cap_config
from .cost_guard import enforce_cost_cap
from .guard import enforce_meeting_quota
from .repo import count_workspace_meetings

__all__ = [
    "HostedQuotaConfig",
    "get_hosted_quota_config",
    "enforce_meeting_quota",
    "count_workspace_meetings",
    "HostedCostCapConfig",
    "get_hosted_cost_cap_config",
    "enforce_cost_cap",
]
