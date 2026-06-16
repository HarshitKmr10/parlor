"""Observability for the meeting-joiner service.

OpenTelemetry traces + metrics, structlog JSON logging, secret validation.
Wired into the API in `src/main.py` and into the sidecar in `src/sidecar/main.py`.
"""

from .logging import configure_logging, get_logger
from .metrics import MeetingJoinerMetrics, get_metrics
from .otel_setup import configure_otel, shutdown_otel

__all__ = [
    "MeetingJoinerMetrics",
    "configure_logging",
    "configure_otel",
    "get_logger",
    "get_metrics",
    "shutdown_otel",
]
