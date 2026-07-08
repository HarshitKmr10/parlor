"""Unit tests for token-bucket rate limiting: algorithm, store, key derivation."""

from unittest.mock import AsyncMock, patch

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


# ── cross-tenant share-link bucket scoping ──────────────────────────────────
#
# Regression coverage for: two different workspaces' anonymous share-link
# viewers behind the same NAT/corporate-proxy IP must not collide into the
# same rate-limit bucket, since that lets one workspace's heavily-used (or
# abused) public share link starve an unrelated workspace's viewers.


def test_workspace_scope_partitions_ip_fallback_bucket():
    key_a = principal_key(
        api_key=None,
        authorization=None,
        client_host="1.2.3.4",
        workspace_scope="workspace-a",
    )
    key_b = principal_key(
        api_key=None,
        authorization=None,
        client_host="1.2.3.4",
        workspace_scope="workspace-b",
    )
    assert key_a != key_b
    assert key_a == "ip:workspace-a:1.2.3.4"


def test_workspace_scope_ignored_when_authenticated():
    # A key/bearer principal is already precisely scoped; workspace_scope
    # must not change that key.
    assert principal_key(
        api_key="sk_live_abc",
        authorization=None,
        client_host="1.2.3.4",
        workspace_scope="workspace-a",
    ) == principal_key(
        api_key="sk_live_abc", authorization=None, client_host="1.2.3.4"
    )


def test_workspace_scope_none_is_backward_compatible():
    assert (
        principal_key(api_key=None, authorization=None, client_host="1.2.3.4")
        == "ip:1.2.3.4"
    )


class TestShareScopeResolver:
    def setup_method(self):
        from src.ratelimit import share_scope

        share_scope.clear_cache()

    def teardown_method(self):
        from src.ratelimit import share_scope

        share_scope.clear_cache()

    def test_share_token_from_path_matches_public_share_route(self):
        from src.ratelimit.share_scope import share_token_from_path

        assert share_token_from_path("/api/v1/public/shares/abc123") == "abc123"
        assert share_token_from_path("/api/v1/meetings") is None
        assert share_token_from_path("/api/v1/public/shares/abc123/") == "abc123"

    @pytest.mark.asyncio
    async def test_resolve_share_workspace_id_returns_owning_workspace(self):
        from src.ratelimit.share_scope import resolve_share_workspace_id

        with patch(
            "src.sharing.SharesRepo.get_by_token",
            new=AsyncMock(return_value={"workspace_id": "ws-1"}),
        ), patch(
            "src.api.database.connection.get_db_connection",
            new=AsyncMock(return_value=object()),
        ):
            assert await resolve_share_workspace_id("tok-a") == "ws-1"

    @pytest.mark.asyncio
    async def test_resolve_share_workspace_id_caches_result(self):
        from src.ratelimit.share_scope import resolve_share_workspace_id

        lookup = AsyncMock(return_value={"workspace_id": "ws-1"})
        with patch("src.sharing.SharesRepo.get_by_token", new=lookup), patch(
            "src.api.database.connection.get_db_connection",
            new=AsyncMock(return_value=object()),
        ):
            await resolve_share_workspace_id("tok-cached")
            await resolve_share_workspace_id("tok-cached")

        lookup.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_resolve_share_workspace_id_fails_open_on_error(self):
        from src.ratelimit.share_scope import resolve_share_workspace_id

        with patch(
            "src.sharing.SharesRepo.get_by_token",
            new=AsyncMock(side_effect=RuntimeError("db down")),
        ), patch(
            "src.api.database.connection.get_db_connection",
            new=AsyncMock(return_value=object()),
        ):
            assert await resolve_share_workspace_id("tok-error") is None

    @pytest.mark.asyncio
    async def test_resolve_share_workspace_id_unknown_token_returns_none(self):
        from src.ratelimit.share_scope import resolve_share_workspace_id

        with patch(
            "src.sharing.SharesRepo.get_by_token", new=AsyncMock(return_value=None)
        ), patch(
            "src.api.database.connection.get_db_connection",
            new=AsyncMock(return_value=object()),
        ):
            assert await resolve_share_workspace_id("tok-unknown") is None


class TestRateLimitMiddlewareShareScoping:
    @staticmethod
    def _make_request(path: str, client_host: str = "9.9.9.9"):
        from starlette.requests import Request

        scope = {
            "type": "http",
            "method": "GET",
            "path": path,
            "headers": [],
            "client": (client_host, 12345),
            "query_string": b"",
        }
        return Request(scope)

    @staticmethod
    async def _call_next(_request):
        from starlette.responses import Response

        return Response(status_code=200)

    @pytest.mark.asyncio
    async def test_two_workspaces_same_ip_get_different_buckets(self):
        from src.ratelimit.middleware import RateLimitMiddleware
        from src.ratelimit import share_scope

        share_scope.clear_cache()
        store = InMemoryTokenBucketStore()
        middleware = RateLimitMiddleware(app=None, store=store)

        async def fake_resolve(token: str):
            return {"tok-a": "workspace-a", "tok-b": "workspace-b"}[token]

        with patch(
            "src.ratelimit.middleware.resolve_share_workspace_id",
            new=fake_resolve,
        ):
            await middleware.dispatch(
                self._make_request("/api/v1/public/shares/tok-a"), self._call_next
            )
            await middleware.dispatch(
                self._make_request("/api/v1/public/shares/tok-b"), self._call_next
            )

        bucket_keys = set(store._state.keys())
        assert "public:ip:workspace-a:9.9.9.9" in bucket_keys
        assert "public:ip:workspace-b:9.9.9.9" in bucket_keys

    @pytest.mark.asyncio
    async def test_share_resolution_error_falls_back_to_plain_ip_key(self):
        from src.ratelimit.middleware import RateLimitMiddleware

        store = InMemoryTokenBucketStore()
        middleware = RateLimitMiddleware(app=None, store=store)

        async def failing_resolve(_token: str):
            raise RuntimeError("db unreachable")

        with patch(
            "src.ratelimit.middleware.resolve_share_workspace_id",
            new=failing_resolve,
        ):
            await middleware.dispatch(
                self._make_request("/api/v1/public/shares/tok-c"), self._call_next
            )

        assert "public:ip:9.9.9.9" in set(store._state.keys())


def test_tier_for_brute_force_sensitive_auth_paths():
    assert tier_for_path("/api/v1/auth/login") == "auth"
    assert tier_for_path("/api/v1/auth/forgot-password") == "auth"
    assert tier_for_path("/api/v1/auth/reset-password") == "auth"
    # Unrelated /auth/* routes keep the default (unauthenticated-but-not-
    # brute-force-sensitive) tier.
    assert tier_for_path("/api/v1/auth/signup") == "default"
    assert tier_for_path("/api/v1/auth/me") == "default"
