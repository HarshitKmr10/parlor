"""Unit tests for retention selection logic (pure)."""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest

from src.compliance import cutoff_for, select_expired

NOW = datetime(2026, 6, 29, 12, 0, tzinfo=timezone.utc)


def _m(id_, days_ago):
    return {"id": id_, "created_at": NOW - timedelta(days=days_ago)}


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
