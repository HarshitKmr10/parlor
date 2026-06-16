"""Unit tests for OTel initialization.

These tests exercise the configure path without binding to a real OTLP
collector — we verify configuration parsing, idempotency, and the feature
flag rather than network behaviour.
"""

from __future__ import annotations

import pytest

from src.observability.otel_setup import OtelConfig, configure_otel, shutdown_otel


@pytest.fixture(autouse=True)
def _reset_otel_state():
    yield
    shutdown_otel()


@pytest.mark.unit
def test_config_from_env_uses_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    for var in (
        "OTEL_ENABLED",
        "OTEL_EXPORTER_OTLP_ENDPOINT",
        "OTEL_SERVICE_NAME",
        "SERVICE_VERSION",
        "DEPLOYMENT_ENV",
        "ENVIRONMENT",
    ):
        monkeypatch.delenv(var, raising=False)

    config = OtelConfig.from_env(default_service_name="meeting-joiner-test")

    assert config.enabled is True
    assert config.service_name == "meeting-joiner-test"
    assert config.endpoint.endswith(":4317")
    assert config.deployment_environment == "unknown"


@pytest.mark.unit
def test_config_from_env_respects_overrides(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OTEL_ENABLED", "true")
    monkeypatch.setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://collector:4317")
    monkeypatch.setenv("OTEL_SERVICE_NAME", "explicit-name")
    monkeypatch.setenv("SERVICE_VERSION", "2.0.0")
    monkeypatch.setenv("DEPLOYMENT_ENV", "staging")

    config = OtelConfig.from_env(default_service_name="fallback")

    assert config.service_name == "explicit-name"
    assert config.endpoint == "http://collector:4317"
    assert config.service_version == "2.0.0"
    assert config.deployment_environment == "staging"


@pytest.mark.unit
def test_feature_flag_disables_setup(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OTEL_ENABLED", "false")

    config = configure_otel(service_name="meeting-joiner-test")

    # When disabled, the function returns immediately without registering
    # providers, and the dataclass reflects the disabled state.
    assert config.enabled is False


@pytest.mark.unit
def test_configure_is_idempotent(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OTEL_ENABLED", "true")
    monkeypatch.setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4317")

    first = configure_otel(service_name="meeting-joiner-test")
    second = configure_otel(service_name="meeting-joiner-test")

    # Both invocations should return enabled configs without raising. The
    # second call is a no-op (already initialized).
    assert first.enabled is True
    assert second.enabled is True
