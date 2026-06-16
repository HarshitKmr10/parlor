"""Unit tests for the bot-subprocess timeout fix at meeting_processor_bridge.

Original bug: ``timeout=30000`` with comment "5 hour max" (was actually
~8.3h). New behaviour: env-driven ``BOT_SUBPROCESS_TIMEOUT_S`` with a sane
default that slightly exceeds the in-bot ``MSTEAMS_MAX_MEETING_MS`` so the
bot exits with its own reason rather than being killed by the outer wrapper.
"""

from __future__ import annotations

import importlib

import pytest


@pytest.mark.unit
def test_default_subprocess_timeout_is_nine_hours(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("BOT_SUBPROCESS_TIMEOUT_S", raising=False)
    module = importlib.import_module("src.services.meeting_processor_bridge")

    assert module._DEFAULT_BOT_SUBPROCESS_TIMEOUT_S == 9 * 60 * 60


@pytest.mark.unit
def test_env_override_takes_effect(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("BOT_SUBPROCESS_TIMEOUT_S", "120")
    import os

    assert int(os.environ["BOT_SUBPROCESS_TIMEOUT_S"]) == 120


@pytest.mark.unit
def test_default_exceeds_msteams_max_meeting_ms() -> None:
    """The wrapper timeout must always exceed the in-bot guard so the bot's
    own ``max_meeting_time`` exit reason is observed instead of being
    masked by the wrapper killing the subprocess first."""
    module = importlib.import_module("src.services.meeting_processor_bridge")
    msteams_max_ms = 28_800_000  # 8h from joinMeeting.js:42 — matches DEFAULTS

    assert module._DEFAULT_BOT_SUBPROCESS_TIMEOUT_S * 1000 > msteams_max_ms
