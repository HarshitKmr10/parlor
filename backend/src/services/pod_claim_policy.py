"""Shared helpers for warm pod claim age policy (meeting-joiner port).

K8s pods have an ``activeDeadlineSeconds`` backstop that hard-kills the pod
regardless of activity.  If the warm pool claims a pod that's already too
close to that deadline, any subsequent work would fail within seconds.

This module provides the age-gating logic used by ``WarmPoolManager`` (at
claim time and during pool scans) to reject pods that are too close to their
deadline.
"""

from datetime import datetime, timezone
from typing import Optional


def compute_max_claimable_age_seconds(
    active_deadline_seconds: int,
    claim_age_buffer_seconds: int,
    min_remaining_lifetime_seconds: int,
) -> int:
    """Return the maximum pod age (in seconds) that is still safe to claim.

    The result guarantees at least ``min_remaining_lifetime_seconds`` of
    usable time before the K8s activeDeadlineSeconds backstop kills the pod.

    ``claim_age_buffer_seconds`` is a softer preference -- "don't claim pods
    older than (deadline - buffer)" -- but it relaxes to the hard
    ``min_remaining_lifetime_seconds`` floor when it would consume the full
    usable claim window.

    Example with defaults (deadline=86400, buffer=3600, min_remaining=60):
        max_claimable_age = 86400 - 3600 = 82800s  (23h)
        -> pods older than 23h are skipped.
    """
    claim_buffer = max(0, claim_age_buffer_seconds)
    min_remaining = max(1, min_remaining_lifetime_seconds)
    deadline = max(1, active_deadline_seconds)
    hard_max_age = deadline - min_remaining
    soft_max_age = deadline - claim_buffer
    if soft_max_age < 1:
        return max(1, hard_max_age)
    return max(1, min(soft_max_age, hard_max_age))


def pod_age_seconds(creation_timestamp: object) -> Optional[float]:
    """Return seconds since the pod was created, or None if unparseable.

    Tolerates ``datetime`` objects (from kubernetes_asyncio), ISO-8601 strings,
    and naive timestamps (assumed UTC).  Returns None on any parse failure so
    callers can fall back to a safe default.
    """
    if creation_timestamp is None:
        return None
    try:
        if isinstance(creation_timestamp, datetime):
            created_at = creation_timestamp
        elif isinstance(creation_timestamp, str):
            created_at = datetime.fromisoformat(creation_timestamp.replace("Z", "+00:00"))
        else:
            return None
        # Treat naive timestamps as UTC (K8s API always returns UTC).
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        return max(0.0, (datetime.now(timezone.utc) - created_at).total_seconds())
    except Exception:
        return None
