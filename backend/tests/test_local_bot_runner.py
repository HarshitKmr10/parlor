"""Tests for the standalone LocalBotRunner.

Covers the degradation contract (disabled mode → failed, missing runtime →
failed) and the argv matrix. No real subprocess is spawned.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.api.models.schemas import MeetingStatus
from src.services import local_bot_runner
from src.services.local_bot_runner import (
    EXIT_RUNTIME_UNAVAILABLE,
    LocalBotRunner,
    _argv_for_platform,
)

MEET_URL = "https://meet.google.com/abc-defg-hij"


def _runner(meeting_id="m-1", platform="googlemeet"):
    return LocalBotRunner(
        meeting_id=meeting_id,
        meeting_url=MEET_URL,
        platform=platform,
        bot_name=None,
        transcript_source=None,
        org_id=None,
    )


def test_argv_matrix():
    assert _argv_for_platform("googlemeet")[0] == "node"
    assert _argv_for_platform("msteams")[0] == "node"
    assert _argv_for_platform("zoom")[:2] == ["python", "-m"]
    with pytest.raises(ValueError):
        _argv_for_platform("webex")


def test_build_env_parses_zoom_meeting_number_and_password():
    """Regression for #79: MEETING_ID carries the DB row id, not a joinable
    Zoom meeting number, so zoom_bot_runner.py needs the real number +
    password parsed out of meeting_url and passed via dedicated env vars."""
    runner = LocalBotRunner(
        meeting_id="db-row-uuid",
        meeting_url="https://zoom.us/j/1234567890?pwd=abcdef",
        platform="zoom",
        bot_name=None,
        transcript_source=None,
        org_id="org-1",
    )

    env = runner._build_env()

    assert env["ZOOM_MEETING_NUMBER"] == "1234567890"
    assert env["ZOOM_MEETING_PWD"] == "abcdef"
    # MEETING_ID keeps carrying the DB row id — it is not overloaded.
    assert env["MEETING_ID"] == "db-row-uuid"


def test_build_env_skips_zoom_env_vars_for_non_zoom_platforms():
    runner = LocalBotRunner(
        meeting_id="db-row-uuid",
        meeting_url=MEET_URL,
        platform="googlemeet",
        bot_name=None,
        transcript_source=None,
        org_id="org-1",
    )

    env = runner._build_env()

    assert "ZOOM_MEETING_NUMBER" not in env
    assert "ZOOM_MEETING_PWD" not in env


@pytest.mark.asyncio
async def test_disabled_mode_marks_failed_without_spawn(monkeypatch):
    monkeypatch.setattr(local_bot_runner.settings, "MEETING_BOT_MODE", "disabled")

    svc = AsyncMock()
    runner = _runner()
    with patch.object(runner, "_service", AsyncMock(return_value=svc)), patch(
        "asyncio.create_subprocess_exec"
    ) as spawn:
        spawned = await runner.start()

    assert spawned is False
    spawn.assert_not_called()
    # Marked failed with the runtime-unavailable exit reason.
    svc.update_meeting_status.assert_awaited()
    call = svc.update_meeting_status.await_args
    assert call.args[1] == MeetingStatus.FAILED
    assert call.kwargs["exit_reason"] == EXIT_RUNTIME_UNAVAILABLE


@pytest.mark.asyncio
async def test_missing_runtime_marks_failed(monkeypatch):
    monkeypatch.setattr(local_bot_runner.settings, "MEETING_BOT_MODE", "subprocess")
    # Simulate node missing.
    monkeypatch.setattr(local_bot_runner.shutil, "which", lambda _: None)

    svc = AsyncMock()
    runner = _runner()
    with patch.object(runner, "_service", AsyncMock(return_value=svc)), patch(
        "asyncio.create_subprocess_exec"
    ) as spawn:
        spawned = await runner.start()

    assert spawned is False
    spawn.assert_not_called()
    assert svc.update_meeting_status.await_args.args[1] == MeetingStatus.FAILED


@pytest.mark.asyncio
async def test_spawns_when_runtime_available(monkeypatch):
    monkeypatch.setattr(local_bot_runner.settings, "MEETING_BOT_MODE", "subprocess")
    monkeypatch.setattr(local_bot_runner, "_runtime_check", lambda _platform: None)

    svc = AsyncMock()
    fake_proc = AsyncMock()
    fake_proc.returncode = None
    fake_proc.stdout = None
    fake_proc.stderr = None
    fake_proc.terminate = MagicMock()  # real Process.terminate is sync

    runner = _runner()
    with patch.object(runner, "_service", AsyncMock(return_value=svc)), patch(
        "asyncio.create_subprocess_exec", AsyncMock(return_value=fake_proc)
    ), patch("asyncio.create_task"):
        spawned = await runner.start()

    assert spawned is True
    # First transition is to JOINING.
    statuses = [c.args[1] for c in svc.update_meeting_status.await_args_list]
    assert MeetingStatus.JOINING in statuses
    await runner.stop()
