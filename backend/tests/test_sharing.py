"""Unit tests for public meeting share links: tokens, expiry, repo scoping."""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest

from src.sharing import SharesRepo, generate_share_token, is_share_active

# ── tokens ──────────────────────────────────────────────────────────────────


def test_generate_token_is_long_and_unique():
    a, b = generate_share_token(), generate_share_token()
    assert a != b
    assert len(a) >= 40  # 32 bytes url-safe ≈ 43 chars
    assert "/" not in a and "+" not in a  # url-safe alphabet


# ── is_share_active ─────────────────────────────────────────────────────────


def test_active_when_not_revoked_and_no_expiry():
    assert is_share_active(revoked=False, expires_at=None) is True


def test_inactive_when_revoked():
    future = datetime.now(timezone.utc) + timedelta(days=1)
    assert is_share_active(revoked=True, expires_at=future) is False


def test_inactive_when_expired():
    past = datetime.now(timezone.utc) - timedelta(seconds=1)
    assert is_share_active(revoked=False, expires_at=past) is False


def test_active_before_expiry():
    future = datetime.now(timezone.utc) + timedelta(days=1)
    assert is_share_active(revoked=False, expires_at=future) is True


def test_naive_expiry_treated_as_utc():
    # asyncpg may hand back a naive datetime; must not raise and must compare.
    naive_future = (datetime.now(timezone.utc) + timedelta(days=1)).replace(tzinfo=None)
    assert is_share_active(revoked=False, expires_at=naive_future) is True


# ── SharesRepo (mocked) ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_for_meeting_is_workspace_scoped():
    db = AsyncMock()
    db.store.query_raw = AsyncMock(return_value=[])
    repo = SharesRepo(db)
    await repo.get_for_meeting("m1", "w1")
    sql, *params = db.store.query_raw.await_args.args
    assert "workspace_id = $2::uuid" in sql
    assert params == ["m1", "w1"]


@pytest.mark.asyncio
async def test_get_by_token_queries_token_only():
    db = AsyncMock()
    db.store.query_raw = AsyncMock(return_value=[])
    repo = SharesRepo(db)
    await repo.get_by_token("tok123")
    sql, *params = db.store.query_raw.await_args.args
    assert "WHERE token = $1" in sql
    assert params == ["tok123"]


@pytest.mark.asyncio
async def test_revoke_returns_false_when_no_row():
    db = AsyncMock()
    db.store.query_raw = AsyncMock(return_value=[])
    repo = SharesRepo(db)
    assert await repo.revoke("m1", "w1") is False


@pytest.mark.asyncio
async def test_upsert_normalizes_uuids():
    import uuid

    db = AsyncMock()
    db.store.query_raw = AsyncMock(
        return_value=[
            {
                "id": uuid.uuid4(),
                "meeting_id": uuid.uuid4(),
                "workspace_id": uuid.uuid4(),
                "created_by": None,
                "token": "t",
                "include_transcript": False,
                "include_highlights": True,
                "include_analytics": False,
                "revoked": False,
                "expires_at": None,
                "view_count": 0,
                "last_viewed_at": None,
                "created_at": None,
                "updated_at": None,
            }
        ]
    )
    repo = SharesRepo(db)
    row = await repo.upsert(
        meeting_id="m1",
        workspace_id="w1",
        created_by=None,
        token="t",
        include_transcript=False,
        include_highlights=True,
        include_analytics=False,
        expires_at=None,
    )
    assert isinstance(row["id"], str)
    assert isinstance(row["meeting_id"], str)
