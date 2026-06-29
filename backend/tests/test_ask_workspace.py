"""Unit tests for workspace-wide 'Ask Verdant' citation enrichment."""

from unittest.mock import AsyncMock

import pytest

from src.api.product import ai_client, routes_ask
from src.api.product.schemas import AskRequest, Workspace


def _workspace() -> Workspace:
    return Workspace(id="ws-1", name="Acme", slug="acme", role="owner")


@pytest.mark.asyncio
async def test_ask_resolves_meeting_titles_on_citations(monkeypatch):
    async def fake_chat(payload):
        # The ai-service is asked workspace-wide (no meetingId).
        assert payload["meetingId"] is None
        assert payload["workspaceId"] == "ws-1"
        return {
            "answer": "Bob owns the billing migration.",
            "citations": [
                {
                    "segmentId": "s1",
                    "speakerName": "Bob",
                    "text": "I will own the billing cutover.",
                    "tStartSec": 12.0,
                    "meetingId": "m-1",
                },
                {
                    "segmentId": "s2",
                    "speakerName": "Carol",
                    "text": "Three Q3 milestones.",
                    "tStartSec": 30.0,
                    "meetingId": "m-2",
                },
            ],
        }

    monkeypatch.setattr(ai_client, "chat", fake_chat)

    repo = AsyncMock()
    repo.get_scoped.side_effect = lambda mid, ws: {
        "m-1": {"id": "m-1", "title": "Q3 Planning"},
        "m-2": {"id": "m-2", "title": "Roadmap Review"},
    }.get(mid)

    resp = await routes_ask.ask_workspace(
        AskRequest(question="Who owns billing?"), _workspace(), repo
    )

    assert resp.answer == "Bob owns the billing migration."
    assert len(resp.citations) == 2
    assert resp.citations[0].meeting_id == "m-1"
    assert resp.citations[0].meeting_title == "Q3 Planning"
    assert resp.citations[1].meeting_title == "Roadmap Review"


@pytest.mark.asyncio
async def test_ask_tolerates_missing_meeting_and_titles(monkeypatch):
    async def fake_chat(payload):
        return {
            "answer": "Not sure.",
            "citations": [
                {"segmentId": "s1", "speakerName": "X", "text": "hi", "tStartSec": 0.0},
            ],
        }

    monkeypatch.setattr(ai_client, "chat", fake_chat)
    repo = AsyncMock()
    repo.get_scoped.return_value = None

    resp = await routes_ask.ask_workspace(
        AskRequest(question="anything"), _workspace(), repo
    )
    assert resp.citations[0].meeting_id is None
    assert resp.citations[0].meeting_title is None
    # get_scoped should not be called when there's no meeting id on the citation.
    repo.get_scoped.assert_not_called()
