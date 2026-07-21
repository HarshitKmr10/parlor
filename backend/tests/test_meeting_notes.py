"""Route tests for the private per-user meeting-notes API."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

_WS = "00000000-0000-0000-0000-000000000002"
_USER = "00000000-0000-0000-0000-0000000000u1"
_MEETING = "00000000-0000-0000-0000-0000000000aa"


def _override_user_context():
    from src.api.product.deps import AuthContext
    from src.api.product.schemas import User, Workspace

    def _dep():
        return AuthContext(
            user=User(
                id=_USER,
                email="a@example.com",
                name="A",
                created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            ),
            workspace=Workspace(id=_WS, name="W", slug="w", role="owner"),
            via_api_key=False,
        )

    return _dep


def _override_apikey_context():
    from src.api.product.deps import AuthContext
    from src.api.product.schemas import Workspace

    def _dep():
        return AuthContext(
            user=None,
            workspace=Workspace(id=_WS, name="W", slug="w", role="member"),
            via_api_key=True,
        )

    return _dep


@pytest.fixture
def notes_client():
    from fastapi.testclient import TestClient

    from src.api.product import routes_meeting_notes
    from src.api.product.deps import get_current_context
    from src.main import app

    fake_repo = AsyncMock()
    app.dependency_overrides[get_current_context] = _override_user_context()
    app.dependency_overrides[routes_meeting_notes._repo] = lambda: fake_repo
    try:
        yield TestClient(app), fake_repo, app, routes_meeting_notes
    finally:
        app.dependency_overrides.pop(get_current_context, None)
        app.dependency_overrides.pop(routes_meeting_notes._repo, None)


def test_get_note_defaults_empty(notes_client):
    client, fake_repo, _, _ = notes_client
    fake_repo.get.return_value = {"body": ""}
    res = client.get(f"/api/v1/meeting-notes/{_MEETING}")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["body"] == ""
    assert body["updatedAt"] is None
    fake_repo.get.assert_awaited_once_with(_WS, _USER, _MEETING)


def test_get_note_existing(notes_client):
    client, fake_repo, _, _ = notes_client
    now = datetime(2026, 1, 2, tzinfo=timezone.utc)
    fake_repo.get.return_value = {"body": "remember to follow up", "updated_at": now}
    res = client.get(f"/api/v1/meeting-notes/{_MEETING}")
    assert res.status_code == 200, res.text
    assert res.json()["body"] == "remember to follow up"


def test_put_note_round_trip(notes_client):
    client, fake_repo, _, _ = notes_client
    now = datetime(2026, 1, 3, tzinfo=timezone.utc)
    fake_repo.upsert.return_value = {"body": "my private note", "updated_at": now}
    res = client.put(
        f"/api/v1/meeting-notes/{_MEETING}",
        json={"body": "my private note"},
    )
    assert res.status_code == 200, res.text
    assert res.json()["body"] == "my private note"
    fake_repo.upsert.assert_awaited_once_with(
        workspace_id=_WS,
        user_id=_USER,
        meeting_id=_MEETING,
        body="my private note",
    )


def test_put_note_rejects_oversized_body(notes_client):
    client, _, _, _ = notes_client
    res = client.put(
        f"/api/v1/meeting-notes/{_MEETING}",
        json={"body": "x" * 20001},
    )
    assert res.status_code == 422, res.text


def test_api_key_principal_forbidden(notes_client):
    client, fake_repo, app, routes_meeting_notes = notes_client
    from src.api.product.deps import get_current_context

    app.dependency_overrides[get_current_context] = _override_apikey_context()
    res = client.get(f"/api/v1/meeting-notes/{_MEETING}")
    assert res.status_code == 403, res.text
    assert res.json()["error"]["code"] == "user_required"
    fake_repo.get.assert_not_awaited()
