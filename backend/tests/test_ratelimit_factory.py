"""Unit tests for the RATE_LIMIT_STORE store-selection factory."""

from __future__ import annotations

import pytest

from shared.config import settings
from src.ratelimit import factory
from src.ratelimit.store import InMemoryTokenBucketStore


@pytest.fixture(autouse=True)
async def _reset_factory_state():
    await factory.close_rate_limit_store()
    original_store = settings.RATE_LIMIT_STORE
    original_url = settings.REDIS_URL
    yield
    await factory.close_rate_limit_store()
    settings.RATE_LIMIT_STORE = original_store
    settings.REDIS_URL = original_url


def test_defaults_to_memory_store():
    settings.RATE_LIMIT_STORE = "memory"
    store = factory.get_rate_limit_store()
    assert isinstance(store, InMemoryTokenBucketStore)


def test_selects_redis_store_when_configured():
    from src.ratelimit.redis_store import RedisTokenBucketStore

    settings.RATE_LIMIT_STORE = "redis"
    settings.REDIS_URL = "redis://localhost:16379/0"
    store = factory.get_rate_limit_store()
    assert isinstance(store, RedisTokenBucketStore)


def test_store_is_a_singleton_across_calls():
    settings.RATE_LIMIT_STORE = "memory"
    first = factory.get_rate_limit_store()
    second = factory.get_rate_limit_store()
    assert first is second


async def test_close_releases_the_singleton():
    settings.RATE_LIMIT_STORE = "memory"
    first = factory.get_rate_limit_store()
    await factory.close_rate_limit_store()
    second = factory.get_rate_limit_store()
    assert first is not second
