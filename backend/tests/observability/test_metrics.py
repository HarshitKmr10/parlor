"""Unit tests for the metric inventory.

We assert the dataclass is fully populated and that get_metrics() is a
singleton — both properties matter because re-registration of an OTel
instrument with the same name produces a duplicate-export warning at
runtime.
"""

from __future__ import annotations

import dataclasses

import pytest

from src.observability.metrics import (
    MeetingJoinerMetrics,
    _reset_metrics_for_tests,
    get_metrics,
)


@pytest.fixture(autouse=True)
def _isolate_metrics_singleton():
    _reset_metrics_for_tests()
    yield
    _reset_metrics_for_tests()


@pytest.mark.unit
def test_get_metrics_returns_singleton() -> None:
    first = get_metrics()
    second = get_metrics()

    assert first is second, "Repeated calls must return the same instance"


@pytest.mark.unit
def test_all_metric_fields_populated() -> None:
    metrics = get_metrics()

    for field in dataclasses.fields(MeetingJoinerMetrics):
        instrument = getattr(metrics, field.name)
        assert instrument is not None, f"Metric {field.name} was None"


@pytest.mark.unit
def test_metric_inventory_covers_required_categories() -> None:
    """Smoke test against accidental deletion of categories.

    The list below is the contract from docs/recall-replacement-plan.md §6.
    If a category disappears, fail loudly so a PR review notices.
    """
    metrics = get_metrics()
    names = {field.name for field in dataclasses.fields(MeetingJoinerMetrics)}

    expected = {
        # pool
        "warm_pool_size",
        "warm_pool_claim_total",
        "warm_pool_replenish_total",
        # pod
        "pod_create_duration",
        "pod_oom_kills_total",
        # meeting
        "meeting_create_total",
        "meeting_join_latency",
        "meeting_active",
        # session
        "session_total",
        "rejoin_total",
        # transcript
        "transcript_segments_total",
        "transcript_lag",
        # webhook
        "webhook_delivery_attempts_total",
        # calendar
        "calendar_poll_total",
        "calendar_events_scheduled_total",
        # canary / circuit
        "canary_runs_total",
        "circuit_breaker_state",
        "selector_failures_total",
    }
    missing = expected - names
    assert not missing, f"Metric inventory is missing: {missing}"

    # Quick sanity: verify dataclass is frozen so callers can't reassign.
    with pytest.raises(dataclasses.FrozenInstanceError):
        metrics.warm_pool_size = None  # type: ignore[misc]
