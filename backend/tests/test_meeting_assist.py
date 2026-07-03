"""Unit tests for POST /{meeting_id}/assist:

* ai_client.assist uses a short per-call timeout instead of the generic
  60s batch timeout (issue #113).
* the route degrades to an empty "no suggestion this cycle" response when
  the ai-service call fails, instead of propagating a 502/503 to the caller.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest

from src.api.product import ai_client, routes_meetings
from src.api.product.errors import ApiError
from src.api.product.schemas import Workspace


def _workspace() -> Workspace:
    return Workspace(id="ws-1", name="Acme", slug="acme", role="owner")


def _record(transcript=None):
    return SimpleNamespace(transcript=transcript)


def _service_and_repo(record):
    service = AsyncMock()
    service.get_meeting_by_id.return_value = record
    repo = AsyncMock()
    repo.get_scoped.return_value = {"id": "m-1", "title": "Standup"}
    return service, repo


class TestAssistTimeout:
    """Issue #113: /assist must not share the generic 60s batch timeout."""

    def test_assist_uses_a_short_dedicated_timeout_distinct_from_the_batch_timeout(self):
        assert ai_client._ASSIST_TIMEOUT != ai_client._TIMEOUT
        # A handful of seconds, not anywhere near the 60s batch timeout used
        # by summarize/chat/embed.
        assert ai_client._ASSIST_TIMEOUT.read < 10.0

    @pytest.mark.asyncio
    async def test_assist_passes_its_dedicated_timeout_to_post(self, monkeypatch):
        captured = {}

        async def fake_post(path, payload, *, timeout=None):
            captured["path"] = path
            captured["timeout"] = timeout
            return {}

        monkeypatch.setattr(ai_client, "_post", fake_post)

        await ai_client.assist({"meetingId": "m-1", "segments": []})

        assert captured["path"] == "/assist"
        assert captured["timeout"] is ai_client._ASSIST_TIMEOUT

    @pytest.mark.asyncio
    async def test_other_ai_client_calls_are_unaffected_and_keep_the_default_timeout(
        self, monkeypatch
    ):
        """Regression: summarize/chat/embed must keep using the shared
        60s default -- only /assist gets the short override."""
        captured = {}

        async def fake_post(path, payload, *, timeout=None):
            captured[path] = timeout
            return {}

        monkeypatch.setattr(ai_client, "_post", fake_post)

        await ai_client.summarize({})
        await ai_client.chat({})
        await ai_client.embed({})

        assert captured["/summarize"] is None
        assert captured["/chat"] is None
        assert captured["/embed"] is None


class TestAssistGracefulDegradation:
    """Issue #113: a slow/unreachable ai-service must degrade to an empty
    'no suggestion this cycle' response, not fail the request."""

    @pytest.mark.asyncio
    async def test_ai_service_timeout_degrades_to_empty_assist_response(self, monkeypatch):
        async def fake_assist(payload):
            raise ApiError(
                503,
                "ai_service_unavailable",
                "The AI service is unreachable. Try again shortly.",
            )

        monkeypatch.setattr(ai_client, "assist", fake_assist)
        service, repo = _service_and_repo(_record())

        result = await routes_meetings.get_meeting_assist(
            "m-1", _workspace(), service, repo
        )

        assert result.summary_so_far == ""
        assert result.suggested_questions == []
        assert result.coverage_gaps == []
        assert result.segment_count == 0

    @pytest.mark.asyncio
    async def test_successful_assist_response_is_unaffected(self, monkeypatch):
        """Regression: the happy path must still surface the ai-service's
        real suggestions, unchanged by the new degrade-on-error handling."""

        async def fake_assist(payload):
            return {
                "summarySoFar": "Discussing Q3 roadmap.",
                "suggestedQuestions": ["What's the deadline?"],
                "coverageGaps": ["owners"],
                "segmentCount": 3,
            }

        monkeypatch.setattr(ai_client, "assist", fake_assist)
        service, repo = _service_and_repo(_record())

        result = await routes_meetings.get_meeting_assist(
            "m-1", _workspace(), service, repo
        )

        assert result.summary_so_far == "Discussing Q3 roadmap."
        assert result.suggested_questions == ["What's the deadline?"]
        assert result.coverage_gaps == ["owners"]
        assert result.segment_count == 3

    @pytest.mark.asyncio
    async def test_real_read_timeout_from_httpx_surfaces_as_graceful_degrade(
        self, monkeypatch
    ):
        """End-to-end through ai_client.assist (not just the route): a real
        httpx.ReadTimeout raised by the HTTP layer must still resolve to the
        route's graceful empty response, proving the ApiError path this
        route now catches is the one _post actually raises on timeout."""

        class _RaisingAsyncClient:
            def __init__(self, *args, **kwargs):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *exc):
                return False

            async def post(self, *args, **kwargs):
                raise httpx.ReadTimeout("timed out")

        monkeypatch.setattr(httpx, "AsyncClient", _RaisingAsyncClient)
        service, repo = _service_and_repo(_record())

        result = await routes_meetings.get_meeting_assist(
            "m-1", _workspace(), service, repo
        )

        assert result.segment_count == 0
        assert result.suggested_questions == []
