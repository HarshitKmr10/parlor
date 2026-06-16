"""Structured JSON logging for the meeting-joiner.

structlog is wired with a processor pipeline that:
1. Injects standard fields (timestamp, level, logger name).
2. Pulls the current OTel trace_id / span_id into every log record so logs
   correlate with traces in Tempo / Uptrace via Grafana.
3. Renders as JSON to stdout (Promtail at `infra/monitoring/promtail.yml`
   picks it up and ships to Loki).

The structlog logger is the canonical interface for new code. The stdlib
``logging`` module is bridged to the same pipeline so legacy ``logger.info``
calls scattered through the codebase produce the same JSON output without
needing edits.
"""

from __future__ import annotations

import logging
import os
import sys
from typing import Any, MutableMapping

import structlog

try:
    from opentelemetry import trace
except ModuleNotFoundError:
    # OpenTelemetry is opt-in (see OTEL_ENABLED). When the package isn't
    # installed, logging must still work — degrade to no trace correlation
    # rather than crashing every module that imports this one.
    trace = None  # type: ignore[assignment]


class _StdoutProxy:
    """File-like proxy that follows the current ``sys.stdout``.

    Pytest replaces and later closes captured stdout objects. Holding one of
    those objects inside structlog/logging handlers makes later tests fail with
    "I/O operation on closed file". Resolving stdout at write time keeps normal
    container logging behavior while making repeated reconfiguration safe.
    """

    def write(self, message: str) -> int:
        return sys.stdout.write(message)

    def flush(self) -> None:
        sys.stdout.flush()


def _inject_trace_context(
    _logger: object, _method_name: str, event_dict: MutableMapping[str, Any]
) -> MutableMapping[str, Any]:
    """structlog processor: add trace_id + span_id from the current OTel span.

    No-op when no active span (so the field is absent rather than ``"None"``),
    and no-op entirely when OpenTelemetry isn't installed.
    """
    if trace is None:
        return event_dict
    span = trace.get_current_span()
    ctx = span.get_span_context() if span else None
    if ctx is not None and ctx.is_valid:
        event_dict["trace_id"] = format(ctx.trace_id, "032x")
        event_dict["span_id"] = format(ctx.span_id, "016x")
    return event_dict


def _add_service_fields(
    _logger: object, _method_name: str, event_dict: MutableMapping[str, Any]
) -> MutableMapping[str, Any]:
    """structlog processor: add service identification fields."""
    event_dict.setdefault("service", os.environ.get("SERVICE_NAME", "meeting-joiner"))
    pod_name = os.environ.get("POD_NAME")
    if pod_name:
        event_dict["pod_name"] = pod_name
    return event_dict


def configure_logging(log_level: str = "INFO") -> None:
    """Configure structlog + bridge stdlib logging.

    Idempotent — safe to call multiple times. The stdlib root logger is
    replaced with one that delegates to structlog so any module using
    ``logging.getLogger(__name__)`` still produces JSON output.
    """
    level = getattr(logging, log_level.upper(), logging.INFO)

    shared_processors = [
        structlog.contextvars.merge_contextvars,
        _add_service_fields,
        _inject_trace_context,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
    ]

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(file=_StdoutProxy()),
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        processor=structlog.processors.JSONRenderer(),
        foreign_pre_chain=shared_processors,
    )
    handler = logging.StreamHandler(stream=_StdoutProxy())
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(level)

    # Quiet down libraries that are noisy at INFO.
    for noisy in ("uvicorn.access", "asyncio", "azure"):
        logging.getLogger(noisy).setLevel(max(level, logging.WARNING))


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """Return a bound structlog logger.

    Prefer this over ``logging.getLogger`` in new code.
    """
    return structlog.get_logger(name)
