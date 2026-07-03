"""Tests for SimpleZoomBot's teardown safety and exit-reason reporting.

Regressions for #92 (leave() had no exception guard around the SDK Leave()
call, unlike every other SDK teardown call in cleanup()) and #93 (auth/join
failures never surfaced as a queryable exit reason on the meeting row — no
callback existed for auth_return()/meeting_status_changed() to invoke).

The real ``zoom_meeting_sdk`` package isn't installed in this test
environment (see zoom_bot_simple.ZOOM_SDK_AVAILABLE), so the module-level
``zoom`` name doesn't exist. Every test injects a small fake via
monkeypatch.setattr(..., raising=False) instead of importing the real SDK.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from src.bot.zoom_sdk_bot import zoom_bot_simple
from src.bot.zoom_sdk_bot.zoom_bot_simple import FAILURE_REASON_BY_CODE, SimpleZoomBot


def _fake_zoom():
    # meeting_status_changed() falls back to int(status) when the value has
    # no `.value` attribute (see zoom_bot_simple.py), so these must be
    # int-convertible like the real SDK's enum values.
    return SimpleNamespace(
        MEETING_STATUS_IDLE=0,
        MEETING_STATUS_FAILED=1,
        MEETING_STATUS_INMEETING=2,
        MEETING_STATUS_CONNECTING=3,
        MEETING_STATUS_ENDED=4,
        AUTHRET_SUCCESS="AUTH_SUCCESS",
        LEAVE_MEETING="LEAVE_MEETING",
    )


def _bot(**kwargs):
    return SimpleZoomBot(
        client_id="client-1",
        client_secret="secret-1",
        meeting_id="1234567890",
        meeting_password="pw",
        bot_name="Test Bot",
        **kwargs,
    )


def test_leave_swallows_exception_from_sdk_leave_call(monkeypatch):
    fake_zoom = _fake_zoom()
    monkeypatch.setattr(zoom_bot_simple, "zoom", fake_zoom, raising=False)

    bot = _bot()
    bot.meeting_service = MagicMock()
    bot.meeting_service.GetMeetingStatus.return_value = "IN_MEETING"
    bot.meeting_service.Leave.side_effect = RuntimeError("SDK teardown boom")

    bot.leave()  # must not raise

    bot.meeting_service.Leave.assert_called_once_with(fake_zoom.LEAVE_MEETING)


def test_leave_is_noop_when_meeting_service_missing():
    bot = _bot()
    bot.meeting_service = None

    bot.leave()  # must not raise


def test_leave_is_noop_when_status_idle(monkeypatch):
    fake_zoom = _fake_zoom()
    monkeypatch.setattr(zoom_bot_simple, "zoom", fake_zoom, raising=False)

    bot = _bot()
    bot.meeting_service = MagicMock()
    bot.meeting_service.GetMeetingStatus.return_value = fake_zoom.MEETING_STATUS_IDLE

    bot.leave()

    bot.meeting_service.Leave.assert_not_called()


def test_auth_return_success_joins_meeting(monkeypatch):
    fake_zoom = _fake_zoom()
    monkeypatch.setattr(zoom_bot_simple, "zoom", fake_zoom, raising=False)

    on_exit_reason = MagicMock()
    bot = _bot(on_exit_reason=on_exit_reason)
    bot.join_meeting = MagicMock()

    bot.auth_return(fake_zoom.AUTHRET_SUCCESS)

    bot.join_meeting.assert_called_once()
    on_exit_reason.assert_not_called()


def test_auth_return_failure_reports_auth_failed_and_raises(monkeypatch):
    fake_zoom = _fake_zoom()
    monkeypatch.setattr(zoom_bot_simple, "zoom", fake_zoom, raising=False)

    on_exit_reason = MagicMock()
    bot = _bot(on_exit_reason=on_exit_reason)

    with pytest.raises(Exception, match="Failed to authorize"):
        bot.auth_return("AUTH_FAILED_CODE")

    on_exit_reason.assert_called_once_with(
        "auth_failed", {"result": "AUTH_FAILED_CODE"}
    )


@pytest.mark.parametrize(
    "code,expected_reason",
    [
        (3, "join_rejected_password"),
        (9, "join_rejected_locked"),
        (8, "auth_failed"),
        (999, "join_rejected"),
    ],
)
def test_meeting_status_changed_failed_reports_mapped_reason(monkeypatch, code, expected_reason):
    fake_zoom = _fake_zoom()
    monkeypatch.setattr(zoom_bot_simple, "zoom", fake_zoom, raising=False)

    on_exit_reason = MagicMock()
    bot = _bot(on_exit_reason=on_exit_reason)

    bot.meeting_status_changed(fake_zoom.MEETING_STATUS_FAILED, code)

    assert on_exit_reason.call_count == 1
    (reason, details), _ = on_exit_reason.call_args
    assert reason == expected_reason
    assert details["code"] == code


def test_meeting_status_changed_success_does_not_report_exit_reason(monkeypatch):
    fake_zoom = _fake_zoom()
    monkeypatch.setattr(zoom_bot_simple, "zoom", fake_zoom, raising=False)

    on_exit_reason = MagicMock()
    bot = _bot(on_exit_reason=on_exit_reason)
    bot.on_join = MagicMock()

    bot.meeting_status_changed(fake_zoom.MEETING_STATUS_INMEETING, 0)

    on_exit_reason.assert_not_called()


def test_report_exit_reason_swallows_callback_exception():
    bad_callback = MagicMock(side_effect=RuntimeError("callback boom"))
    bot = _bot(on_exit_reason=bad_callback)

    bot._report_exit_reason("auth_failed", {"result": "x"})  # must not raise

    bad_callback.assert_called_once()


def test_report_exit_reason_is_noop_without_callback():
    bot = _bot()  # on_exit_reason defaults to None

    bot._report_exit_reason("auth_failed", {"result": "x"})  # must not raise


def test_failure_reason_map_covers_documented_examples():
    assert FAILURE_REASON_BY_CODE[9] == "join_rejected_locked"
    assert FAILURE_REASON_BY_CODE[3] == "join_rejected_password"
    assert FAILURE_REASON_BY_CODE[8] == "auth_failed"
