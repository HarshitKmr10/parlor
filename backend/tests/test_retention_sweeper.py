"""Tests for RetentionSweeper.run_once()'s two-phase delete orchestration.

Phase 1 (soft-delete) and phase 2 (hard-delete) are driven off two independent
repo snapshots (`meeting_dates` / `tombstoned_meetings`) each sweep. This
exercises the orchestration logic with a fake repo -- the repo's own SQL/
legal-hold behavior is covered by tests/test_compliance_retention_repo.py.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List
from unittest.mock import AsyncMock

import pytest

from src.services import retention_sweeper as sweeper_module
from src.services.retention_sweeper import RetentionSweeper

NOW = datetime(2026, 6, 29, 12, 0, tzinfo=timezone.utc)
WORKSPACE_ID = "00000000-0000-0000-0000-000000000042"


class _FakeRetentionRepo:
    def __init__(
        self,
        *,
        retention_days: int | None,
        legal_hold: bool,
        not_yet_deleted: List[Dict[str, Any]],
        already_tombstoned: List[Dict[str, Any]],
    ) -> None:
        self._setting = {
            "workspace_id": WORKSPACE_ID,
            "retention_days": retention_days,
            "legal_hold": legal_hold,
        }
        self._not_yet_deleted = not_yet_deleted
        self._already_tombstoned = already_tombstoned
        self.soft_deleted_ids: List[str] = []
        self.hard_deleted_ids: List[str] = []
        self.marked_swept: List[str] = []

    async def list_all(self):
        return [self._setting]

    async def meeting_dates(self, workspace_id: str):
        assert workspace_id == WORKSPACE_ID
        return self._not_yet_deleted

    async def tombstoned_meetings(self, workspace_id: str):
        assert workspace_id == WORKSPACE_ID
        return self._already_tombstoned

    async def soft_delete_meetings(self, workspace_id: str, ids: List[str]) -> int:
        self.soft_deleted_ids.extend(ids)
        return len(ids)

    async def hard_delete_meetings(self, workspace_id: str, ids: List[str]) -> int:
        self.hard_deleted_ids.extend(ids)
        return len(ids)

    async def mark_swept(self, workspace_id: str) -> None:
        self.marked_swept.append(workspace_id)


@pytest.fixture
def patch_db(monkeypatch):
    """`run_once` lazily imports get_db_connection from api.database.connection
    -- stub it so no real DB is touched."""
    import src.api.database.connection as db_module

    monkeypatch.setattr(db_module, "get_db_connection", AsyncMock(return_value=object()))


def _install_fake_repo(monkeypatch, fake_repo: _FakeRetentionRepo) -> None:
    monkeypatch.setattr(sweeper_module, "RetentionRepo", lambda db: fake_repo)


@pytest.mark.asyncio
async def test_first_sweep_past_retention_soft_deletes(monkeypatch, patch_db):
    fake_repo = _FakeRetentionRepo(
        retention_days=30,
        legal_hold=False,
        not_yet_deleted=[{"id": "m1", "created_at": NOW - timedelta(days=40)}],
        already_tombstoned=[],
    )
    _install_fake_repo(monkeypatch, fake_repo)

    total = await RetentionSweeper().run_once(now=NOW)

    assert total == 1
    assert fake_repo.soft_deleted_ids == ["m1"]
    assert fake_repo.hard_deleted_ids == []
    assert fake_repo.marked_swept == [WORKSPACE_ID]


@pytest.mark.asyncio
async def test_hard_delete_only_fires_after_tombstone_days_past_soft_delete(
    monkeypatch, patch_db
):
    monkeypatch.setattr(sweeper_module, "RETENTION_TOMBSTONE_DAYS", 30)

    # Soft-deleted 10 days ago -- inside the recovery window, must not hard-delete.
    fake_repo = _FakeRetentionRepo(
        retention_days=30,
        legal_hold=False,
        not_yet_deleted=[],
        already_tombstoned=[{"id": "m1", "deleted_at": NOW - timedelta(days=10)}],
    )
    _install_fake_repo(monkeypatch, fake_repo)

    total = await RetentionSweeper().run_once(now=NOW)

    assert total == 0
    assert fake_repo.hard_deleted_ids == []


@pytest.mark.asyncio
async def test_hard_delete_fires_once_past_tombstone_window(monkeypatch, patch_db):
    monkeypatch.setattr(sweeper_module, "RETENTION_TOMBSTONE_DAYS", 30)

    fake_repo = _FakeRetentionRepo(
        retention_days=30,
        legal_hold=False,
        not_yet_deleted=[],
        already_tombstoned=[{"id": "m1", "deleted_at": NOW - timedelta(days=31)}],
    )
    _install_fake_repo(monkeypatch, fake_repo)

    total = await RetentionSweeper().run_once(now=NOW)

    assert total == 1
    assert fake_repo.hard_deleted_ids == ["m1"]


@pytest.mark.asyncio
async def test_legal_hold_blocks_both_phases(monkeypatch, patch_db):
    monkeypatch.setattr(sweeper_module, "RETENTION_TOMBSTONE_DAYS", 30)

    fake_repo = _FakeRetentionRepo(
        retention_days=30,
        legal_hold=True,
        not_yet_deleted=[{"id": "m1", "created_at": NOW - timedelta(days=400)}],
        already_tombstoned=[{"id": "m2", "deleted_at": NOW - timedelta(days=400)}],
    )
    _install_fake_repo(monkeypatch, fake_repo)

    total = await RetentionSweeper().run_once(now=NOW)

    assert total == 0
    assert fake_repo.soft_deleted_ids == []
    assert fake_repo.hard_deleted_ids == []
    # Still marks swept so `last_swept_at` reflects the sweeper actually ran.
    assert fake_repo.marked_swept == [WORKSPACE_ID]
