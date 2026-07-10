"""Selects and lazily constructs the rate-limit store based on settings.

Mirrors the module-level singleton `get_X()` / `close_X()` pattern used
elsewhere in this codebase for long-lived resources. `get_rate_limit_store()`
is called once at app-build time (before the lifespan's startup even runs,
since `app.add_middleware` needs the instance immediately);
`close_rate_limit_store()` is called from the lifespan's shutdown so a Redis
connection pool never leaks.
"""

from __future__ import annotations

from typing import Optional
from urllib.parse import urlsplit

from shared.config import settings

from ..observability import get_logger
from .store import InMemoryTokenBucketStore, TokenBucketStore

logger = get_logger(__name__)

_store: Optional[TokenBucketStore] = None
_redis_client = None  # redis.asyncio.Redis, only set when RATE_LIMIT_STORE=redis


def get_rate_limit_store() -> TokenBucketStore:
    """Return the process-wide rate-limit store, constructing it on first
    call per the RATE_LIMIT_STORE setting ("memory" default, or "redis")."""
    global _store, _redis_client

    if _store is not None:
        return _store

    if settings.RATE_LIMIT_STORE == "redis":
        import redis.asyncio as redis_asyncio

        from .redis_store import RedisTokenBucketStore

        _redis_client = redis_asyncio.Redis.from_url(settings.REDIS_URL)
        _store = RedisTokenBucketStore(_redis_client)
        # Never log settings.REDIS_URL directly: it commonly embeds
        # credentials (redis://user:pass@host:6379/0). Log only host:port/db.
        parsed = urlsplit(settings.REDIS_URL)
        safe_target = f"{parsed.hostname or ''}:{parsed.port or ''}{parsed.path or ''}"
        logger.info("ratelimit.store_selected", backend="redis", target=safe_target)
    else:
        _store = InMemoryTokenBucketStore()
        logger.info("ratelimit.store_selected", backend="memory")
        if settings.RATE_LIMIT_REPLICA_HINT > 1:
            # Each replica keeps an independent in-memory bucket, so every
            # configured ceiling (including the brute-force-resistant
            # login/signup "auth" tier) is silently multiplied by the
            # replica count. Warn loudly at boot instead of failing silently
            # at runtime.
            logger.warning(
                "ratelimit.in_memory_store_with_multiple_replicas",
                replica_hint=settings.RATE_LIMIT_REPLICA_HINT,
                message=(
                    "RATE_LIMIT_STORE=memory with "
                    f"{settings.RATE_LIMIT_REPLICA_HINT} replicas expected: "
                    "every rate limit's effective ceiling is now ~"
                    f"{settings.RATE_LIMIT_REPLICA_HINT}x the configured "
                    "value, since each replica's token bucket is independent. "
                    "Set RATE_LIMIT_STORE=redis (+ REDIS_URL) to share bucket "
                    "state across replicas."
                ),
            )

    return _store


async def close_rate_limit_store() -> None:
    """Release the Redis connection pool (if one was opened). Safe to call
    even when the memory store (or no store) was ever constructed."""
    global _store, _redis_client

    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None
    _store = None
