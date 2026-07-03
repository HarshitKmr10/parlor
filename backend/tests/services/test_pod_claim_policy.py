"""Unit tests for pod claim age policy.

Direct port of an internal sandbox-orchestration test pattern, adapted to meeting-joiner defaults.
The math is intentionally identical — proves we haven't introduced a regression
while porting.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from src.services.pod_claim_policy import (
    compute_max_claimable_age_seconds,
    pod_age_seconds,
)


@pytest.mark.unit
def test_max_claimable_age_with_meeting_joiner_defaults() -> None:
    """With meeting-joiner defaults (9h deadline, 1h buffer), pods older than
    8h should be rejected at claim time."""
    result = compute_max_claimable_age_seconds(
        active_deadline_seconds=9 * 60 * 60,
        claim_age_buffer_seconds=60 * 60,
        min_remaining_lifetime_seconds=60,
    )
    assert result == 8 * 60 * 60


@pytest.mark.unit
def test_max_claimable_age_clamps_buffer_to_floor() -> None:
    """The buffer can't consume the whole deadline — min_remaining floor wins."""
    result = compute_max_claimable_age_seconds(
        active_deadline_seconds=120,
        claim_age_buffer_seconds=200,  # absurdly large
        min_remaining_lifetime_seconds=10,
    )
    # Should leave at least min_remaining (10s) of life.
    assert result == 110


@pytest.mark.unit
def test_max_claimable_age_handles_zero_deadline() -> None:
    """Defensive: deadline=0 (misconfigured) should not crash."""
    result = compute_max_claimable_age_seconds(
        active_deadline_seconds=0,
        claim_age_buffer_seconds=60,
        min_remaining_lifetime_seconds=10,
    )
    assert result == 1


@pytest.mark.unit
def test_pod_age_seconds_from_datetime() -> None:
    now = datetime.now(timezone.utc)
    age = pod_age_seconds(now - timedelta(seconds=120))
    assert age is not None
    assert 119 <= age <= 121


@pytest.mark.unit
def test_pod_age_seconds_from_naive_datetime_treated_as_utc() -> None:
    naive = datetime.utcnow() - timedelta(seconds=30)
    age = pod_age_seconds(naive)
    assert age is not None
    assert 29 <= age <= 31


@pytest.mark.unit
def test_pod_age_seconds_from_iso_string() -> None:
    now = datetime.now(timezone.utc) - timedelta(seconds=60)
    age = pod_age_seconds(now.isoformat())
    assert age is not None
    assert 59 <= age <= 61


@pytest.mark.unit
def test_pod_age_seconds_handles_none() -> None:
    assert pod_age_seconds(None) is None


@pytest.mark.unit
def test_pod_age_seconds_handles_garbage() -> None:
    assert pod_age_seconds(object()) is None
