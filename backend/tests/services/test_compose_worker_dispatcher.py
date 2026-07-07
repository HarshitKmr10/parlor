"""Integration tests for the compose-worker dispatch path (THIRD mode).

These prove that in ``RUNTIME_MODE=compose`` with ``MEETING_WORKER_SIDECAR_URL``
set, ``dispatch_meeting`` POSTs the correct :class:`SidecarConfigurePayload` to
``<worker>/configure`` over HTTP — i.e. the API hands the bot to a SEPARATE
worker container instead of spawning it in-process. The worker HTTP endpoint is
mocked so the test needs no container/build.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import httpx
import pytest

import src.services.compose_worker_dispatcher as cwd
from src.main import dispatch_meeting
from src.services.compose_worker_dispatcher import (
    dispatch_to_compose_worker,
)
from src.services.warm_pool_dispatcher import SidecarConfigurePayload


def _payload() -> SidecarConfigurePayload:
    return SidecarConfigurePayload(
        meeting_id="00000000-0000-0000-0000-0000000000aa",
        meeting_url="https://meet.google.com/abc-defg-hij",
        org_id="org-1",
        platform="googlemeet",
        bot_name="Parlor Notetaker",
        session_number=1,
        transcript_source="gmeet_captions",
    )


@pytest.fixture(autouse=True)
def _clear_inflight():
    """Each test starts with a clean in-flight set."""
    cwd._inflight.clear()
    yield
    cwd._inflight.clear()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_dispatch_posts_configure_to_worker(monkeypatch: pytest.MonkeyPatch) -> None:
    """Happy path: payload is POSTed to <worker>/configure; success returned."""
    monkeypatch.setenv("MEETING_WORKER_SIDECAR_URL", "http://meeting-worker:9000")

    captured: dict = {}

    async def fake_post(worker_url: str, payload: SidecarConfigurePayload) -> None:
        captured["url"] = f"{worker_url}/configure"
        captured["json"] = payload.to_json()

    with patch.object(cwd, "_post_configure", new=fake_post):
        result = await dispatch_to_compose_worker(_payload())

    assert result.success is True
    assert result.worker_url == "http://meeting-worker:9000"
    assert captured["url"] == "http://meeting-worker:9000/configure"
    assert captured["json"]["meeting_id"] == "00000000-0000-0000-0000-0000000000aa"
    assert captured["json"]["meeting_url"] == "https://meet.google.com/abc-defg-hij"
    assert captured["json"]["platform"] == "googlemeet"
    assert captured["json"]["transcript_source"] == "gmeet_captions"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_dispatch_fails_when_worker_not_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("MEETING_WORKER_SIDECAR_URL", raising=False)

    result = await dispatch_to_compose_worker(_payload())

    assert result.success is False
    assert result.mark_meeting_failed is True
    assert result.error == "meeting_worker_not_configured"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_dispatch_fails_when_worker_unreachable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MEETING_WORKER_SIDECAR_URL", "http://meeting-worker:9000")

    async def boom(worker_url: str, payload: SidecarConfigurePayload) -> None:
        raise httpx.ConnectError("connection refused")

    with patch.object(cwd, "_post_configure", new=boom):
        result = await dispatch_to_compose_worker(_payload())

    assert result.success is False
    assert result.mark_meeting_failed is True
    assert result.error == "meeting_worker_unreachable"
    # Worker released back to idle on failure so a retry can re-use it.
    assert cwd._inflight == set()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_dispatch_fails_when_worker_rejects(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MEETING_WORKER_SIDECAR_URL", "http://meeting-worker:9000")

    async def rejected(worker_url: str, payload: SidecarConfigurePayload) -> None:
        raise httpx.HTTPStatusError(
            "409",
            request=httpx.Request("POST", f"{worker_url}/configure"),
            response=httpx.Response(409),
        )

    with patch.object(cwd, "_post_configure", new=rejected):
        result = await dispatch_to_compose_worker(_payload())

    assert result.success is False
    assert result.mark_meeting_failed is True
    assert result.error == "meeting_worker_rejected_409"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_pool_picks_idle_worker_when_first_busy(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Comma-separated pool: a second dispatch picks the second worker."""
    monkeypatch.setenv(
        "MEETING_WORKER_SIDECAR_URL",
        "http://worker-a:9000,http://worker-b:9000",
    )

    async def ok(worker_url: str, payload: SidecarConfigurePayload) -> None:
        return None

    with patch.object(cwd, "_post_configure", new=ok):
        first = await dispatch_to_compose_worker(_payload())
        second = await dispatch_to_compose_worker(_payload())
        third = await dispatch_to_compose_worker(_payload())

    assert first.worker_url == "http://worker-a:9000"
    assert second.worker_url == "http://worker-b:9000"
    # Both busy now → third is rejected (single-meeting-per-worker).
    assert third.success is False
    assert third.error == "meeting_worker_all_busy"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_dispatch_meeting_compose_mode_routes_to_worker(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """End-to-end: dispatch_meeting in compose mode hands off to the worker
    and transitions the meeting to ``joining`` (not in-process LocalBotRunner)."""
    monkeypatch.setenv("RUNTIME_MODE", "compose")
    monkeypatch.setenv("MEETING_WORKER_SIDECAR_URL", "http://meeting-worker:9000")

    meeting_service = AsyncMock()
    queue_service = AsyncMock()

    posted: dict = {}

    async def fake_post(worker_url: str, payload: SidecarConfigurePayload) -> None:
        posted["worker_url"] = worker_url
        posted["payload"] = payload

    with patch.object(cwd, "_post_configure", new=fake_post):
        dispatched, message = await dispatch_meeting(
            meeting_id="00000000-0000-0000-0000-0000000000aa",
            meeting_url="https://meet.google.com/abc-defg-hij",
            platform="googlemeet",
            transcript_source="gmeet_captions",
            bot_name="Parlor Notetaker",
            org_id="org-1",
            meeting_service=meeting_service,
            queue_service=queue_service,
        )

    assert dispatched is True
    assert "meeting-worker" in message
    assert posted["worker_url"] == "http://meeting-worker:9000"
    assert posted["payload"].meeting_id == "00000000-0000-0000-0000-0000000000aa"
    # Transitioned to joining; the queue fallback was NOT used.
    meeting_service.update_meeting_status.assert_awaited()
    queue_service.queue_meeting.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_dispatch_meeting_compose_mode_marks_failed_when_unreachable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Worker unreachable → meeting marked failed, no crash, no queue fallback."""
    monkeypatch.setenv("RUNTIME_MODE", "compose")
    monkeypatch.setenv("MEETING_WORKER_SIDECAR_URL", "http://meeting-worker:9000")

    meeting_service = AsyncMock()
    queue_service = AsyncMock()

    async def boom(worker_url: str, payload: SidecarConfigurePayload) -> None:
        raise httpx.ConnectError("connection refused")

    with patch.object(cwd, "_post_configure", new=boom):
        dispatched, message = await dispatch_meeting(
            meeting_id="00000000-0000-0000-0000-0000000000bb",
            meeting_url="https://meet.google.com/abc-defg-hij",
            platform="googlemeet",
            transcript_source="gmeet_captions",
            bot_name="Parlor Notetaker",
            org_id="org-1",
            meeting_service=meeting_service,
            queue_service=queue_service,
        )

    assert dispatched is False
    assert "failed" in message.lower()
    # Marked failed with the unreachable exit reason.
    args, kwargs = meeting_service.update_meeting_status.await_args
    assert kwargs.get("exit_reason") == "meeting_worker_unreachable"
    queue_service.queue_meeting.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_dispatch_meeting_compose_without_worker_url_falls_back_inprocess(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Bare RUNTIME_MODE=compose (no worker URL) keeps the in-process path so a
    single-container dev box still works — i.e. we don't break standalone."""
    monkeypatch.setenv("RUNTIME_MODE", "compose")
    monkeypatch.delenv("MEETING_WORKER_SIDECAR_URL", raising=False)

    meeting_service = AsyncMock()
    queue_service = AsyncMock()

    with patch(
        "src.services.local_bot_runner.dispatch_local_bot",
        new=AsyncMock(return_value=True),
    ) as local:
        dispatched, _message = await dispatch_meeting(
            meeting_id="00000000-0000-0000-0000-0000000000cc",
            meeting_url="https://meet.google.com/abc-defg-hij",
            platform="googlemeet",
            transcript_source="gmeet_captions",
            bot_name="Parlor Notetaker",
            org_id="org-1",
            meeting_service=meeting_service,
            queue_service=queue_service,
        )

    assert dispatched is True
    local.assert_awaited_once()
