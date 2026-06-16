"""OpenTelemetry SDK initialization for the meeting-joiner.

Configures tracer + meter providers with OTLP exporters pointed at the
in-cluster OTel collector. Auto-instruments FastAPI, asyncpg, and httpx so
incoming requests + outgoing DB / HTTP calls automatically produce spans.

Endpoint resolution order:
1. ``OTEL_EXPORTER_OTLP_ENDPOINT`` env var (set in K8s Deployment).
2. Default: ``http://otel-collector.monitoring.svc.cluster.local:4317`` (gRPC).

Feature flag ``OTEL_ENABLED=false`` short-circuits the entire setup so the
service can run without a collector (local dev, emergency disable).
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Optional

try:
    from opentelemetry import metrics, trace
    from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
    from opentelemetry.instrumentation.asyncpg import AsyncPGInstrumentor
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
    from opentelemetry.instrumentation.logging import LoggingInstrumentor
    from opentelemetry.sdk.metrics import MeterProvider
    from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor

    _OTEL_AVAILABLE = True
except ModuleNotFoundError:
    # OpenTelemetry is opt-in (see OTEL_ENABLED). When the SDK isn't installed,
    # configure_otel() becomes a no-op so the service boots without it.
    _OTEL_AVAILABLE = False

_logger = logging.getLogger(__name__)

DEFAULT_OTLP_ENDPOINT = "http://otel-collector.monitoring.svc.cluster.local:4317"


@dataclass(frozen=True)
class OtelConfig:
    """Frozen OTel configuration captured at startup."""

    enabled: bool
    endpoint: str
    service_name: str
    service_version: str
    deployment_environment: str

    @classmethod
    def from_env(cls, default_service_name: str) -> "OtelConfig":
        enabled = os.environ.get("OTEL_ENABLED", "true").strip().lower() != "false"
        endpoint = os.environ.get(
            "OTEL_EXPORTER_OTLP_ENDPOINT", DEFAULT_OTLP_ENDPOINT
        ).strip()
        service_name = os.environ.get("OTEL_SERVICE_NAME", default_service_name).strip()
        service_version = os.environ.get("SERVICE_VERSION", "1.0.0").strip()
        deployment_environment = os.environ.get(
            "DEPLOYMENT_ENV", os.environ.get("ENVIRONMENT", "unknown")
        ).strip()
        return cls(
            enabled=enabled,
            endpoint=endpoint,
            service_name=service_name,
            service_version=service_version,
            deployment_environment=deployment_environment,
        )


_tracer_provider: Optional[TracerProvider] = None
_meter_provider: Optional[MeterProvider] = None


def configure_otel(
    service_name: str = "meeting-joiner-api",
    *,
    app: object | None = None,
) -> OtelConfig:
    """Initialize OTel tracer + meter providers.

    Idempotent — repeated calls are no-ops after the first successful init.

    Args:
        service_name: Logical service name surfaced as ``service.name`` resource
            attribute. Override per-process for the API vs sidecar vs canary.
        app: Optional FastAPI app instance. When supplied, FastAPIInstrumentor
            is wired up so HTTP routes produce spans without manual decoration.
    """
    global _tracer_provider, _meter_provider

    config = OtelConfig.from_env(default_service_name=service_name)
    if not _OTEL_AVAILABLE:
        _logger.info(
            "OpenTelemetry SDK not installed; observability disabled "
            "(install opentelemetry-* or set OTEL_ENABLED=false to silence)."
        )
        return config
    if not config.enabled:
        return config

    if _tracer_provider is not None and _meter_provider is not None:
        # Already initialized; only attach the FastAPI instrumentation if a new
        # app was supplied (e.g. lifespan called after configure_otel).
        if app is not None:
            FastAPIInstrumentor.instrument_app(app)
        return config

    resource = Resource.create(
        {
            "service.name": config.service_name,
            "service.version": config.service_version,
            "deployment.environment": config.deployment_environment,
        }
    )

    _tracer_provider = TracerProvider(resource=resource)
    _tracer_provider.add_span_processor(
        BatchSpanProcessor(OTLPSpanExporter(endpoint=config.endpoint, insecure=True))
    )
    trace.set_tracer_provider(_tracer_provider)

    metric_reader = PeriodicExportingMetricReader(
        OTLPMetricExporter(endpoint=config.endpoint, insecure=True),
        export_interval_millis=30_000,
    )
    _meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
    metrics.set_meter_provider(_meter_provider)

    if app is not None:
        FastAPIInstrumentor.instrument_app(app)
    AsyncPGInstrumentor().instrument()
    HTTPXClientInstrumentor().instrument()
    LoggingInstrumentor().instrument(set_logging_format=False)

    return config


def shutdown_otel() -> None:
    """Flush exporters cleanly at process shutdown."""
    global _tracer_provider, _meter_provider
    if _tracer_provider is not None:
        _tracer_provider.shutdown()
        _tracer_provider = None
    if _meter_provider is not None:
        _meter_provider.shutdown()
        _meter_provider = None
