"""In-memory token-bucket store.

Holds per-key ``(tokens, last_ts)`` state behind an asyncio lock and prunes idle
keys so memory stays bounded. Single-process only — multi-replica deployments
should swap in a Redis-backed store implementing the same ``consume`` contract
(documented in :mod:`ratelimit`). The clock is injectable for tests.
"""

from __future__ import annotations

import asyncio
import time
from typing import Callable, Dict, NamedTuple, Protocol, Tuple, runtime_checkable

from .bucket import refill_and_consume

_PRUNE_EVERY = 1000  # consume() calls between idle-key sweeps
_IDLE_TTL_S = 3600.0


class Decision(NamedTuple):
    allowed: bool
    retry_after: float
    remaining: int
    limit: int


@runtime_checkable
class TokenBucketStore(Protocol):
    """Structural contract both `InMemoryTokenBucketStore` and
    `RedisTokenBucketStore` (ratelimit.redis_store) satisfy.

    `RateLimitMiddleware`/`ratelimit.factory` depend on this Protocol, never a
    concrete store class, so the storage backend can be swapped (memory ->
    Redis, for multi-replica deployments) without touching call sites.
    """

    async def consume(
        self, key: str, *, rate: float, capacity: float, cost: float = 1.0
    ) -> Decision: ...


class InMemoryTokenBucketStore:
    def __init__(self, *, clock: Callable[[], float] | None = None) -> None:
        self._state: Dict[str, Tuple[float, float]] = {}
        self._lock = asyncio.Lock()
        self._clock = clock or time.monotonic
        self._calls = 0

    async def consume(
        self, key: str, *, rate: float, capacity: float, cost: float = 1.0
    ) -> Decision:
        now = self._clock()
        async with self._lock:
            tokens, last_ts = self._state.get(key, (capacity, now))
            result = refill_and_consume(
                tokens=tokens,
                last_ts=last_ts,
                now=now,
                rate=rate,
                capacity=capacity,
                cost=cost,
            )
            self._state[key] = (result.tokens, now)
            self._calls += 1
            if self._calls % _PRUNE_EVERY == 0:
                self._prune(now)
        return Decision(
            allowed=result.allowed,
            retry_after=result.retry_after,
            remaining=int(result.tokens),
            limit=int(capacity),
        )

    def _prune(self, now: float) -> None:
        stale = [k for k, (_, ts) in self._state.items() if now - ts > _IDLE_TTL_S]
        for k in stale:
            self._state.pop(k, None)
