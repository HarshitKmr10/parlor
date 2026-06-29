"""Unit tests for retention selection logic (pure)."""

from datetime import datetime, timedelta, timezone

from src.compliance import cutoff_for, select_expired

NOW = datetime(2026, 6, 29, 12, 0, tzinfo=timezone.utc)


def _m(id_, days_ago):
    return {"id": id_, "created_at": NOW - timedelta(days=days_ago)}


def test_cutoff_none_when_keep_forever():
    assert cutoff_for(None, NOW) is None
    assert cutoff_for(0, NOW) is None


def test_cutoff_subtracts_days():
    assert cutoff_for(30, NOW) == NOW - timedelta(days=30)


def test_select_expired_basic():
    meetings = [_m("old", 40), _m("recent", 5), _m("edge", 31)]
    expired = select_expired(meetings, retention_days=30, legal_hold=False, now=NOW)
    assert set(expired) == {"old", "edge"}


def test_legal_hold_pauses_all_deletion():
    meetings = [_m("old", 400)]
    assert select_expired(meetings, retention_days=30, legal_hold=True, now=NOW) == []


def test_keep_forever_deletes_nothing():
    meetings = [_m("old", 9999)]
    assert select_expired(meetings, retention_days=None, legal_hold=False, now=NOW) == []
