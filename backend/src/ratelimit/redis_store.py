"""Redis-backed token-bucket store — the multi-replica-safe swap for
``InMemoryTokenBucketStore``.

Each API replica sharing the same Redis sees the SAME bucket state per key,
so the effective rate limit stays correct regardless of replica count (the
problem `InMemoryTokenBucketStore`'s own docstring flags: N replicas each
running an independent in-memory bucket silently allows ~N times the
configured limit).

The refill-and-consume math executed here is byte-for-byte the same
algorithm as :func:`ratelimit.bucket.refill_and_consume` — just run
atomically inside Redis via a Lua script (``EVAL``) instead of under an
``asyncio.Lock`` in a single process. See ``tests/test_ratelimit_redis.py``
for a parametrized proof that both implementations agree for identical
inputs.

Fail-open: rate limiting is a defense-in-depth control, not a security
boundary. If Redis is unreachable or errors, `consume()` logs a warning and
returns an "allowed, at full capacity" Decision rather than raising or
blocking the request — a Redis hiccup must never 503 the whole API.
"""

from __future__ import annotations

import math
import time
from typing import Callable, Optional

from ..observability import get_logger
from .store import Decision

logger = get_logger(__name__)

# Floor/ceiling on the per-key TTL (seconds) so idle buckets expire instead of
# accumulating in Redis forever, while very bursty (high rate / low capacity)
# keys still get a sane minimum lifetime.
_MIN_TTL_S = 60
_ZERO_RATE_TTL_S = 86400  # a rate=0 bucket never refills; expire it after a day
_TTL_MARGIN_S = 60

# KEYS[1] = bucket's Redis key (a hash with fields "tokens" and "ts")
# ARGV[1] = rate (tokens/sec)
# ARGV[2] = capacity
# ARGV[3] = cost
# ARGV[4] = now (seconds, float — supplied by the caller so it's mockable in
#           tests and consistent with InMemoryTokenBucketStore's injectable
#           clock; using the caller's clock rather than Redis TIME also keeps
#           this in lock-step with bucket.py's pure-function contract)
# ARGV[5] = ttl seconds for EXPIRE
#
# Returns [allowed(0/1), tokens_remaining(string), retry_after(string; "-1"
# means infinite)]. Values are returned as STRINGS because a Lua number
# returned directly to Redis is truncated to an integer, which would destroy
# the token-bucket's fractional precision.
_REFILL_AND_CONSUME_SCRIPT = """
local key = KEYS[1]
local rate = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])
local now = tonumber(ARGV[4])
local ttl = tonumber(ARGV[5])

local state = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(state[1])
local last_ts = tonumber(state[2])

if tokens == nil then
  tokens = capacity
  last_ts = now
end

local elapsed = now - last_ts
if elapsed < 0 then
  elapsed = 0
end
tokens = math.min(capacity, tokens + elapsed * rate)

local allowed
local retry_after
if tokens >= cost then
  allowed = 1
  tokens = tokens - cost
  retry_after = 0
else
  allowed = 0
  local deficit = cost - tokens
  if rate > 0 then
    retry_after = deficit / rate
  else
    retry_after = -1
  end
end

redis.call('HSET', key, 'tokens', tostring(tokens), 'ts', tostring(now))
redis.call('EXPIRE', key, ttl)

return {allowed, tostring(tokens), tostring(retry_after)}
"""


def _ttl_seconds(rate: float, capacity: float) -> int:
    """Enough time for the bucket to fully refill (plus margin) before an
    idle key is allowed to expire, so idle buckets don't accumulate forever."""
    if rate <= 0:
        return _ZERO_RATE_TTL_S
    return max(_MIN_TTL_S, math.ceil(capacity / rate) + _TTL_MARGIN_S)


class RedisTokenBucketStore:
    """``TokenBucketStore``-conformant store backed by Redis.

    Takes a ``redis.asyncio.Redis`` client rather than constructing one, so
    the connection pool can be shared/injected (and swapped for a fake in
    tests).
    """

    def __init__(
        self,
        client,
        *,
        clock: Optional[Callable[[], float]] = None,
        key_prefix: str = "ratelimit:",
    ) -> None:
        self._client = client
        self._clock = clock or time.time
        self._key_prefix = key_prefix
        self._script = client.register_script(_REFILL_AND_CONSUME_SCRIPT)
        self._consecutive_failures = 0

    async def consume(
        self, key: str, *, rate: float, capacity: float, cost: float = 1.0
    ) -> Decision:
        now = self._clock()
        ttl = _ttl_seconds(rate, capacity)
        redis_key = self._key_prefix + key

        try:
            raw = await self._script(
                keys=[redis_key], args=[rate, capacity, cost, now, ttl]
            )
        except Exception as exc:  # noqa: BLE001 — any backend failure fails open
            return self._fail_open(capacity, exc)

        self._consecutive_failures = 0
        allowed_raw, tokens_raw, retry_after_raw = raw
        allowed = bool(int(allowed_raw))
        tokens = float(tokens_raw)
        retry_after_value = float(retry_after_raw)
        retry_after = float("inf") if retry_after_value < 0 else retry_after_value

        return Decision(
            allowed=allowed,
            retry_after=retry_after,
            remaining=int(tokens),
            limit=int(capacity),
        )

    def _fail_open(self, capacity: float, exc: Exception) -> Decision:
        self._consecutive_failures += 1
        if self._consecutive_failures == 1:
            logger.warning(
                "ratelimit.redis_down_failing_open",
                error=str(exc),
                message="Redis rate-limit backend appears down, failing open",
            )
        else:
            logger.debug(
                "ratelimit.redis_consume_failed",
                error=str(exc),
                consecutive_failures=self._consecutive_failures,
            )
        capacity_int = int(capacity)
        return Decision(
            allowed=True,
            retry_after=0.0,
            remaining=capacity_int,
            limit=capacity_int,
        )
