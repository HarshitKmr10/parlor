"""Env-driven configuration for the hosted-instance LLM spend cap.

Design choice — lifetime cap, per-workspace AND global, not a rolling window:
  The existing ``HOSTED_QUOTA_*`` meeting-count cap bounds storage/DB growth,
  but does not bound LLM spend: a workspace under its meeting cap can still
  make unlimited summarize/ask calls, and a user can evade a per-workspace
  cap entirely by creating many workspaces. This cap is a genuine hard spend
  cap, independent of the meeting-count quota, mirroring its lifetime-cap
  rationale (see ``config.py``) for the same reason: a monthly reset would
  let spend keep accumulating forever, one month's worth at a time.

Env vars (hosted-instance operators only; self-hosters should never set
these — self-hosting removes the cap entirely, matching this repo's no-billing
policy in ``src/usage``):
  HOSTED_COST_CAP_ENABLED                     default "false". Unset/false =>
                                               this entire feature is a no-op,
                                               including at the call site — no
                                               DB query is issued.
  HOSTED_COST_CAP_MAX_USD_PER_WORKSPACE        optional even when enabled, but
                                               at least one of this or the
                                               global cap below must be set.
  HOSTED_COST_CAP_MAX_USD_GLOBAL               optional even when enabled, but
                                               at least one of this or the
                                               per-workspace cap above must be
                                               set.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


class HostedCostCapMisconfigured(RuntimeError):
    """Raised when HOSTED_COST_CAP_ENABLED=true but neither cap is set (or a
    set cap isn't a valid positive number). Fails fast and loud rather than
    guessing."""


@dataclass(frozen=True)
class HostedCostCapConfig:
    enabled: bool
    max_usd_per_workspace: float | None
    max_usd_global: float | None


def _enabled() -> bool:
    return (os.getenv("HOSTED_COST_CAP_ENABLED", "false") or "").strip().lower() in (
        "1",
        "true",
        "yes",
    )


def _parse_optional_positive_float(env_var: str) -> float | None:
    raw = os.getenv(env_var)
    if raw is None or not raw.strip():
        return None
    try:
        value = float(raw.strip())
    except ValueError as exc:
        raise HostedCostCapMisconfigured(
            f"{env_var} must be a positive number, got {raw!r}"
        ) from exc
    if value <= 0:
        raise HostedCostCapMisconfigured(
            f"{env_var} must be a positive number, got {value}"
        )
    return value


def get_hosted_cost_cap_config() -> HostedCostCapConfig:
    if not _enabled():
        return HostedCostCapConfig(
            enabled=False, max_usd_per_workspace=None, max_usd_global=None
        )

    max_per_workspace = _parse_optional_positive_float(
        "HOSTED_COST_CAP_MAX_USD_PER_WORKSPACE"
    )
    max_global = _parse_optional_positive_float("HOSTED_COST_CAP_MAX_USD_GLOBAL")

    if max_per_workspace is None and max_global is None:
        raise HostedCostCapMisconfigured(
            "HOSTED_COST_CAP_ENABLED=true requires at least one of "
            "HOSTED_COST_CAP_MAX_USD_PER_WORKSPACE or "
            "HOSTED_COST_CAP_MAX_USD_GLOBAL to be set explicitly — no "
            "implicit default is used."
        )

    return HostedCostCapConfig(
        enabled=True,
        max_usd_per_workspace=max_per_workspace,
        max_usd_global=max_global,
    )
