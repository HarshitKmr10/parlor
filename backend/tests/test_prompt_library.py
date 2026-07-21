"""Route tests for the prompt library API (workspace-scoped CRUD)."""

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
                role="member",
            ),
            via_api_key=False,
        )

    return _dep


def _row(title="Kickoff recap", body="Summarize the kickoff decisions."):
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return {
        "id": "00000000-0000-0000-0000-0000000000aa",
        "workspace_id": "00000000-0000-0000-0000-000000000002",
        "title": title,
        "body": body,
        "created_at": now,
        "updated_at": now,
    }


@pytest.fixture
def prompts_client():
    """TestClient with get_current_context + the route's repo dependency
    overridden so no real DB is touched."""
    from fastapi.testclient import TestClient

    from src.api.product import routes_prompts
    from src.api.product.deps import get_current_context
    from src.main import app

    fake_repo = AsyncMock()
    app.dependency_overrides[get_current_context] = _override_context()
    app.dependency_overrides[routes_prompts._repo] = lambda: fake_repo
    try:
        yield TestClient(app), fake_repo
    finally:
        app.dependency_overrides.pop(get_current_context, None)
        app.dependency_overrides.pop(routes_prompts._repo, None)


def test_list_prompts(prompts_client):
    client, fake_repo = prompts_client
    fake_repo.list.return_value = [_row()]
    res = client.get("/api/v1/prompts")
    assert res.status_code == 200, res.text
    body = res.json()
    assert len(body) == 1
    assert body[0]["title"] == "Kickoff recap"
    fake_repo.list.assert_awaited_once()


def test_create_prompt(prompts_client):
    client, fake_repo = prompts_client
    fake_repo.create.return_value = _row(title="New prompt", body="Do the thing.")
    res = client.post(
        "/api/v1/prompts",
        json={"title": "New prompt", "body": "Do the thing."},
    )
    assert res.status_code == 201, res.text
    assert res.json()["title"] == "New prompt"
    fake_repo.create.assert_awaited_once()


def test_update_prompt_not_found(prompts_client):
    client, fake_repo = prompts_client
    fake_repo.update.return_value = None
    res = client.patch(
        "/api/v1/prompts/00000000-0000-0000-0000-0000000000ff",
        json={"title": "Renamed"},
    )
    assert res.status_code == 404, res.text
    assert res.json()["error"]["code"] == "not_found"


def test_delete_prompt_not_found(prompts_client):
    client, fake_repo = prompts_client
    fake_repo.delete.return_value = False
    res = client.delete("/api/v1/prompts/00000000-0000-0000-0000-0000000000ff")
    assert res.status_code == 404, res.text
    assert res.json()["error"]["code"] == "not_found"
