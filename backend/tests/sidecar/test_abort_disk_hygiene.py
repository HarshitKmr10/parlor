"""Tests for POST /abort wiring DiskHygiene cleanup (issue #87).

Mirrors tests/sidecar/test_main_secret_validation.py's convention of
exercising src.sidecar.main directly with a fake state manager.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from src.sidecar import main as sidecar_main
from src.sidecar.models import AbortRequest
from src.sidecar.state import MeetingState, SidecarStateSnapshot


def _snapshot(meeting_id: str | None) -> SidecarStateSnapshot:
    return SidecarStateSnapshot(
        meeting_state=MeetingState.IN_MEETING,
        current_meeting_id=meeting_id,
        current_session_number=1,
        bot_pid=123,
        bot_returncode=None,
        exit_reason=None,
        started_at=datetime.now(timezone.utc),
        config=None,
    )


class FakeStateManager:
    def __init__(self, meeting_id: str | None) -> None:
        self._meeting_id = meeting_id
        self.mark_ended_calls: list[tuple[int | None, str]] = []

    async def snapshot(self) -> SidecarStateSnapshot:
        return _snapshot(self._meeting_id)

    async def mark_ended(self, *, returncode, exit_reason) -> None:  # noqa: ANN001
        self.mark_ended_calls.append((returncode, exit_reason))


@pytest.mark.asyncio
@pytest.mark.unit
async def test_abort_flushes_disk_hygiene_for_current_meeting(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    cleanup_calls: list[str] = []

    async def fake_terminate(*, grace_seconds):  # noqa: ANN001
        return 0, "graceful_sigterm"

    async def fake_flush_and_cleanup(meeting_id: str) -> int:
        cleanup_calls.append(meeting_id)
        return 0

    fake_state_manager = FakeStateManager("meeting-42")

    monkeypatch.setattr(sidecar_main, "state_manager", fake_state_manager)
    monkeypatch.setattr(sidecar_main.bot_supervisor, "terminate", fake_terminate)
    monkeypatch.setattr(
        sidecar_main.disk_hygiene, "flush_and_cleanup", fake_flush_and_cleanup
    )

    response = await sidecar_main.abort(AbortRequest(reason="client_requested"))

    assert cleanup_calls == ["meeting-42"]
    assert response.exit_reason == "client_requested:graceful_sigterm"
    assert fake_state_manager.mark_ended_calls == [
        (0, "client_requested:graceful_sigterm")
    ]


@pytest.mark.asyncio
@pytest.mark.unit
async def test_abort_skips_disk_hygiene_when_no_meeting_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    cleanup_calls: list[str] = []

    async def fake_terminate(*, grace_seconds):  # noqa: ANN001
        return None, "no_bot_running"

    async def fake_flush_and_cleanup(meeting_id: str) -> int:
        cleanup_calls.append(meeting_id)
        return 0

    fake_state_manager = FakeStateManager(None)

    monkeypatch.setattr(sidecar_main, "state_manager", fake_state_manager)
    monkeypatch.setattr(sidecar_main.bot_supervisor, "terminate", fake_terminate)
    monkeypatch.setattr(
        sidecar_main.disk_hygiene, "flush_and_cleanup", fake_flush_and_cleanup
    )

    await sidecar_main.abort(AbortRequest(reason="client_requested"))

    assert cleanup_calls == []
