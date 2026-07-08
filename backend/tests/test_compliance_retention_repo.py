"""Regression tests for the retention tombstone/recovery window.

`RetentionRepo` used to hard-delete expired meetings immediately
(`delete_meetings`). It now runs a two-phase delete:

  * `soft_delete_meetings` -- sets `deleted_at` and drops `meeting_embeddings`
    immediately (Phase 1, fires when a meeting crosses `retention_days`).
  * `hard_delete_meetings` -- permanently removes rows already soft-deleted
    for longer than `RETENTION_TOMBSTONE_DAYS` (Phase 2).
  * `restore_meeting` -- clears `deleted_at` on a still soft-deleted row.

Both delete phases must re-check `legal_hold` live in their own WHERE clause
(TOCTOU-safe pattern -- see the original bugfix this file replaces), not just
in an earlier snapshot query. There's no real Postgres available in this
unit-test environment, so this uses a tiny fake store that (a) asserts the
generated SQL actually re-checks `legal_hold` at write time, and (b) can
simulate the race by flipping the hold flag between the "snapshot" and the
"write" -- mirroring how RetentionSweeper.run_once() calls list_all() then,
later, soft_delete_meetings()/hard_delete_meetings().
"""

from __future__ import annotations

import pytest

from src.compliance.repo import RetentionRepo

WORKSPACE_ID = "00000000-0000-0000-0000-000000000099"
MEETING_ID = "10000000-0000-0000-0000-000000000001"


class _FakeStore:
    """Emulates just enough of the DELETE/UPDATE statements this repo issues
    to exercise the legal-hold race, keyed off distinguishing SQL substrings
    (matching this repo's existing FakeStore test convention, see
    tests/test_database_connection_schema.py)."""

    def __init__(
        self,
        *,
        legal_hold: bool,
        meeting_ids: set[str],
        deleted_ids: set[str] | None = None,
    ) -> None:
        self.legal_hold = legal_hold
        self.meeting_ids = set(meeting_ids)
        self.deleted_ids: set[str] = set(deleted_ids or set())
        self.embedding_ids = set(meeting_ids)
        self.calls: list[tuple[str, tuple]] = []

    async def query_raw(self, sql: str, *params):
        self.calls.append((sql, params))

        if "DELETE FROM meeting_embeddings" in sql:
            assert "legal_hold" in sql, f"query missing live legal_hold check: {sql}"
            if self.legal_hold:
                return []
            _workspace_id, ids = params
            removed = [mid for mid in ids if mid in self.embedding_ids]
            self.embedding_ids -= set(removed)
            return [{"meeting_id": mid} for mid in removed]

        if "UPDATE meeting_joiner SET deleted_at = now()" in sql:
            assert "legal_hold" in sql, f"query missing live legal_hold check: {sql}"
            if self.legal_hold:
                return []
            _workspace_id, ids = params
            eligible = [
                mid
                for mid in ids
                if mid in self.meeting_ids and mid not in self.deleted_ids
            ]
            self.deleted_ids |= set(eligible)
            return [{"id": mid} for mid in eligible]

        if "DELETE FROM meeting_joiner" in sql:
            assert "legal_hold" in sql, f"query missing live legal_hold check: {sql}"
            if self.legal_hold:
                return []
            _workspace_id, ids = params
            removed = [
                mid for mid in ids if mid in self.meeting_ids and mid in self.deleted_ids
            ]
            self.meeting_ids -= set(removed)
            self.deleted_ids -= set(removed)
            return [{"id": mid} for mid in removed]

        if "UPDATE meeting_joiner SET deleted_at = NULL" in sql:
            _workspace_id, meeting_id = params
            if meeting_id in self.deleted_ids:
                self.deleted_ids.discard(meeting_id)
                return [{"id": meeting_id}]
            return []

        raise AssertionError(f"unexpected query: {sql}")


class _Db:
    def __init__(self, store: _FakeStore) -> None:
        self.store = store


# ── Phase 1: soft_delete_meetings ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_soft_delete_meetings_tombstones_when_no_legal_hold():
    store = _FakeStore(legal_hold=False, meeting_ids={MEETING_ID})
    repo = RetentionRepo(_Db(store))

    soft_deleted = await repo.soft_delete_meetings(WORKSPACE_ID, [MEETING_ID])

    assert soft_deleted == 1
    assert MEETING_ID in store.deleted_ids  # row survives, just tombstoned
    assert MEETING_ID in store.meeting_ids
    assert MEETING_ID not in store.embedding_ids  # embeddings dropped immediately


@pytest.mark.asyncio
async def test_soft_delete_meetings_survives_legal_hold_applied_after_snapshot():
    """Reproduces the TOCTOU race: a meeting is selected for soft-delete from
    an earlier snapshot (legal_hold was False then), but a hold is applied to
    the workspace before soft_delete_meetings() actually runs."""
    store = _FakeStore(legal_hold=False, meeting_ids={MEETING_ID})
    repo = RetentionRepo(_Db(store))

    store.legal_hold = True

    soft_deleted = await repo.soft_delete_meetings(WORKSPACE_ID, [MEETING_ID])

    assert soft_deleted == 0
    assert MEETING_ID not in store.deleted_ids
    assert MEETING_ID in store.embedding_ids  # embeddings also survive the hold


@pytest.mark.asyncio
async def test_soft_delete_meetings_where_clause_scopes_hold_check_to_workspace():
    store = _FakeStore(legal_hold=False, meeting_ids={MEETING_ID})
    repo = RetentionRepo(_Db(store))

    await repo.soft_delete_meetings(WORKSPACE_ID, [MEETING_ID])

    for sql, params in store.calls:
        assert "workspace_retention_settings" in sql
        assert params[0] == WORKSPACE_ID


# ── Phase 2: hard_delete_meetings ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_hard_delete_meetings_removes_already_tombstoned_rows():
    store = _FakeStore(
        legal_hold=False, meeting_ids={MEETING_ID}, deleted_ids={MEETING_ID}
    )
    repo = RetentionRepo(_Db(store))

    hard_deleted = await repo.hard_delete_meetings(WORKSPACE_ID, [MEETING_ID])

    assert hard_deleted == 1
    assert MEETING_ID not in store.meeting_ids


@pytest.mark.asyncio
async def test_hard_delete_meetings_ignores_rows_never_soft_deleted():
    """A hard-delete request for a row that was never soft-deleted (e.g. a
    stale/racy candidate list) must not delete it -- the WHERE clause requires
    `deleted_at IS NOT NULL`."""
    store = _FakeStore(legal_hold=False, meeting_ids={MEETING_ID}, deleted_ids=set())
    repo = RetentionRepo(_Db(store))

    hard_deleted = await repo.hard_delete_meetings(WORKSPACE_ID, [MEETING_ID])

    assert hard_deleted == 0
    assert MEETING_ID in store.meeting_ids


@pytest.mark.asyncio
async def test_hard_delete_meetings_survives_legal_hold_applied_after_snapshot():
    store = _FakeStore(
        legal_hold=False, meeting_ids={MEETING_ID}, deleted_ids={MEETING_ID}
    )
    repo = RetentionRepo(_Db(store))

    store.legal_hold = True

    hard_deleted = await repo.hard_delete_meetings(WORKSPACE_ID, [MEETING_ID])

    assert hard_deleted == 0
    assert MEETING_ID in store.meeting_ids  # meeting survives the sweep


# ── restore_meeting ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_restore_meeting_clears_deleted_at_when_still_tombstoned():
    store = _FakeStore(
        legal_hold=False, meeting_ids={MEETING_ID}, deleted_ids={MEETING_ID}
    )
    repo = RetentionRepo(_Db(store))

    restored = await repo.restore_meeting(MEETING_ID, WORKSPACE_ID)

    assert restored is True
    assert MEETING_ID not in store.deleted_ids


@pytest.mark.asyncio
async def test_restore_meeting_returns_false_once_hard_deleted():
    store = _FakeStore(legal_hold=False, meeting_ids=set(), deleted_ids=set())
    repo = RetentionRepo(_Db(store))

    restored = await repo.restore_meeting(MEETING_ID, WORKSPACE_ID)

    assert restored is False
