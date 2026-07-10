"""Unit tests for the audit writer (best-effort) + repo SQL params."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from src.audit import record_audit
from src.audit.repo import AuditRepo


def _db():
    db = MagicMock()
    db.store = MagicMock()
    db.store.query_raw = AsyncMock(return_value=[{"id": "a1"}])
    return db


@pytest.mark.asyncio
async def test_record_audit_writes():
    db = _db()
    await record_audit(
        db,
        workspace_id="ws",
        actor_id="u1",
        action="share.created",
        resource_type="meeting",
        resource_id="m1",
        metadata={"x": 1},
    )
    assert db.store.query_raw.await_count == 1


@pytest.mark.asyncio
async def test_record_audit_is_best_effort():
    db = MagicMock()
    db.store = MagicMock()
    db.store.query_raw = AsyncMock(side_effect=RuntimeError("db down"))
    # Must not raise.
    await record_audit(
        db, workspace_id="ws", actor_id=None, action="meeting.deleted",
        resource_type="meeting", resource_id="m1",
    )


@pytest.mark.asyncio
async def test_repo_list_passes_limit():
    db = _db()
    db.store.query_raw = AsyncMock(return_value=[])
    await AuditRepo(db).list("ws", limit=25)
    args = db.store.query_raw.await_args.args
    assert args[-2] == 25
    assert args[-1] == 0
