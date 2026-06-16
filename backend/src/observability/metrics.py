"""Metric inventory for the meeting-joiner.

All metrics emit via OpenTelemetry to the in-cluster collector, which fans out
to Prometheus (via `otelcol/prometheus`), Loki, Tempo, and Uptrace as
configured under `infra/monitoring/`.

Cardinality discipline: labels are restricted to bounded sets (platform,
result enum, source enum). Never label with raw `meeting_id` / `org_id` —
those become unbounded; put them in span attributes and log fields instead.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

try:
    from opentelemetry import metrics
    from opentelemetry.metrics import Counter, Histogram, Meter, UpDownCounter

    _OTEL_AVAILABLE = True
except ModuleNotFoundError:
    # OpenTelemetry is opt-in (see OTEL_ENABLED). Without the package, fall
    # back to no-op instruments so importing this module — and the large set
    # of services that depend on it — never fails.
    _OTEL_AVAILABLE = False
    metrics = None  # type: ignore[assignment]
    Counter = Histogram = Meter = UpDownCounter = object  # type: ignore[misc,assignment]

METER_NAME = "meeting-joiner"


class _NoopInstrument:
    """Stand-in for an OTel instrument when the SDK isn't installed."""

    def add(self, *_args: object, **_kwargs: object) -> None:  # noqa: D401
        return None

    def record(self, *_args: object, **_kwargs: object) -> None:
        return None


class _NoopMeter:
    """Meter whose instruments discard everything. Used when OTel is absent."""

    def create_counter(self, *_args: object, **_kwargs: object) -> _NoopInstrument:
        return _NoopInstrument()

    create_up_down_counter = create_counter
    create_histogram = create_counter


@dataclass(frozen=True)
class MeetingJoinerMetrics:
    """Frozen container of all declared instruments.

    Construct exactly once at startup via :func:`get_metrics`. Holding it in
    a frozen dataclass prevents accidental re-registration which would emit a
    warning and produce duplicate timeseries.
    """

    # Pool
    warm_pool_size: UpDownCounter
    warm_pool_claim_total: Counter
    warm_pool_claim_duration: Histogram
    warm_pool_replenish_total: Counter

    # Pod
    pod_create_duration: Histogram
    pod_oom_kills_total: Counter
    pod_memory_rss_mb: Histogram

    # Meeting lifecycle
    meeting_create_total: Counter
    meeting_create_duration: Histogram
    meeting_join_latency: Histogram
    meeting_join_success_total: Counter
    meeting_active: UpDownCounter
    meeting_duration: Histogram

    # Session / rejoin
    session_total: Counter
    rejoin_total: Counter
    rejoin_duration: Histogram
    bot_heartbeat_missing_total: Counter

    # Transcript
    transcript_segments_total: Counter
    transcript_lag: Histogram

    # Webhook
    webhook_delivery_attempts_total: Counter
    webhook_delivery_duration: Histogram

    # Calendar
    calendar_poll_total: Counter
    calendar_events_scheduled_total: Counter

    # Canary / circuit
    canary_runs_total: Counter
    circuit_breaker_state: UpDownCounter
    selector_failures_total: Counter

    # Storage
    storage_upload_bytes_total: Counter


_metrics_singleton: Optional[MeetingJoinerMetrics] = None


def _build_metrics(meter: Meter) -> MeetingJoinerMetrics:
    return MeetingJoinerMetrics(
        warm_pool_size=meter.create_up_down_counter(
            name="meeting_joiner_warm_pool_size",
            description="Current pool size by status label",
            unit="pods",
        ),
        warm_pool_claim_total=meter.create_counter(
            name="meeting_joiner_warm_pool_claim_total",
            description="Warm pool claim attempts by result",
            unit="1",
        ),
        warm_pool_claim_duration=meter.create_histogram(
            name="meeting_joiner_warm_pool_claim_duration_seconds",
            description="Warm pool claim wall-clock duration",
            unit="s",
        ),
        warm_pool_replenish_total=meter.create_counter(
            name="meeting_joiner_warm_pool_replenish_total",
            description="Pods created by replenish loop by result",
            unit="1",
        ),
        pod_create_duration=meter.create_histogram(
            name="meeting_joiner_pod_create_duration_seconds",
            description="K8s pod create → Ready latency",
            unit="s",
        ),
        pod_oom_kills_total=meter.create_counter(
            name="meeting_joiner_pod_oom_kills_total",
            description="Pod OOM kills detected by platform",
            unit="1",
        ),
        pod_memory_rss_mb=meter.create_histogram(
            name="meeting_joiner_pod_memory_rss_mb",
            description="Bot-runtime RSS sampled at heartbeat",
            unit="MiB",
        ),
        meeting_create_total=meter.create_counter(
            name="meeting_joiner_meeting_create_total",
            description="Meetings created by platform + transcript source",
            unit="1",
        ),
        meeting_create_duration=meter.create_histogram(
            name="meeting_joiner_meeting_create_duration_seconds",
            description="POST /meetings handler latency",
            unit="s",
        ),
        meeting_join_latency=meter.create_histogram(
            name="meeting_joiner_join_latency_seconds",
            description="Meeting request → bot admitted latency",
            unit="s",
        ),
        meeting_join_success_total=meter.create_counter(
            name="meeting_joiner_join_success_total",
            description="Bot join attempts by platform + result",
            unit="1",
        ),
        meeting_active=meter.create_up_down_counter(
            name="meeting_joiner_meeting_active",
            description="Currently-active meetings by platform",
            unit="meetings",
        ),
        meeting_duration=meter.create_histogram(
            name="meeting_joiner_meeting_duration_seconds",
            description="Meeting wall-clock duration by exit reason",
            unit="s",
        ),
        session_total=meter.create_counter(
            name="meeting_joiner_session_total",
            description="Meeting sessions created (session_number=1 is first)",
            unit="1",
        ),
        rejoin_total=meter.create_counter(
            name="meeting_joiner_rejoin_total",
            description="Rejoin attempts by platform + exit reason",
            unit="1",
        ),
        rejoin_duration=meter.create_histogram(
            name="meeting_joiner_rejoin_duration_seconds",
            description="Drop detected → new bot admitted",
            unit="s",
        ),
        bot_heartbeat_missing_total=meter.create_counter(
            name="meeting_joiner_bot_heartbeat_missing_total",
            description="Heartbeat-miss events from reaper",
            unit="1",
        ),
        transcript_segments_total=meter.create_counter(
            name="meeting_joiner_transcript_segments_total",
            description="Transcript segments persisted by platform + source",
            unit="1",
        ),
        transcript_lag=meter.create_histogram(
            name="meeting_joiner_transcript_lag_seconds",
            description="Audio capture → DB persist lag",
            unit="s",
        ),
        webhook_delivery_attempts_total=meter.create_counter(
            name="meeting_joiner_webhook_delivery_attempts_total",
            description="Webhook delivery attempts by result",
            unit="1",
        ),
        webhook_delivery_duration=meter.create_histogram(
            name="meeting_joiner_webhook_delivery_duration_seconds",
            description="Webhook HTTP round trip",
            unit="s",
        ),
        calendar_poll_total=meter.create_counter(
            name="meeting_joiner_calendar_poll_total",
            description="Calendar poll cycles by provider + result",
            unit="1",
        ),
        calendar_events_scheduled_total=meter.create_counter(
            name="meeting_joiner_calendar_events_scheduled_total",
            description="Calendar events dispatched to bot",
            unit="1",
        ),
        canary_runs_total=meter.create_counter(
            name="meeting_joiner_canary_runs_total",
            description="Synthetic canary runs by platform + result",
            unit="1",
        ),
        circuit_breaker_state=meter.create_up_down_counter(
            name="meeting_joiner_circuit_breaker_state",
            description="Circuit breaker state per platform (0 closed / 1 open)",
            unit="1",
        ),
        selector_failures_total=meter.create_counter(
            name="meeting_joiner_selector_failures_total",
            description="DOM selector miss events by platform + selector name",
            unit="1",
        ),
        storage_upload_bytes_total=meter.create_counter(
            name="meeting_joiner_storage_upload_bytes_total",
            description="Bytes uploaded to object storage by kind",
            unit="By",
        ),
    )


def get_metrics() -> MeetingJoinerMetrics:
    """Return the singleton metric set (constructed on first call).

    Idempotent. After the first call, returns the cached frozen dataclass.
    Tests can reset the singleton via :func:`_reset_metrics_for_tests`.
    """
    global _metrics_singleton
    if _metrics_singleton is None:
        meter = metrics.get_meter(METER_NAME) if _OTEL_AVAILABLE else _NoopMeter()
        _metrics_singleton = _build_metrics(meter)
    return _metrics_singleton


def _reset_metrics_for_tests() -> None:
    """Internal: clear the singleton (test fixtures only)."""
    global _metrics_singleton
    _metrics_singleton = None
