"""Tests for the Redis-backed token-bucket store (multi-replica rate limiting).

Three concerns, mirroring tests/test_ratelimit.py's style:

1. Parity: the Lua script's atomic refill-and-consume must produce IDENTICAL
   allowed/remaining results to bucket.py's pure Python `refill_and_consume`
   for the same (rate, capacity, cost, elapsed-time-sequence) inputs. Requires
   a real reachable Redis — set REDIS_TEST_URL, or start one locally
   (`docker run --rm -p 16379:6379 redis:7-alpine`). Skipped (not failed) if
   no Redis is reachable.
2. Fail-open: a Redis client that raises on the script call must not raise
   out of consume() — it must return an "allowed" Decision so a Redis outage
   never takes down the API (defense-in-depth, not a security boundary).
3. Protocol conformance: both stores structurally satisfy TokenBucketStore.
"""

from __future__ import annotations

import os

import pytest

from src.ratelimit.bucket import refill_and_consume
from src.ratelimit.store import InMemoryTokenBucketStore, TokenBucketStore

REDIS_TEST_URL = os.getenv("REDIS_TEST_URL", "redis://localhost:16379/0")


def _redis_reachable() -> bool:
    try:
        import redis as redis_sync

        client = redis_sync.Redis.from_url(REDIS_TEST_URL, socket_connect_timeout=1)
        client.ping()
        client.close()
        return True
    except Exception:
        return False


requires_redis = pytest.mark.skipif(
    not _redis_reachable(),
    reason=f"no reachable Redis at {REDIS_TEST_URL} (start one to run this test)",
)


class _Clock:
    def __init__(self):
        self.t = 0.0

    def __call__(self):
        return self.t


# ── Protocol conformance ─────────────────────────────────────────────────────


def test_in_memory_store_satisfies_protocol():
    assert isinstance(InMemoryTokenBucketStore(), TokenBucketStore)


@requires_redis
def test_redis_store_satisfies_protocol():
    import redis.asyncio as redis_asyncio

    from src.ratelimit.redis_store import RedisTokenBucketStore

    client = redis_asyncio.Redis.from_url(REDIS_TEST_URL)
    store = RedisTokenBucketStore(client)
    assert isinstance(store, TokenBucketStore)


# ── Fail-open behavior (no real Redis needed — client is mocked) ───────────


class _RaisingScript:
    async def __call__(self, *args, **kwargs):
        import redis.exceptions

        raise redis.exceptions.ConnectionError("simulated Redis outage")


class _RaisingRedisClient:
    """Stands in for redis.asyncio.Redis: register_script() call itself never
    fails (mirrors real client behavior — scripts are only sent on first
    invocation), but invoking the returned script raises."""

    def register_script(self, _script: str):
        return _RaisingScript()


async def test_consume_fails_open_on_redis_connection_error():
    from src.ratelimit.redis_store import RedisTokenBucketStore

    store = RedisTokenBucketStore(_RaisingRedisClient())
    decision = await store.consume("k", rate=1, capacity=10)

    assert decision.allowed is True
    assert decision.remaining == 10
    assert decision.limit == 10


async def test_consume_fails_open_repeatedly_without_raising():
    from src.ratelimit.redis_store import RedisTokenBucketStore

    store = RedisTokenBucketStore(_RaisingRedisClient())
    for _ in range(5):
        decision = await store.consume("k", rate=1, capacity=5)
        assert decision.allowed is True


# ── Parity: Lua script math must match bucket.py's Python math exactly ──────


@requires_redis
@pytest.mark.parametrize(
    "rate,capacity,cost,elapsed_sequence",
    [
        (1.0, 10.0, 1.0, [0, 0, 0, 0]),  # burst then block
        (2.0, 10.0, 1.0, [0, 0.5, 0.5, 0.5]),  # steady refill keeps up
        (1.0, 3.0, 1.0, [0, 0, 0, 0, 2.0]),  # exhaust, then refill after gap
        (5.0, 5.0, 2.0, [0, 0, 0]),  # higher cost per call
        (2.0, 20.0, 1.0, [0, 1000.0]),  # refill capped at capacity
    ],
)
async def test_lua_script_matches_python_bucket_math(
    rate, capacity, cost, elapsed_sequence
):
    import redis.asyncio as redis_asyncio

    from src.ratelimit.redis_store import RedisTokenBucketStore

    client = redis_asyncio.Redis.from_url(REDIS_TEST_URL)
    key = f"parity-test:{rate}:{capacity}:{cost}:{elapsed_sequence}"
    await client.delete(f"ratelimit:{key}")

    clock = _Clock()
    store = RedisTokenBucketStore(client, clock=clock)

    # Python reference implementation, driven with the same elapsed-time
    # sequence and starting state (full bucket at t=0).
    py_tokens = capacity
    py_last_ts = 0.0
    now = 0.0

    try:
        for elapsed in elapsed_sequence:
            now += elapsed
            py_result = refill_and_consume(
                tokens=py_tokens,
                last_ts=py_last_ts,
                now=now,
                rate=rate,
                capacity=capacity,
                cost=cost,
            )
            py_tokens = py_result.tokens
            py_last_ts = now

            clock.t = now
            redis_decision = await store.consume(
                key, rate=rate, capacity=capacity, cost=cost
            )

            assert redis_decision.allowed == py_result.allowed, (
                f"allowed mismatch at now={now}: "
                f"redis={redis_decision.allowed} python={py_result.allowed}"
            )
            assert redis_decision.remaining == pytest.approx(int(py_tokens), abs=1), (
                f"remaining mismatch at now={now}: "
                f"redis={redis_decision.remaining} python={py_tokens}"
            )
    finally:
        await client.delete(f"ratelimit:{key}")
        await client.aclose()


@requires_redis
async def test_lua_script_denies_when_empty_and_reports_retry_after():
    import redis.asyncio as redis_asyncio

    from src.ratelimit.redis_store import RedisTokenBucketStore

    client = redis_asyncio.Redis.from_url(REDIS_TEST_URL)
    key = "parity-retry-after"
    await client.delete(f"ratelimit:{key}")

    clock = _Clock()
    store = RedisTokenBucketStore(client, clock=clock)

    # Drain the 10-token bucket at rate=2/s.
    for _ in range(10):
        await store.consume(key, rate=2, capacity=10)

    decision = await store.consume(key, rate=2, capacity=10)
    assert decision.allowed is False
    assert decision.retry_after == pytest.approx(0.5)  # 1 token / 2 per sec

    await client.delete(f"ratelimit:{key}")
    await client.aclose()


@requires_redis
async def test_lua_script_zero_rate_is_infinite_retry():
    import redis.asyncio as redis_asyncio

    from src.ratelimit.redis_store import RedisTokenBucketStore

    client = redis_asyncio.Redis.from_url(REDIS_TEST_URL)
    key = "parity-zero-rate"
    await client.delete(f"ratelimit:{key}")

    store = RedisTokenBucketStore(client)
    await store.consume(key, rate=0, capacity=1)  # consumes the only token
    decision = await store.consume(key, rate=0, capacity=1)

    assert decision.allowed is False
    assert decision.retry_after == float("inf")

    await client.delete(f"ratelimit:{key}")
    await client.aclose()


@requires_redis
async def test_lua_script_keys_are_independent():
    import redis.asyncio as redis_asyncio

    from src.ratelimit.redis_store import RedisTokenBucketStore

    client = redis_asyncio.Redis.from_url(REDIS_TEST_URL)
    await client.delete("ratelimit:parity-indep-a", "ratelimit:parity-indep-b")

    store = RedisTokenBucketStore(client)
    await store.consume("parity-indep-a", rate=1, capacity=1)
    assert (await store.consume("parity-indep-a", rate=1, capacity=1)).allowed is False
    assert (await store.consume("parity-indep-b", rate=1, capacity=1)).allowed is True

    await client.delete("ratelimit:parity-indep-a", "ratelimit:parity-indep-b")
    await client.aclose()
