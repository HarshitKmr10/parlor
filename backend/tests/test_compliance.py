"""Unit tests for retention selection logic (pure)."""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest

from src.compliance import cutoff_for, select_expired, select_tombstoned

NOW = datetime(2026, 6, 29, 12, 0, tzinfo=timezone.utc)


def _m(id_, days_ago):
    return {"id": id_, "created_at": NOW - timedelta(days=days_ago)}


def _t(id_, days_ago):
    return {"id": id_, "deleted_at": NOW - timedelta(days=days_ago)}


def test_cutoff_none_when_keep_forever():
    assert cutoff_for(None, NOW) is None
    assert cutoff_for(0, NOW) is None


def test_cutoff_subtracts_days():
    assert cutoff_for(30, NOW) == NOW - timedelta(days=30)


def test_select_expired_basic():
    meetings = [_m("old", 40), _m("recent", 5), _m("edge", 31)]
    expired = select_expired(meetings, retention_days=30, legal_hold=False, now=NOW)
    assert set(expired) == {"old", "edge"}


def test_legal_hold_pauses_all_deletion():
    meetings = [_m("old", 400)]
    assert select_expired(meetings, retention_days=30, legal_hold=True, now=NOW) == []


def test_keep_forever_deletes_nothing():
    meetings = [_m("old", 9999)]
    assert select_expired(meetings, retention_days=None, legal_hold=False, now=NOW) == []


# ── select_tombstoned (phase 2: hard-delete after the recovery window) ─────


def test_select_tombstoned_basic():
    tombstoned = [_t("old", 40), _t("recent", 5), _t("edge", 31)]
    ready = select_tombstoned(tombstoned, tombstone_days=30, legal_hold=False, now=NOW)
    assert set(ready) == {"old", "edge"}


def test_select_tombstoned_not_ready_before_window_elapses():
    tombstoned = [_t("just_deleted", 1)]
    ready = select_tombstoned(tombstoned, tombstone_days=30, legal_hold=False, now=NOW)
    assert ready == []


def test_select_tombstoned_legal_hold_pauses_hard_delete_too():
    tombstoned = [_t("old", 400)]
    assert (
        select_tombstoned(tombstoned, tombstone_days=30, legal_hold=True, now=NOW) == []
    )


# ── RBAC: GET /export must require the same admin role as PUT /retention-settings ──


def _override_context(role: str):
    from src.api.product.deps import AuthContext
    from src.api.product.schemas import Workspace

    def _dep():
        return AuthContext(
            user=None,
            workspace=Workspace(
                id="00000000-0000-0000-0000-000000000003",
                name="W",
                slug="w",
                role=role,
            ),
            via_api_key=False,
        )

    return _dep


@pytest.fixture
def compliance_client_factory():
    """Yields a factory building a TestClient for a given caller role, with
    get_current_context + get_db + the route's RetentionRepo dependency
    overridden so no real DB is touched."""
    from fastapi.testclient import TestClient

    from src.api.product import routes_compliance
    from src.api.product.deps import get_current_context, get_db
    from src.main import app

    fake_repo = AsyncMock()
    fake_repo.export_bundle.return_value = {"meetings": [], "action_items": []}
    fake_repo.restore_meeting.return_value = True

    fake_db = AsyncMock()
    fake_db.store.query_raw.return_value = [{"id": "audit-1"}]

    def _make(role: str):
        app.dependency_overrides[get_current_context] = _override_context(role)
        app.dependency_overrides[routes_compliance._repo] = lambda: fake_repo
        app.dependency_overrides[get_db] = lambda: fake_db
        return TestClient(app), fake_repo

    try:
        yield _make
    finally:
        app.dependency_overrides.pop(get_current_context, None)
        app.dependency_overrides.pop(routes_compliance._repo, None)
        app.dependency_overrides.pop(get_db, None)


def test_export_data_requires_admin_role(compliance_client_factory):
    client, fake_repo = compliance_client_factory("member")
    res = client.get("/api/v1/export")
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "insufficient_role"
    fake_repo.export_bundle.assert_not_awaited()


def test_export_data_allows_admin_role(compliance_client_factory):
    client, fake_repo = compliance_client_factory("admin")
    res = client.get("/api/v1/export")
    assert res.status_code == 200, res.text
    fake_repo.export_bundle.assert_awaited_once()


# ── POST /api/v1/meetings/{meeting_id}/restore ──────────────────────────────

MEETING_ID = "20000000-0000-0000-0000-000000000001"


def test_restore_meeting_requires_admin_role(compliance_client_factory):
    client, fake_repo = compliance_client_factory("member")
    res = client.post(f"/api/v1/meetings/{MEETING_ID}/restore")
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "insufficient_role"
    fake_repo.restore_meeting.assert_not_awaited()


def test_restore_meeting_succeeds_for_admin(compliance_client_factory):
    client, fake_repo = compliance_client_factory("admin")
    res = client.post(f"/api/v1/meetings/{MEETING_ID}/restore")
    assert res.status_code == 204, res.text
    fake_repo.restore_meeting.assert_awaited_once_with(
        MEETING_ID, "00000000-0000-0000-0000-000000000003"
    )


def test_restore_meeting_404s_when_not_in_recovery_window(compliance_client_factory):
    client, fake_repo = compliance_client_factory("admin")
    fake_repo.restore_meeting.return_value = False
    res = client.post(f"/api/v1/meetings/{MEETING_ID}/restore")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "not_found"
