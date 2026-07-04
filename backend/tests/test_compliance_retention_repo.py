"""Regression test for the retention sweeper's legal-hold TOCTOU race.

`RetentionRepo.delete_meetings` previously only checked `legal_hold` in the
earlier `list_all()` snapshot query, not at delete time. If a legal hold was
applied after that snapshot but before the DELETE actually ran, expired
meetings got hard-deleted anyway, defeating the hold. The fix folds a live
`NOT COALESCE(legal_hold, FALSE)` check into the DELETE's own WHERE clause so
each delete call re-validates hold status at the moment it runs, in the same
statement/connection.

There's no real Postgres available in this unit-test environment, so this
uses a tiny fake store that (a) asserts the generated SQL actually re-checks
`legal_hold` at delete time, and (b) simulates the race by flipping the hold
flag between the "snapshot" and the "delete" -- mirroring how
RetentionSweeper.run_once() calls list_all() then, later, delete_meetings().
"""

from __future__ import annotations

import pytest

from src.compliance.repo import RetentionRepo

WORKSPACE_ID = "00000000-0000-0000-0000-000000000099"
MEETING_ID = "10000000-0000-0000-0000-000000000001"


class _FakeStore:
    """Emulates just enough of the two DELETE statements `delete_meetings`
    issues to exercise the legal-hold race, keyed off distinguishing SQL
    substrings (matching this repo's existing FakeStore test convention, see
    tests/test_database_connection_schema.py)."""

    def __init__(self, *, legal_hold: bool, meeting_ids: set[str]) -> None:
        self.legal_hold = legal_hold
        self.meeting_ids = set(meeting_ids)
        self.embedding_ids = set(meeting_ids)
        self.calls: list[tuple[str, tuple]] = []

    async def query_raw(self, sql: str, *params):
        self.calls.append((sql, params))
        # Every statement in delete_meetings must re-check legal_hold live.
        assert "legal_hold" in sql, f"query missing live legal_hold check: {sql}"

        if self.legal_hold:
            return []

        if "DELETE FROM meeting_embeddings" in sql:
            _workspace_id, ids = params
            removed = [mid for mid in ids if mid in self.embedding_ids]
            self.embedding_ids -= set(removed)
            return [{"meeting_id": mid} for mid in removed]

        if "DELETE FROM meeting_joiner" in sql:
            _workspace_id, ids = params
            removed = [mid for mid in ids if mid in self.meeting_ids]
            self.meeting_ids -= set(removed)
            return [{"id": mid} for mid in removed]

        raise AssertionError(f"unexpected query: {sql}")


class _Db:
    def __init__(self, store: _FakeStore) -> None:
        self.store = store


@pytest.mark.asyncio
async def test_delete_meetings_deletes_when_no_legal_hold():
    store = _FakeStore(legal_hold=False, meeting_ids={MEETING_ID})
    repo = RetentionRepo(_Db(store))

    deleted = await repo.delete_meetings(WORKSPACE_ID, [MEETING_ID])

    assert deleted == 1
    assert MEETING_ID not in store.meeting_ids


@pytest.mark.asyncio
async def test_delete_meetings_survives_legal_hold_applied_after_snapshot():
    """Reproduces the TOCTOU race: a meeting is selected for deletion from an
    earlier snapshot (legal_hold was False then), but a hold is applied to
    the workspace before delete_meetings() actually runs. The meeting must
    survive because the DELETE itself re-checks the *current* hold state."""
    store = _FakeStore(legal_hold=False, meeting_ids={MEETING_ID})
    repo = RetentionRepo(_Db(store))

    # Simulate: list_all()/select_expired() already ran and produced
    # [MEETING_ID] as expired+eligible. Before delete_meetings() executes,
    # someone applies a legal hold to the workspace.
    store.legal_hold = True

    deleted = await repo.delete_meetings(WORKSPACE_ID, [MEETING_ID])

    assert deleted == 0
    assert MEETING_ID in store.meeting_ids  # meeting survives the sweep


@pytest.mark.asyncio
async def test_delete_meetings_where_clause_scopes_hold_check_to_workspace():
    store = _FakeStore(legal_hold=False, meeting_ids={MEETING_ID})
    repo = RetentionRepo(_Db(store))

    await repo.delete_meetings(WORKSPACE_ID, [MEETING_ID])

    for sql, params in store.calls:
        assert "workspace_retention_settings" in sql
        assert params[0] == WORKSPACE_ID
