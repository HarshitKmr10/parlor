"""Unit tests for GET /{meeting_id}/export.

Covers:
* Markdown export renders the real fields the API contract already exposes
  (summary, key points, action items as a checklist, transcript excerpts).
* An unsupported ``format`` value 400s with a clear message rather than
  silently falling back to markdown.
* Workspace scoping: a meeting that doesn't belong to the caller's workspace
  404s instead of leaking another workspace's meeting content, matching the
  scoping pattern every other meeting route in this file follows via
  ``_load_scoped_meeting``.
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

from src.api.models.schemas import MeetingRecord, MeetingStatus
from src.api.product import routes_meetings
from src.api.product.errors import ApiError
from src.api.product.schemas import Workspace

WORKSPACE_ID = "ws-1"


def _workspace() -> Workspace:
    return Workspace(id=WORKSPACE_ID, name="Acme", slug="acme", role="owner")


def _record() -> MeetingRecord:
    return MeetingRecord(
        id="m-1",
        meeting_url="https://zoom.us/j/123",
        status=MeetingStatus.COMPLETED,
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        updated_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        bot_join_time=datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc),
        bot_leave_time=datetime(2026, 1, 1, 12, 30, tzinfo=timezone.utc),
        participants=[{"id": "p1", "name": "Alice"}, {"id": "p2", "name": "Bob"}],
        transcript={
            "content": [
                {
                    "id": "seg-1",
                    "speaker": "Alice",
                    "text": "Let's ship the export feature.",
                    "startTime": 0,
                    "endTime": 5,
                },
                {
                    "id": "seg-2",
                    "speaker": "Bob",
                    "text": "Agreed, markdown covers Notion and Obsidian too.",
                    "startTime": 5,
                    "endTime": 10,
                },
            ]
        },
    )


def _scoped_row(insights: dict | None = None) -> dict:
    return {"id": "m-1", "title": "Export planning sync", "insights": insights}


def _service_and_repo(record: MeetingRecord, scoped: dict | None):
    service = AsyncMock()
    service.get_meeting_by_id.return_value = record
    repo = AsyncMock()
    repo.get_scoped.return_value = scoped
    return service, repo


class TestMarkdownExport:
    @pytest.mark.asyncio
    async def test_markdown_export_contains_real_meeting_fields(self):
        insights = {
            "summary": "The team agreed to ship Markdown export first.",
            "keyPoints": ["Markdown covers Notion + Obsidian"],
            "actionItems": [
                {"id": "a1", "text": "Wire up the export button", "assignee": "Alice", "done": False}
            ],
            "chapters": [],
        }
        record = _record()
        service, repo = _service_and_repo(record, _scoped_row(insights))

        response = await routes_meetings.export_meeting(
            "m-1", "markdown", _workspace(), service, repo
        )

        assert response.media_type == "text/markdown; charset=utf-8"
        assert 'attachment; filename="export-planning-sync.md"' in (
            response.headers["content-disposition"]
        )
        body = response.body.decode("utf-8")
        assert "# Export planning sync" in body
        assert "Alice, Bob" in body
        assert "The team agreed to ship Markdown export first." in body
        assert "- [ ] Wire up the export button (assignee: Alice)" in body
        assert "**Alice** _0:00_: Let's ship the export feature." in body
        assert "Obsidian" in body and "Notion" in body

    @pytest.mark.asyncio
    async def test_export_without_insights_still_includes_transcript(self):
        record = _record()
        service, repo = _service_and_repo(record, _scoped_row(insights=None))

        response = await routes_meetings.export_meeting(
            "m-1", "markdown", _workspace(), service, repo
        )

        body = response.body.decode("utf-8")
        assert "## Transcript" in body
        assert "## Summary" not in body

    @pytest.mark.asyncio
    async def test_unsupported_format_returns_400_not_a_silent_fallback(self):
        record = _record()
        service, repo = _service_and_repo(record, _scoped_row())

        with pytest.raises(ApiError) as exc_info:
            await routes_meetings.export_meeting(
                "m-1", "pdf", _workspace(), service, repo
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.code == "unsupported_export_format"


class TestMarkdownExportWorkspaceScoping:
    """A meeting belonging to a different workspace must never be exportable
    by a caller scoped to this workspace -- 404, not the meeting content."""

    @pytest.mark.asyncio
    async def test_export_404s_when_meeting_not_scoped_to_caller_workspace(self):
        record = _record()
        service, repo = _service_and_repo(record, scoped=None)

        with pytest.raises(ApiError) as exc_info:
            await routes_meetings.export_meeting(
                "m-1", "markdown", _workspace(), service, repo
            )

        assert exc_info.value.status_code == 404
        assert exc_info.value.code == "not_found"
        # The scoping check must happen via the repo, keyed off the caller's
        # own workspace id -- not the meeting's, proving cross-workspace
        # access can't be forced by supplying someone else's meeting id.
        repo.get_scoped.assert_awaited_once_with("m-1", WORKSPACE_ID)
