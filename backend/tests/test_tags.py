"""Route tests for the meeting-tags API (workspace-scoped CRUD + assignment)."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

_WS = "00000000-0000-0000-0000-000000000002"
_MEETING = "00000000-0000-0000-0000-0000000000aa"


def _override_context():
    from src.api.product.deps import AuthContext
    from src.api.product.schemas import Workspace

    def _dep():
        return AuthContext(
            user=None,
            workspace=Workspace(id=_WS, name="W", slug="w", role="owner"),
            via_api_key=False,
        )

    return _dep


def _tag_row(name="Sales", color="#6b7280", tag_id="00000000-0000-0000-0000-0000000000t1"):
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return {
        "id": tag_id,
        "workspace_id": _WS,
        "name": name,
        "color": color,
        "created_at": now,
    }


@pytest.fixture
def tags_client():
    from fastapi.testclient import TestClient

    from src.api.product import routes_tags
    from src.api.product.deps import get_current_context
    from src.main import app

    fake_repo = AsyncMock()
    app.dependency_overrides[get_current_context] = _override_context()
    app.dependency_overrides[routes_tags._repo] = lambda: fake_repo
    try:
        yield TestClient(app), fake_repo
    finally:
        app.dependency_overrides.pop(get_current_context, None)
        app.dependency_overrides.pop(routes_tags._repo, None)


def test_list_tags(tags_client):
    client, fake_repo = tags_client
    fake_repo.list.return_value = [_tag_row(name="Sales"), _tag_row(name="Internal")]
    res = client.get("/api/v1/tags")
    assert res.status_code == 200, res.text
    body = res.json()
    assert [t["name"] for t in body] == ["Sales", "Internal"]
    assert body[0]["color"] == "#6b7280"
    fake_repo.list.assert_awaited_once_with(_WS)


def test_create_tag(tags_client):
    client, fake_repo = tags_client
    fake_repo.create.return_value = _tag_row(name="Q3", color="#ef4444")
    res = client.post("/api/v1/tags", json={"name": "Q3", "color": "#ef4444"})
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["name"] == "Q3"
    assert body["color"] == "#ef4444"
    fake_repo.create.assert_awaited_once()
    kwargs = fake_repo.create.await_args.kwargs
    assert kwargs["workspace_id"] == _WS
    assert kwargs["name"] == "Q3"
    assert kwargs["color"] == "#ef4444"


def test_create_tag_defaults_color(tags_client):
    client, fake_repo = tags_client
    fake_repo.create.return_value = _tag_row(name="Ops")
    res = client.post("/api/v1/tags", json={"name": "Ops"})
    assert res.status_code == 201, res.text
    assert res.json()["color"] == "#6b7280"
    assert fake_repo.create.await_args.kwargs["color"] == "#6b7280"


def test_create_tag_rejects_blank_name(tags_client):
    client, _ = tags_client
    res = client.post("/api/v1/tags", json={"name": ""})
    assert res.status_code == 422, res.text


def test_delete_tag(tags_client):
    client, fake_repo = tags_client
    fake_repo.delete.return_value = True
    res = client.delete("/api/v1/tags/00000000-0000-0000-0000-0000000000t1")
    assert res.status_code == 204, res.text
    fake_repo.delete.assert_awaited_once()
    kwargs = fake_repo.delete.await_args.kwargs
    assert kwargs["workspace_id"] == _WS


def test_delete_tag_missing_returns_404(tags_client):
    client, fake_repo = tags_client
    fake_repo.delete.return_value = False
    res = client.delete("/api/v1/tags/00000000-0000-0000-0000-0000000000t1")
    assert res.status_code == 404, res.text


def test_list_for_meeting(tags_client):
    client, fake_repo = tags_client
    fake_repo.list_for_meeting.return_value = [_tag_row(name="Sales")]
    res = client.get(f"/api/v1/tags/meetings/{_MEETING}")
    assert res.status_code == 200, res.text
    body = res.json()
    assert [t["name"] for t in body] == ["Sales"]
    fake_repo.list_for_meeting.assert_awaited_once_with(_MEETING, _WS)


def test_set_for_meeting_round_trip(tags_client):
    client, fake_repo = tags_client
    fake_repo.set_for_meeting.return_value = [
        _tag_row(name="Sales", tag_id="00000000-0000-0000-0000-0000000000t1"),
        _tag_row(name="Internal", tag_id="00000000-0000-0000-0000-0000000000t2"),
    ]
    res = client.put(
        f"/api/v1/tags/meetings/{_MEETING}",
        json={"tagIds": [
            "00000000-0000-0000-0000-0000000000t1",
            "00000000-0000-0000-0000-0000000000t2",
        ]},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert [t["name"] for t in body] == ["Sales", "Internal"]
    fake_repo.set_for_meeting.assert_awaited_once_with(
        _MEETING,
        _WS,
        [
            "00000000-0000-0000-0000-0000000000t1",
            "00000000-0000-0000-0000-0000000000t2",
        ],
    )


def test_set_for_meeting_clear(tags_client):
    client, fake_repo = tags_client
    fake_repo.set_for_meeting.return_value = []
    res = client.put(f"/api/v1/tags/meetings/{_MEETING}", json={"tagIds": []})
    assert res.status_code == 200, res.text
    assert res.json() == []
    fake_repo.set_for_meeting.assert_awaited_once_with(_MEETING, _WS, [])
