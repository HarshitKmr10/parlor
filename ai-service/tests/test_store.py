"""Unit tests for EmbeddingStore's init() pool lifecycle.

Forward-ported from upstream fix (ai-service): close asyncpg pool on partial
init failure. Only the pool-lifecycle regression tests are ported here (the
upstream test_store.py also carries owner_user_id/person-scoped-RAG coverage
that depends on twin-specific work not present in this repo).
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

from app.rag.store import EmbeddingStore


async def test_init_closes_pool_when_ddl_fails_after_pool_creation():
    """Regression: if create_pool succeeds but a DDL statement then raises,
    the already-open pool must be closed, not just dropped on the floor."""
    mock_conn = AsyncMock()
    mock_conn.execute.side_effect = RuntimeError("boom")

    mock_acquire_ctx = AsyncMock()
    mock_acquire_ctx.__aenter__.return_value = mock_conn

    mock_pool = MagicMock()
    mock_pool.acquire = MagicMock(return_value=mock_acquire_ctx)
    mock_pool.close = AsyncMock()

    with patch("app.rag.store.asyncpg.create_pool", AsyncMock(return_value=mock_pool)):
        s = EmbeddingStore("postgresql://irrelevant/for-this-test")
        await s.init()

    assert s.ready is False
    mock_pool.close.assert_awaited_once()


async def test_init_does_not_call_close_when_create_pool_itself_fails():
    """When create_pool raises before a pool ever exists, there is nothing to
    close -- init should not error trying to close a pool that was never made."""
    with patch(
        "app.rag.store.asyncpg.create_pool",
        AsyncMock(side_effect=RuntimeError("connection refused")),
    ):
        s = EmbeddingStore("postgresql://irrelevant/for-this-test")
        await s.init()  # must not raise

    assert s.ready is False
