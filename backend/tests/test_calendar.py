"""Tests for calendar OAuth config + the calendar poller."""

from unittest.mock import AsyncMock, patch

import pytest

from src.api.product import calendar_oauth
from src.services.calendar_poller import CalendarPoller, _extract_meeting_url


def test_provider_unconfigured_when_no_creds(monkeypatch):
    monkeypatch.setattr(calendar_oauth.settings, "GOOGLE_CLIENT_ID", None)
    monkeypatch.setattr(calendar_oauth.settings, "GOOGLE_CLIENT_SECRET", None)
    cfg = calendar_oauth.get_provider("google")
    assert cfg is not None
    assert cfg.configured is False


def test_provider_configured_with_creds(monkeypatch):
    monkeypatch.setattr(calendar_oauth.settings, "GOOGLE_CLIENT_ID", "id")
    monkeypatch.setattr(calendar_oauth.settings, "GOOGLE_CLIENT_SECRET", "secret")
    cfg = calendar_oauth.get_provider("google")
    assert cfg.configured is True
    url = calendar_oauth.build_authorize_url(cfg, state="abc")
    assert "client_id=id" in url
    assert "state=abc" in url
    assert "response_type=code" in url


def test_unknown_provider_is_none():
    assert calendar_oauth.get_provider("webex") is None


def test_extract_google_hangout_link():
    event = {"hangoutLink": "https://meet.google.com/abc-defg-hij"}
    assert _extract_meeting_url(event) == "https://meet.google.com/abc-defg-hij"


def test_extract_microsoft_join_url():
    event = {
        "onlineMeeting": {"joinUrl": "https://teams.microsoft.com/l/meetup-join/x"}
    }
    assert _extract_meeting_url(event) == "https://teams.microsoft.com/l/meetup-join/x"


def test_extract_conference_entry_point():
    event = {
        "conferenceData": {
            "entryPoints": [
                {"uri": "tel:+123"},
                {"uri": "https://meet.google.com/xyz-abcd-efg"},
            ]
        }
    }
    assert _extract_meeting_url(event) == "https://meet.google.com/xyz-abcd-efg"


def test_extract_returns_none_for_no_url():
    assert _extract_meeting_url({"summary": "lunch"}) is None


@pytest.mark.asyncio
async def test_poller_noops_without_creds(monkeypatch):
    monkeypatch.setattr(
        CalendarPoller, "_any_provider_configured", staticmethod(lambda: False)
    )
    poller = CalendarPoller()
    # get_db_connection must NOT be called when unconfigured.
    with patch(
        "src.services.calendar_poller.get_db_connection",
        new=AsyncMock(),
    ) as get_db:
        dispatched = await poller.scan_once()
    assert dispatched == 0
    get_db.assert_not_awaited()


@pytest.mark.asyncio
async def test_poller_noops_with_no_accounts(monkeypatch):
    monkeypatch.setattr(
        CalendarPoller, "_any_provider_configured", staticmethod(lambda: True)
    )
    db = AsyncMock()
    poller = CalendarPoller()
    with patch(
        "src.services.calendar_poller.get_db_connection",
        new=AsyncMock(return_value=db),
    ), patch(
        "src.services.calendar_poller.CalendarRepo"
    ) as repo_cls:
        repo_cls.return_value.list_auto_join_accounts = AsyncMock(return_value=[])
        dispatched = await poller.scan_once()
    assert dispatched == 0
