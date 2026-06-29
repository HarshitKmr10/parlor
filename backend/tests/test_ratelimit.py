"""Unit tests for token-bucket rate limiting: algorithm, store, key derivation."""

import pytest

from src.ratelimit.bucket import refill_and_consume
from src.ratelimit.keys import principal_key, tier_for_path
from src.ratelimit.store import InMemoryTokenBucketStore

# ── pure bucket ─────────────────────────────────────────────────────────────


def test_allows_when_tokens_available():
    r = refill_and_consume(tokens=5, last_ts=0, now=0, rate=1, capacity=10)
    assert r.allowed is True
    assert r.tokens == 4
    assert r.retry_after == 0.0


def test_denies_when_empty_and_reports_retry_after():
    r = refill_and_consume(tokens=0, last_ts=0, now=0, rate=2, capacity=10)
    assert r.allowed is False
    assert r.retry_after == pytest.approx(0.5)  # 1 token / 2 per sec


def test_refills_over_elapsed_time():
    # Empty at t=0; 3s later at 2 tokens/sec → 6 tokens, consume 1 → 5 left.
    r = refill_and_consume(tokens=0, last_ts=0, now=3, rate=2, capacity=10)
    assert r.allowed is True
    assert r.tokens == pytest.approx(5)


def test_refill_capped_at_capacity():
    r = refill_and_consume(tokens=0, last_ts=0, now=1000, rate=2, capacity=10)
    assert r.tokens == pytest.approx(9)  # capped at 10 then -1


def test_zero_rate_is_infinite_retry():
    r = refill_and_consume(tokens=0, last_ts=0, now=0, rate=0, capacity=10)
    assert r.allowed is False
    assert r.retry_after == float("inf")


# ── store ───────────────────────────────────────────────────────────────────


class _Clock:
    def __init__(self):
        self.t = 0.0

    def __call__(self):
        return self.t


@pytest.mark.asyncio
async def test_store_allows_burst_then_blocks():
    clock = _Clock()
    store = InMemoryTokenBucketStore(clock=clock)
    # capacity 3, rate 1/s; first 3 allowed, 4th blocked (no time elapsed).
    results = [await store.consume("k", rate=1, capacity=3) for _ in range(4)]
    assert [r.allowed for r in results] == [True, True, True, False]
    assert results[-1].retry_after == pytest.approx(1.0)
    assert results[-1].remaining == 0


@pytest.mark.asyncio
async def test_store_refills_after_time_passes():
    clock = _Clock()
    store = InMemoryTokenBucketStore(clock=clock)
    for _ in range(3):
        await store.consume("k", rate=1, capacity=3)
    assert (await store.consume("k", rate=1, capacity=3)).allowed is False
    clock.t = 2.0  # 2 tokens refill
    assert (await store.consume("k", rate=1, capacity=3)).allowed is True


@pytest.mark.asyncio
async def test_store_keys_are_independent():
    store = InMemoryTokenBucketStore(clock=_Clock())
    await store.consume("a", rate=1, capacity=1)
    # 'a' is now empty, but 'b' has its own full bucket.
    assert (await store.consume("a", rate=1, capacity=1)).allowed is False
    assert (await store.consume("b", rate=1, capacity=1)).allowed is True


# ── key derivation ──────────────────────────────────────────────────────────


def test_api_key_takes_precedence():
    k = principal_key(
        api_key="sk_live_abc", authorization="Bearer jwt", client_host="1.2.3.4"
    )
    assert k.startswith("key:")


def test_bearer_used_when_no_api_key():
    k = principal_key(api_key=None, authorization="Bearer jwt", client_host="1.2.3.4")
    assert k.startswith("user:")


def test_ip_fallback_when_anonymous():
    k = principal_key(api_key=None, authorization=None, client_host="1.2.3.4")
    assert k == "ip:1.2.3.4"


def test_secret_is_hashed_not_embedded():
    k = principal_key(api_key="super-secret-key", authorization=None, client_host=None)
    assert "super-secret-key" not in k


def test_tier_for_public_path():
    assert tier_for_path("/api/v1/public/shares/tok") == "public"
    assert tier_for_path("/api/v1/meetings") == "default"
