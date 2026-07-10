"""Additive ``usage`` field on /summarize, /chat, and /embed responses.

These run entirely in mock mode (no LLM keys, no live Postgres needed for
/summarize) and assert the new field's shape without touching any
pre-existing response field's meaning -- guarding against a future change
accidentally repurposing or removing ``summary``/``keyPoints``/``citations``/
``embedded`` while adding usage.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, PropertyMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.providers.mock_provider import MockProvider
from app.providers.router import ProviderRouter
from app.rag.chat import answer_question
from app.rag.store import EmbeddingStore, RetrievedSegment
from app.rag.summarize import summarize_meeting
from app.schemas import MeetingMeta, TranscriptSegment

from .conftest import TEST_INTERNAL_TOKEN

client = TestClient(app, headers={"X-Internal-Service-Token": TEST_INTERNAL_TOKEN})


def _segment(seg_id: str, text: str) -> TranscriptSegment:
    return TranscriptSegment(id=seg_id, speaker_name="Alice", text=text, t_start_sec=0.0)


class TestSummarizeUsage:
    @pytest.mark.asyncio
    async def test_single_chunk_summary_carries_usage_without_disturbing_other_fields(self):
        router = ProviderRouter.__new__(ProviderRouter)
        router._settings = type("S", (), {"is_mock": True, "use_premium_by_default": True})()  # noqa: SLF001
        router._mock = MockProvider()  # noqa: SLF001
        router._live = []  # noqa: SLF001

        segments = [_segment("1", "We will ship the feature by Friday.")]
        result = await summarize_meeting(
            router,
            meeting_id="m1",
            meta=MeetingMeta(title="Standup"),
            segments=segments,
        )

        assert result.summary
        assert result.usage is not None
        assert result.usage.provider == "mock"
        assert result.usage.total_tokens == (
            result.usage.prompt_tokens + result.usage.completion_tokens
        )

    def test_post_summarize_response_includes_usage_and_keeps_existing_fields(self):
        payload = {
            "meetingId": "m1",
            "meta": {"title": "Standup"},
            "segments": [
                {
                    "id": "s1",
                    "speakerName": "Alice",
                    "text": "We will ship the feature by Friday.",
                    "tStartSec": 0.0,
                }
            ],
        }

        response = client.post("/summarize", json=payload)

        assert response.status_code == 200
        body = response.json()
        # Pre-existing fields untouched.
        assert "summary" in body
        assert "keyPoints" in body
        assert "actionItems" in body
        assert "chapters" in body
        # New additive field.
        assert "usage" in body
        assert body["usage"]["provider"] == "mock"
        assert set(body["usage"]) >= {
            "promptTokens",
            "completionTokens",
            "totalTokens",
            "provider",
            "model",
            "estimatedCostUsd",
        }


class TestChatUsage:
    @pytest.mark.asyncio
    async def test_answer_question_response_carries_usage_without_disturbing_citations(self):
        router = ProviderRouter.__new__(ProviderRouter)
        router._settings = type("S", (), {"is_mock": True, "use_premium_by_default": True})()  # noqa: SLF001
        router._mock = MockProvider()  # noqa: SLF001
        router._live = []  # noqa: SLF001

        store = EmbeddingStore.__new__(EmbeddingStore)
        retrieved = [
            RetrievedSegment(
                segment_id="seg-1",
                speaker_name="Alice",
                text="We will ship Friday.",
                t_start_sec=0.0,
                distance=0.0,
                meeting_id="m1",
            )
        ]
        with (
            patch.object(EmbeddingStore, "ready", new_callable=PropertyMock, return_value=True),
            patch.object(EmbeddingStore, "keyword_search", new=AsyncMock(return_value=retrieved)),
        ):
            response = await answer_question(
                router,
                store,
                workspace_id="ws1",
                meeting_id="m1",
                question="When do we ship?",
                history=[],
                is_mock=True,
            )

        assert response.citations
        assert response.usage is not None
        assert response.usage.provider == "mock"
        assert response.usage.total_tokens > 0


class TestEmbedUsage:
    def test_post_embed_response_includes_usage_and_keeps_embedded_count(self):
        payload = {
            "workspaceId": "ws1",
            "meetingId": "m1",
            "segments": [
                {
                    "id": "s1",
                    "speakerName": "Alice",
                    "text": "hello world",
                    "tStartSec": 0.0,
                }
            ],
        }

        with (
            patch.object(EmbeddingStore, "ready", new_callable=PropertyMock, return_value=True),
            patch.object(EmbeddingStore, "upsert_segments", new=AsyncMock(return_value=1)),
        ):
            response = client.post("/embed", json=payload)

        assert response.status_code == 200
        body = response.json()
        assert body["embedded"] == 1
        assert "usage" in body
        assert body["usage"]["provider"] == "mock"
