"""Env-driven configuration for the hosted-instance meeting quota.

Design choice — lifetime cap, not a rolling/calendar month:
  This guardrail exists for one specific small hosted instance to stop total
  accumulated storage/DB cost from growing unbounded, not to model a real
  billing product. A monthly cap would reset every month and let an account
  keep accumulating meetings forever, one month's worth at a time — exactly
  the unbounded growth this exists to prevent. A single lifetime-per-workspace
  count avoids month-boundary/timezone ambiguity entirely and is trivial to
  reason about: "this workspace may have at most N meetings, ever." That is
  the more honest description of what a small free hosted instance can afford
  to host, so ``HOSTED_QUOTA_MAX_TOTAL_MEETINGS`` is the only cap implemented.

Env vars (hosted-instance operators only; self-hosters should never set
these):
  HOSTED_QUOTA_ENABLED             default "false". Unset/false => this
                                    entire feature is a no-op, including at
                                    the call site — no DB query is issued.
  HOSTED_QUOTA_MAX_TOTAL_MEETINGS  required when enabled. No implicit
                                    default — an operator turning this on
                                    must say explicitly what the cap is
                                    rather than silently inheriting a guess.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


class HostedQuotaMisconfigured(RuntimeError):
    """Raised when HOSTED_QUOTA_ENABLED=true but the cap isn't set (or isn't
    a valid positive integer). Fails fast and loud rather than guessing."""


@dataclass(frozen=True)
class HostedQuotaConfig:
    enabled: bool
    max_total_meetings: int | None


def _enabled() -> bool:
    return (os.getenv("HOSTED_QUOTA_ENABLED", "false") or "").strip().lower() in (
        "1",
        "true",
        "yes",
    )


def get_hosted_quota_config() -> HostedQuotaConfig:
    if not _enabled():
        return HostedQuotaConfig(enabled=False, max_total_meetings=None)

    raw = os.getenv("HOSTED_QUOTA_MAX_TOTAL_MEETINGS")
    if raw is None or not raw.strip():
        raise HostedQuotaMisconfigured(
            "HOSTED_QUOTA_ENABLED=true requires HOSTED_QUOTA_MAX_TOTAL_MEETINGS "
            "to be set explicitly (e.g. 20) — no implicit default is used."
        )
    try:
        cap = int(raw.strip())
    except ValueError as exc:
        raise HostedQuotaMisconfigured(
            f"HOSTED_QUOTA_MAX_TOTAL_MEETINGS must be a positive integer, got {raw!r}"
        ) from exc
    if cap <= 0:
        raise HostedQuotaMisconfigured(
            f"HOSTED_QUOTA_MAX_TOTAL_MEETINGS must be a positive integer, got {cap}"
        )
    return HostedQuotaConfig(enabled=True, max_total_meetings=cap)
