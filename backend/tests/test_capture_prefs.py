"""Route + helper tests for the auto-join preferences API (single-row settings)."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

from src.capture_prefs import should_skip_platform


def _override_context():
    from src.api.product.deps import AuthContext
    from src.api.product.schemas import Workspace

    def _dep():
        return AuthContext(
            user=None,
            workspace=Workspace(
                id="00000000-0000-0000-0000-000000000002",
                name="W",
                slug="w",
                role="owner",
            ),
            via_api_key=False,
        )

    return _dep


def _row(
    auto_join_enabled=False,
    join_lead_minutes=10,
    join_zoom=False,
    join_meet=True,
    join_teams=False,
):
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return {
        "workspace_id": "00000000-0000-0000-0000-000000000002",
        "auto_join_enabled": auto_join_enabled,
        "join_lead_minutes": join_lead_minutes,
        "join_zoom": join_zoom,
        "join_meet": join_meet,
        "join_teams": join_teams,
        "created_at": now,
        "updated_at": now,
    }


@pytest.fixture
def prefs_client():
    """TestClient with get_current_context + the route's repo dependency
    overridden so no real DB is touched."""
    from fastapi.testclient import TestClient

    from src.api.product import routes_capture_prefs
    from src.api.product.deps import get_current_context
    from src.main import app

    fake_repo = AsyncMock()
    app.dependency_overrides[get_current_context] = _override_context()
    app.dependency_overrides[routes_capture_prefs._repo] = lambda: fake_repo
    try:
        yield TestClient(app), fake_repo
    finally:
        app.dependency_overrides.pop(get_current_context, None)
        app.dependency_overrides.pop(routes_capture_prefs._repo, None)


def test_get_returns_defaults(prefs_client):
    from src.capture_prefs import DEFAULTS

    client, fake_repo = prefs_client
    fake_repo.get.return_value = {
        **DEFAULTS,
        "workspace_id": "00000000-0000-0000-0000-000000000002",
    }
    res = client.get("/api/v1/capture-prefs")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["autoJoinEnabled"] is True
    assert body["joinLeadMinutes"] == 2
    assert body["joinZoom"] is True
    assert body["joinMeet"] is True
    assert body["joinTeams"] is True
    fake_repo.get.assert_awaited_once()


def test_put_round_trips(prefs_client):
    client, fake_repo = prefs_client
    fake_repo.upsert.return_value = _row(
        auto_join_enabled=False,
        join_lead_minutes=10,
        join_zoom=False,
        join_meet=True,
        join_teams=False,
    )
    res = client.put(
        "/api/v1/capture-prefs",
        json={
            "autoJoinEnabled": False,
            "joinLeadMinutes": 10,
            "joinZoom": False,
            "joinMeet": True,
            "joinTeams": False,
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["autoJoinEnabled"] is False
    assert body["joinLeadMinutes"] == 10
    assert body["joinZoom"] is False
    assert body["joinMeet"] is True
    assert body["joinTeams"] is False
    fake_repo.upsert.assert_awaited_once()


def test_put_rejects_out_of_range_lead_minutes(prefs_client):
    client, _ = prefs_client
    res = client.put(
        "/api/v1/capture-prefs",
        json={
            "autoJoinEnabled": True,
            "joinLeadMinutes": 99,
            "joinZoom": True,
            "joinMeet": True,
            "joinTeams": True,
        },
    )
    assert res.status_code == 422, res.text


# ── Pure helper: should_skip_platform ────────────────────────────────────────
def test_skip_when_auto_join_disabled():
    prefs = _row(auto_join_enabled=False, join_zoom=True, join_meet=True, join_teams=True)
    assert should_skip_platform(prefs, "zoom") is True
    assert should_skip_platform(prefs, "googlemeet") is True


def test_skip_only_muted_platform():
    prefs = _row(auto_join_enabled=True, join_zoom=False, join_meet=True, join_teams=False)
    assert should_skip_platform(prefs, "zoom") is True
    assert should_skip_platform(prefs, "msteams") is True
    assert should_skip_platform(prefs, "googlemeet") is False


def test_unknown_platform_never_skipped():
    prefs = _row(auto_join_enabled=True, join_zoom=False, join_meet=False, join_teams=False)
    assert should_skip_platform(prefs, "unknown") is False
    assert should_skip_platform({}, "zoom") is False
