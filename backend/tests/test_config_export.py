"""Tests for the configuration-export API + service.

Covers the happy path (GET 200 returns the aggregated config dict) and the
defensive path (a single collection query raising yields an empty value for
that key without failing the whole export).
"""

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


_EXPECTED_KEYS = {
    "version",
    "tags",
    "savedViews",
    "prompts",
    "redactionRules",
    "captureExclusions",
    "autoTagRules",
    "shareSettings",
    "capturePrefs",
}


def _sample_export():
    return {
        "version": 1,
        "tags": [{"id": "t1", "name": "Sales", "color": "#f00"}],
        "savedViews": [],
        "prompts": [],
        "redactionRules": [],
        "captureExclusions": [],
        "autoTagRules": [],
        "shareSettings": {"defaultExpiryHours": 0},
        "capturePrefs": {"autoJoinEnabled": True},
    }


@pytest.fixture
def export_client():
    """TestClient with get_current_context + the route's service dependency
    overridden so no real DB is touched."""
    from fastapi.testclient import TestClient

    from src.api.product import routes_config_export
    from src.api.product.deps import get_current_context
    from src.main import app

    fake_service = AsyncMock()
    app.dependency_overrides[get_current_context] = _override_context()
    app.dependency_overrides[routes_config_export._service] = lambda: fake_service
    try:
        yield TestClient(app), fake_service
    finally:
        app.dependency_overrides.pop(get_current_context, None)
        app.dependency_overrides.pop(routes_config_export._service, None)


def test_get_returns_config_bundle(export_client):
    client, fake_service = export_client
    fake_service.build.return_value = _sample_export()

    res = client.get("/api/v1/config-export")
    assert res.status_code == 200, res.text
    body = res.json()
    assert set(body.keys()) == _EXPECTED_KEYS
    assert body["version"] == 1
    assert body["tags"][0]["name"] == "Sales"
    fake_service.build.assert_awaited_once()


class _FakeStore:
    """Fake db.store: returns [] for every query, except it raises when the
    tags table is queried — exercising the per-collection defensive path."""

    async def query_raw(self, sql, *args):
        if "FROM tags " in sql:
            raise RuntimeError("boom: tags table unavailable")
        return []


class _FakeDb:
    def __init__(self):
        self.store = _FakeStore()


@pytest.mark.asyncio
async def test_build_is_defensive_when_one_collection_raises():
    from src.config_export import ConfigExportService

    service = ConfigExportService(_FakeDb())
    export = await service.build("00000000-0000-0000-0000-000000000002")

    # Full shape is preserved and the export does not fail as a whole.
    assert set(export.keys()) == _EXPECTED_KEYS
    # The failing collection degrades to an empty list.
    assert export["tags"] == []
    # Other list collections resolve normally (empty from the fake store).
    assert export["savedViews"] == []
    # Single-row settings fall back to their repo defaults (a dict).
    assert isinstance(export["shareSettings"], dict)
    assert isinstance(export["capturePrefs"], dict)
