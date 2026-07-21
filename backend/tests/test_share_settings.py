"""Route tests for the sharing-defaults API (single-row settings)."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest


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


def _row(default_expiry_hours=48, require_passcode=True, default_passcode="hunter2"):
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return {
        "workspace_id": "00000000-0000-0000-0000-000000000002",
        "default_expiry_hours": default_expiry_hours,
        "require_passcode": require_passcode,
        "default_passcode": default_passcode,
        "created_at": now,
        "updated_at": now,
    }


@pytest.fixture
def share_client():
    """TestClient with get_current_context + the route's repo dependency
    overridden so no real DB is touched."""
    from fastapi.testclient import TestClient

    from src.api.product import routes_share
    from src.api.product.deps import get_current_context
    from src.main import app

    fake_repo = AsyncMock()
    app.dependency_overrides[get_current_context] = _override_context()
    app.dependency_overrides[routes_share._repo] = lambda: fake_repo
    try:
        yield TestClient(app), fake_repo
    finally:
        app.dependency_overrides.pop(get_current_context, None)
        app.dependency_overrides.pop(routes_share._repo, None)


def test_get_returns_defaults(share_client):
    from src.share_settings import DEFAULTS

    client, fake_repo = share_client
    fake_repo.get.return_value = {
        **DEFAULTS,
        "workspace_id": "00000000-0000-0000-0000-000000000002",
    }
    res = client.get("/api/v1/share-settings")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["defaultExpiryHours"] == 0
    assert body["requirePasscode"] is False
    assert body["defaultPasscode"] == ""
    fake_repo.get.assert_awaited_once()


def test_put_round_trips(share_client):
    client, fake_repo = share_client
    fake_repo.upsert.return_value = _row(
        default_expiry_hours=48, require_passcode=True, default_passcode="hunter2"
    )
    res = client.put(
        "/api/v1/share-settings",
        json={
            "defaultExpiryHours": 48,
            "requirePasscode": True,
            "defaultPasscode": "hunter2",
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["defaultExpiryHours"] == 48
    assert body["requirePasscode"] is True
    assert body["defaultPasscode"] == "hunter2"
    fake_repo.upsert.assert_awaited_once()


def test_put_rejects_out_of_range_expiry(share_client):
    client, _ = share_client
    res = client.put(
        "/api/v1/share-settings",
        json={
            "defaultExpiryHours": 9000,
            "requirePasscode": False,
            "defaultPasscode": "",
        },
    )
    assert res.status_code == 422, res.text
