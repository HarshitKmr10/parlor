"""Unit tests for meeting comments repo: scoping, mention filtering, names."""

import uuid
from unittest.mock import AsyncMock

import pytest

from src.comments import CommentsRepo


@pytest.mark.asyncio
async def test_filter_members_returns_only_workspace_members():
    db = AsyncMock()
    # DB returns the subset that are actually members.
    db.store.query_raw = AsyncMock(return_value=[{"user_id": "u1"}, {"user_id": "u2"}])
    repo = CommentsRepo(db)
    members = await repo.filter_members("w1", ["u1", "u2", "outsider"])
    assert members == ["u1", "u2"]
    sql, *params = db.store.query_raw.await_args.args
    assert "workspace_id = $1::uuid" in sql and "= ANY($2::uuid[])" in sql
    assert params[0] == "w1"


@pytest.mark.asyncio
async def test_filter_members_empty_short_circuits():
    db = AsyncMock()
    db.store.query_raw = AsyncMock()
    repo = CommentsRepo(db)
    assert await repo.filter_members("w1", []) == []
    db.store.query_raw.assert_not_called()


@pytest.mark.asyncio
async def test_filter_members_dedupes_input():
    db = AsyncMock()
    db.store.query_raw = AsyncMock(return_value=[{"user_id": "u1"}])
    repo = CommentsRepo(db)
    await repo.filter_members("w1", ["u1", "u1", "u1"])
    _, *params = db.store.query_raw.await_args.args
    assert params[1] == ["u1"]  # deduped


@pytest.mark.asyncio
async def test_names_for_maps_id_to_name():
    db = AsyncMock()
    db.store.query_raw = AsyncMock(
        return_value=[{"id": "u1", "name": "Alice"}, {"id": "u2", "name": "Bob"}]
    )
    repo = CommentsRepo(db)
    names = await repo.names_for(["u1", "u2"])
    assert names == {"u1": "Alice", "u2": "Bob"}


@pytest.mark.asyncio
async def test_names_for_empty_returns_empty():
    db = AsyncMock()
    db.store.query_raw = AsyncMock()
    repo = CommentsRepo(db)
    assert await repo.names_for([]) == {}
    db.store.query_raw.assert_not_called()


@pytest.mark.asyncio
async def test_list_for_meeting_is_workspace_scoped():
    db = AsyncMock()
    db.store.query_raw = AsyncMock(return_value=[])
    repo = CommentsRepo(db)
    await repo.list_for_meeting("m1", "w1")
    sql, *params = db.store.query_raw.await_args.args
    assert "workspace_id = $2::uuid" in sql
    assert params == ["m1", "w1"]


@pytest.mark.asyncio
async def test_normalize_stringifies_uuids_and_mentions():
    mid, wid, aid = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    mention = uuid.uuid4()
    db = AsyncMock()
    db.store.query_raw = AsyncMock(
        return_value=[
            {
                "id": uuid.uuid4(),
                "meeting_id": mid,
                "workspace_id": wid,
                "author_id": aid,
                "parent_id": None,
                "body": "hi @bob",
                "anchor_t_sec": 12.5,
                "anchor_segment_id": "seg-3",
                "mentioned_user_ids": [mention],
                "resolved": False,
                "edited": False,
                "created_at": "2026-01-01T00:00:00Z",
                "updated_at": None,
            }
        ]
    )
    repo = CommentsRepo(db)
    row = await repo.get("c1", "w1")
    assert isinstance(row["meeting_id"], str)
    assert row["mentioned_user_ids"] == [str(mention)]
    assert row["parent_id"] is None


@pytest.mark.asyncio
async def test_delete_returns_false_when_no_row():
    db = AsyncMock()
    db.store.query_raw = AsyncMock(return_value=[])
    repo = CommentsRepo(db)
    assert await repo.delete("c1", "w1") is False
