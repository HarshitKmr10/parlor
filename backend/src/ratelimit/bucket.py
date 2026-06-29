"""Pure token-bucket arithmetic — no clock, no I/O, no shared state.

A bucket holds up to ``capacity`` tokens and refills at ``rate`` tokens/sec.
Each request consumes ``cost`` tokens; if fewer are available the request is
denied and a ``retry_after`` (seconds until enough tokens accrue) is returned.
"""

from __future__ import annotations

from typing import NamedTuple


class BucketResult(NamedTuple):
    allowed: bool
    tokens: float  # remaining tokens after this call
    retry_after: float  # seconds until the request would succeed (0 if allowed)


def refill_and_consume(
    *,
    tokens: float,
    last_ts: float,
    now: float,
    rate: float,
    capacity: float,
    cost: float = 1.0,
) -> BucketResult:
    """Refill the bucket up to ``now`` then try to consume ``cost`` tokens."""
    elapsed = max(0.0, now - last_ts)
    tokens = min(capacity, tokens + elapsed * rate)

    if tokens >= cost:
        return BucketResult(allowed=True, tokens=tokens - cost, retry_after=0.0)

    deficit = cost - tokens
    retry_after = deficit / rate if rate > 0 else float("inf")
    return BucketResult(allowed=False, tokens=tokens, retry_after=retry_after)
