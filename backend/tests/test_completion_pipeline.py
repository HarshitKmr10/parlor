"""Tests for the post-meeting completion pipeline.

Verifies it tolerates ai-service being down (leaves insights null) and stores
insights on success.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.api.product.errors import ApiError
from src.services import completion_pipeline


class _Record:
    transcript = {
        "content": [
            {"id": "s1", "speaker": "Alice", "text": "Hello", "startTime": 0, "endTime": 2}
        ]
    }
    participants = []
    status = MagicMock(value="completed")
    meeting_url = "https://meet.google.com/abc-defg-hij"
    bot_join_time = None
    bot_leave_time = None
    scheduled_at = None
    created_at = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
    video_link = None
    id = "m-1"


@pytest.mark.asyncio
async def test_pipeline_tolerates_ai_down():
    db = AsyncMock()
    db.store.query_raw = AsyncMock(return_value=[{"workspace_id": "ws-1"}])

    service = AsyncMock()
    service.get_meeting_by_id = AsyncMock(return_value=_Record())
    repo = AsyncMock()
    repo.get_scoped = AsyncMock(return_value={"title": "Sync"})

    with patch(
        "src.services.completion_pipeline.get_db_connection",
        new=AsyncMock(return_value=db),
    ), patch(
        "src.services.completion_pipeline.MeetingService", return_value=service
    ), patch(
        "src.services.completion_pipeline.ProductMeetingsRepo", return_value=repo
    ), patch(
        "src.services.completion_pipeline.ai_client.embed",
        new=AsyncMock(side_effect=ApiError(503, "down", "ai down")),
    ), patch(
        "src.services.completion_pipeline.ai_client.summarize",
        new=AsyncMock(side_effect=ApiError(503, "down", "ai down")),
    ):
        await completion_pipeline.run_completion_pipeline("m-1")

    # Insights never stored because summarize failed — pipeline did not raise.
    repo.store_insights.assert_not_awaited()


@pytest.mark.asyncio
async def test_pipeline_stores_insights_and_delivers_recap():
    db = AsyncMock()
    db.store.query_raw = AsyncMock(return_value=[{"workspace_id": "ws-1"}])

    service = AsyncMock()
    service.get_meeting_by_id = AsyncMock(return_value=_Record())
    repo = AsyncMock()
    repo.get_scoped = AsyncMock(return_value={"title": "Sync"})

    summary_payload = {
        "summary": "We met.",
        "keyPoints": ["kp"],
        "actionItems": [],
        "chapters": [],
    }

    with patch(
        "src.services.completion_pipeline.get_db_connection",
        new=AsyncMock(return_value=db),
    ), patch(
        "src.services.completion_pipeline.MeetingService", return_value=service
    ), patch(
        "src.services.completion_pipeline.ProductMeetingsRepo", return_value=repo
    ), patch(
        "src.services.completion_pipeline.ai_client.embed", new=AsyncMock(return_value={})
    ), patch(
        "src.services.completion_pipeline.ai_client.summarize",
        new=AsyncMock(return_value=summary_payload),
    ), patch(
        "src.integrations.deliver_recap", new=AsyncMock(return_value=[])
    ):
        await completion_pipeline.run_completion_pipeline("m-1")

    repo.store_insights.assert_awaited_once()


@pytest.mark.asyncio
async def test_pipeline_skips_when_no_segments():
    record = _Record()
    record.transcript = {"content": []}

    db = AsyncMock()
    db.store.query_raw = AsyncMock(return_value=[{"workspace_id": "ws-1"}])
    service = AsyncMock()
    service.get_meeting_by_id = AsyncMock(return_value=record)
    repo = AsyncMock()
    repo.get_scoped = AsyncMock(return_value={"title": "Sync"})

    with patch(
        "src.services.completion_pipeline.get_db_connection",
        new=AsyncMock(return_value=db),
    ), patch(
        "src.services.completion_pipeline.MeetingService", return_value=service
    ), patch(
        "src.services.completion_pipeline.ProductMeetingsRepo", return_value=repo
    ), patch(
        "src.services.completion_pipeline.ai_client.summarize", new=AsyncMock()
    ) as summarize:
        await completion_pipeline.run_completion_pipeline("m-1")

    summarize.assert_not_awaited()
