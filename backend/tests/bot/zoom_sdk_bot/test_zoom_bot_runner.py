"""Tests for ZoomBotRunner's process exit-status contract.

Regression for #80: force_exit() used to unconditionally os._exit(0), so the
supervisor (bot_supervisor.py / local_bot_runner.py) misread every failure
path (SDK init exception, main-loop exception) as a clean success. These
tests mock os._exit and assert the status code threaded through each call
site, never spawning a real GLib main loop or the Zoom SDK.
"""

from __future__ import annotations

import os
import subprocess
import sys
from unittest.mock import MagicMock, patch

import pytest

from src.bot.zoom_sdk_bot.zoom_bot_runner import ZoomBotRunner


def _runner() -> ZoomBotRunner:
    return ZoomBotRunner(
        client_id="client-1",
        client_secret="secret-1",
        meeting_id="1234567890",
        meeting_password="pw",
        bot_name="Test Bot",
    )


def test_force_exit_defaults_to_status_zero():
    runner = _runner()
    with patch("src.bot.zoom_sdk_bot.zoom_bot_runner.os._exit") as exit_mock:
        runner.force_exit()
    exit_mock.assert_called_once_with(0)


def test_force_exit_propagates_nonzero_status():
    runner = _runner()
    with patch("src.bot.zoom_sdk_bot.zoom_bot_runner.os._exit") as exit_mock:
        runner.force_exit(2)
    exit_mock.assert_called_once_with(2)


def test_exit_process_clean_shutdown_exits_zero():
    runner = _runner()
    runner.bot = None  # no bot attached — cleanup branch is skipped entirely
    with patch("src.bot.zoom_sdk_bot.zoom_bot_runner.os._exit") as exit_mock:
        runner.exit_process()
    exit_mock.assert_called_once_with(0)


def test_exit_process_forwards_nonzero_status_on_clean_path():
    """run()'s init-failure branch calls exit_process(status=2); with no bot
    attached the cleanup path is a no-op, so force_exit must still see 2."""
    runner = _runner()
    runner.bot = None
    with patch("src.bot.zoom_sdk_bot.zoom_bot_runner.os._exit") as exit_mock:
        runner.exit_process(status=2)
    exit_mock.assert_called_once_with(2)


def test_exit_process_cleanup_failure_exits_nonzero():
    """If bot.leave()/cleanup() itself raises, force_exit must still report a
    non-zero status rather than falling through to the old os._exit(0)."""
    runner = _runner()
    bad_bot = MagicMock()
    bad_bot.leave.side_effect = RuntimeError("boom")
    runner.bot = bad_bot

    with patch("src.bot.zoom_sdk_bot.zoom_bot_runner.os._exit") as exit_mock:
        runner.exit_process()

    exit_mock.assert_called_once()
    (status,), _ = exit_mock.call_args
    assert status != 0


def test_exit_process_is_idempotent_and_does_not_reexit():
    runner = _runner()
    runner.bot = None
    runner.shutdown_requested = True
    with patch("src.bot.zoom_sdk_bot.zoom_bot_runner.os._exit") as exit_mock:
        result = runner.exit_process()
    assert result is False
    exit_mock.assert_not_called()


@pytest.mark.parametrize(
    "raise_in_main_loop,expected_status",
    [(False, 0), (True, 1)],
)
def test_run_threads_main_loop_exception_into_exit_status(
    raise_in_main_loop, expected_status
):
    """run()'s finally: exit_process(status=exit_status) must report 1 when
    main_loop.run() raises, and 0 on a clean loop exit (e.g. signal-driven
    shutdown that calls main_loop.quit())."""
    runner = _runner()

    fake_bot = MagicMock()
    fake_bot.init.return_value = None
    fake_main_loop = MagicMock()
    if raise_in_main_loop:
        fake_main_loop.run.side_effect = RuntimeError("loop blew up")

    captured_status = {}

    def fake_exit_process(status: int = 0):
        captured_status["status"] = status
        return False

    with patch(
        "src.bot.zoom_sdk_bot.zoom_bot_runner.SimpleZoomBot",
        return_value=fake_bot,
    ), patch(
        # create=True: GLib is only bound at module level when `gi` is
        # importable (see the module's own try/except at import time), which
        # this test environment doesn't have.
        "src.bot.zoom_sdk_bot.zoom_bot_runner.GLib",
        create=True,
    ) as fake_glib, patch(
        "src.bot.zoom_sdk_bot.zoom_bot_runner.signal.signal"
    ):
        fake_glib.MainLoop.return_value = fake_main_loop
        with patch.object(runner, "exit_process", side_effect=fake_exit_process):
            runner.run()

    assert captured_status["status"] == expected_status


def test_run_init_failure_exits_status_two():
    """run()'s init-failure branch: SimpleZoomBot.init() raising must exit
    with status 2 (SDK init exception), distinct from a clean shutdown."""
    runner = _runner()
    fake_bot = MagicMock()
    fake_bot.init.side_effect = Exception("InitSDK failed")

    captured_status = {}

    def fake_exit_process(status: int = 0):
        captured_status["status"] = status
        return False

    with patch(
        "src.bot.zoom_sdk_bot.zoom_bot_runner.SimpleZoomBot",
        return_value=fake_bot,
    ):
        with patch.object(runner, "exit_process", side_effect=fake_exit_process):
            runner.run()

    assert captured_status["status"] == 2


REPO_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

# Cleared before every subprocess run so ambient env state from the parent
# test process (or CI) can never leak into the meeting-id/password precedence
# being asserted below.
_ZOOM_ID_ENV_VARS = ("ZOOM_MEETING_NUMBER", "ZOOM_MEETING_PWD", "MEETING_ID", "MEETING_PWD")


def _run_module_subprocess(env_overrides: dict) -> subprocess.CompletedProcess:
    env = os.environ.copy()
    for key in _ZOOM_ID_ENV_VARS:
        env.pop(key, None)
    env.update(env_overrides)
    env["PYTHONPATH"] = REPO_BACKEND_DIR
    return subprocess.run(
        [sys.executable, "-m", "src.bot.zoom_sdk_bot.zoom_bot_runner"],
        cwd=REPO_BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        timeout=15,
    )


def test_main_reads_dedicated_zoom_env_vars_not_meeting_id():
    """End-to-end regression for #79: the module's __main__ block must join
    the real Zoom meeting number from ZOOM_MEETING_NUMBER/ZOOM_MEETING_PWD —
    the vars bot_supervisor.py/local_bot_runner.py now populate — not the
    meeting_joiner DB row id that MEETING_ID carries elsewhere in the stack.

    Runs the module as a real subprocess (its actual production entrypoint,
    `python -m src.bot.zoom_sdk_bot.zoom_bot_runner`). Without the Zoom SDK
    installed, SimpleZoomBot.init() fails fast, so this doubles as an #80
    regression: the process must exit non-zero (2), not 0.
    """
    result = _run_module_subprocess(
        {
            "ZOOM_MEETING_NUMBER": "1234567890",
            "ZOOM_MEETING_PWD": "secretpw",
            "ZOOM_CLIENT_ID": "fake-client-id",
            "ZOOM_CLIENT_SECRET": "fake-client-secret",
            "MEETING_ID": "db-row-uuid-should-not-be-used",
            "MEETING_PWD": "",
        }
    )

    assert "Meeting ID: 1234567890" in result.stdout + result.stderr
    assert "db-row-uuid-should-not-be-used" not in (result.stdout + result.stderr)
    # SDK unavailable in the test environment -> init fails -> non-zero exit,
    # never the old unconditional os._exit(0).
    assert result.returncode != 0


def test_main_falls_back_to_legacy_meeting_id_env_vars():
    """Manual/legacy invocation without the dedicated vars still works."""
    result = _run_module_subprocess(
        {
            "MEETING_ID": "1234567890",
            "MEETING_PWD": "secretpw",
            "ZOOM_CLIENT_ID": "fake-client-id",
            "ZOOM_CLIENT_SECRET": "fake-client-secret",
        }
    )

    assert "Meeting ID: 1234567890" in result.stdout + result.stderr
    assert result.returncode != 0


def test_main_exits_one_with_usage_when_no_meeting_id_available():
    result = _run_module_subprocess({})

    assert result.returncode == 1
    assert "Usage" in result.stdout + result.stderr
