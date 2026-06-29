"""Token-bucket API rate limiting.

Production hardening: every authenticated principal (API key / user) and every
unauthenticated client IP gets a token bucket; bursts are absorbed up to a cap
and sustained traffic is smoothed to a steady rate. Unauthenticated/public
routes get a stricter tier.

The algorithm (:mod:`bucket`) is pure and the store (:mod:`store`) sits behind a
small interface, so a Redis-backed store can replace the in-memory one for
multi-replica deployments without touching the middleware.
"""

from __future__ import annotations

from .bucket import refill_and_consume
from .store import Decision, InMemoryTokenBucketStore

__all__ = ["refill_and_consume", "Decision", "InMemoryTokenBucketStore"]
