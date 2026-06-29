"""Unit tests for the notifications notify() helper + repo SQL shape."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from src.notifications import notify
from src.notifications.repo import NotificationsRepo


def _db():
    db = MagicMock()
    db.store = MagicMock()
    db.store.query_raw = AsyncMock(return_value=[{"id": "n1"}])
    return db


@pytest.mark.asyncio
async def test_notify_fans_out_skipping_actor_and_dupes():
    db = _db()
    written = await notify(
        db,
        workspace_id="ws",
        user_ids=["u1", "u2", "u1", "actor", ""],
        type="mention",
        title="X mentioned you",
        actor_id="actor",
    )
    # u1 (once), u2 — actor + blank + duplicate skipped.
    assert written == 2
    assert db.store.query_raw.await_count == 2


@pytest.mark.asyncio
async def test_notify_is_best_effort_on_db_error():
    db = MagicMock()
    db.store = MagicMock()
    db.store.query_raw = AsyncMock(side_effect=RuntimeError("db down"))
    written = await notify(
        db, workspace_id="ws", user_ids=["u1"], type="mention", title="hi"
    )
    assert written == 0  # swallowed, never raised


@pytest.mark.asyncio
async def test_repo_unread_count_parses_row():
    db = _db()
    db.store.query_raw = AsyncMock(return_value=[{"n": 3}])
    repo = NotificationsRepo(db)
    assert await repo.unread_count(workspace_id="ws", user_id="u1") == 3


@pytest.mark.asyncio
async def test_repo_mark_read_returns_false_when_no_row():
    db = _db()
    db.store.query_raw = AsyncMock(return_value=[])
    repo = NotificationsRepo(db)
    ok = await repo.mark_read(notification_id="n1", workspace_id="ws", user_id="u1")
    assert ok is False
