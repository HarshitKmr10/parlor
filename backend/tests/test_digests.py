"""Unit tests for digest scheduling predicate + rendering."""

from datetime import datetime, timezone

from src.digests import is_due, render_digest_text

MON_14 = datetime(2026, 6, 29, 14, 0, tzinfo=timezone.utc)  # Monday 14:00 UTC


def _pref(**over):
    base = {
        "enabled": True,
        "frequency": "weekly",
        "hour_utc": 13,
        "day_of_week": 0,  # Monday
        "channel": "email",
        "target": "ops@example.com",
    }
    base.update(over)
    return base


def test_disabled_never_due():
    assert is_due(_pref(enabled=False), MON_14, None) is False


def test_no_target_never_due():
    assert is_due(_pref(target=None), MON_14, None) is False


def test_before_hour_not_due():
    assert is_due(_pref(hour_utc=15), MON_14, None) is False


def test_weekly_due_on_matching_weekday():
    assert is_due(_pref(day_of_week=0), MON_14, None) is True


def test_weekly_not_due_on_other_weekday():
    assert is_due(_pref(day_of_week=2), MON_14, None) is False  # Wed != Mon


def test_not_sent_twice_same_day():
    sent_today = datetime(2026, 6, 29, 13, 5, tzinfo=timezone.utc)
    assert is_due(_pref(), MON_14, sent_today) is False


def test_daily_due_each_new_day():
    sent_yesterday = datetime(2026, 6, 28, 13, 5, tzinfo=timezone.utc)
    assert is_due(_pref(frequency="daily"), MON_14, sent_yesterday) is True


def test_render_includes_key_numbers():
    digest = {
        "meeting_count": 3,
        "completed_count": 2,
        "total_duration_sec": 7200,
        "busiest_day": "2026-06-29",
        "action_items": {
            "total": 5,
            "open": 4,
            "done": 1,
            "by_assignee": [{"assignee": "Bob", "open": 2, "done": 0}],
        },
        "meetings": [{"title": "Q3 Planning"}],
    }
    text = render_digest_text(digest, "Acme")
    assert "Acme" in text
    assert "Meetings: 3" in text
    assert "2.0h" in text
    assert "Bob" in text
    assert "Q3 Planning" in text
