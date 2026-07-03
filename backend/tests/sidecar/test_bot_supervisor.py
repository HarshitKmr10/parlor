"""Tests for BotSupervisor's env/argv construction and the /configure
concurrency guard.

No real subprocess is spawned — ``_build_env``/``_argv_for_platform`` are
pure functions, and the concurrency test monkeypatches
``asyncio.create_subprocess_exec``.
"""

from __future__ import annotations

import asyncio

import pytest

from src.sidecar import main as sidecar_main
from src.sidecar.bot_supervisor import BotSupervisor, _argv_for_platform, _build_env
from src.sidecar.models import ConfigureRequest
from src.sidecar.state import MeetingState, SidecarStateManager

ZOOM_URL = "https://zoom.us/j/1234567890?pwd=abcdef"


def _zoom_request(**overrides) -> ConfigureRequest:
    fields = dict(
        meeting_id="meeting-1",
        meeting_url=ZOOM_URL,
        org_id="org-1",
        platform="zoom",
        bot_name="Meeting Bot",
    )
    fields.update(overrides)
    return ConfigureRequest(**fields)


def test_argv_matrix():
    assert _argv_for_platform("googlemeet")[0] == "node"
    assert _argv_for_platform("msteams")[0] == "node"
    assert _argv_for_platform("zoom")[:2] == ["python", "-m"]
    with pytest.raises(ValueError):
        _argv_for_platform("webex")


def test_build_env_parses_zoom_meeting_number_and_password():
    """Regression for #79: MEETING_ID is the meeting_joiner DB row id, not a
    joinable Zoom meeting number — the real number + password must be parsed
    out of meeting_url and passed via dedicated env vars."""
    env = _build_env(_zoom_request())

    assert env["ZOOM_MEETING_NUMBER"] == "1234567890"
    assert env["ZOOM_MEETING_PWD"] == "abcdef"
    assert env["MEETING_ID"] == "meeting-1"


def test_build_env_skips_zoom_env_vars_for_non_zoom_platforms():
    request = ConfigureRequest(
        meeting_id="meeting-1",
        meeting_url="https://meet.google.com/abc-defg-hij",
        org_id="org-1",
        platform="googlemeet",
        bot_name="Meeting Bot",
    )

    env = _build_env(request)

    assert "ZOOM_MEETING_NUMBER" not in env
    assert "ZOOM_MEETING_PWD" not in env


@pytest.mark.asyncio
async def test_concurrent_configure_calls_reject_second_with_409(monkeypatch):
    """Regression for #81: a TOCTOU race in /configure must not let two
    concurrent requests both pass the busy-check and spawn a bot.

    Uses the REAL state_manager/bot_supervisor (not fakes) so the actual
    ``configure_lock`` in bot_supervisor.py is exercised. ``spawn`` is
    monkeypatched to a slow coroutine so the second request's snapshot is
    guaranteed to race the first's in-flight state if the lock is missing.
    """
    state_manager = SidecarStateManager()
    supervisor = BotSupervisor(state_manager)
    monkeypatch.setattr(sidecar_main, "state_manager", state_manager)
    monkeypatch.setattr(sidecar_main, "bot_supervisor", supervisor)
    monkeypatch.setattr(sidecar_main, "config_for_configure_request", lambda **_: None)
    monkeypatch.setattr(sidecar_main, "validate_secrets", lambda *_args, **_kw: None)

    spawn_calls = 0

    async def slow_spawn(_config: ConfigureRequest) -> int:
        nonlocal spawn_calls
        spawn_calls += 1
        # Yield control so a concurrently-scheduled second request gets a
        # chance to run before this one finishes and marks CONFIGURING.
        await asyncio.sleep(0.05)
        return 4242

    monkeypatch.setattr(supervisor, "spawn", slow_spawn)

    request_a = _zoom_request(meeting_id="meeting-a")
    request_b = _zoom_request(meeting_id="meeting-b")

    results = await asyncio.gather(
        sidecar_main.configure(request_a),
        sidecar_main.configure(request_b),
        return_exceptions=True,
    )

    successes = [r for r in results if not isinstance(r, Exception)]
    failures = [r for r in results if isinstance(r, Exception)]

    assert spawn_calls == 1, "spawn() must be called at most once for one pod"
    assert len(successes) == 1
    assert len(failures) == 1
    from fastapi import HTTPException

    assert isinstance(failures[0], HTTPException)
    assert failures[0].status_code == 409

    snapshot = await state_manager.snapshot()
    assert snapshot.meeting_state == MeetingState.CONFIGURING


@pytest.mark.asyncio
async def test_terminate_awaits_monitor_and_log_pump_tasks(monkeypatch):
    """Regression for #89: monitor/log-pump asyncio tasks must be cancelled
    and awaited on terminate(), not left as fire-and-forget references."""
    import src.sidecar.bot_supervisor as bot_supervisor_module

    monkeypatch.setattr(
        bot_supervisor_module, "_argv_for_platform", lambda _platform: ["sleep", "5"]
    )

    state_manager = SidecarStateManager()
    supervisor = BotSupervisor(state_manager)
    await supervisor.spawn(_zoom_request())

    monitor_task = supervisor._monitor_task
    log_pump_tasks = list(supervisor._log_pump_tasks)
    assert monitor_task is not None
    assert log_pump_tasks

    _returncode, reason = await supervisor.terminate(grace_seconds=1)

    assert reason in ("graceful_exit", "sigkill_after_timeout")
    assert monitor_task.done()
    assert all(task.done() for task in log_pump_tasks)
    assert supervisor._monitor_task is None
    assert supervisor._log_pump_tasks == []


@pytest.mark.asyncio
async def test_spawn_cleans_up_stale_tasks_from_previous_run(monkeypatch):
    """Regression for #89: spawn() must cancel/await any still-tracked
    monitor/log-pump tasks from a previous cycle instead of silently
    overwriting the references."""
    import src.sidecar.bot_supervisor as bot_supervisor_module

    monkeypatch.setattr(
        bot_supervisor_module, "_argv_for_platform", lambda _platform: ["true"]
    )

    state_manager = SidecarStateManager()
    supervisor = BotSupervisor(state_manager)
    await supervisor.spawn(_zoom_request(meeting_id="meeting-1"))

    old_monitor_task = supervisor._monitor_task
    old_log_pump_tasks = list(supervisor._log_pump_tasks)
    assert old_monitor_task is not None

    # Let the (instantly-exiting) "true" process finish and get reaped by
    # the monitor task before spawning again.
    await asyncio.sleep(0.2)

    await supervisor.spawn(_zoom_request(meeting_id="meeting-2"))

    assert old_monitor_task.done()
    assert all(task.done() for task in old_log_pump_tasks)
    assert supervisor._monitor_task is not old_monitor_task

    # Clean up the second run's tasks so nothing leaks past the test.
    await supervisor._cleanup_tasks()
