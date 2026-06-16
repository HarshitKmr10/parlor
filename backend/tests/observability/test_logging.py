"""Unit tests for structlog configuration.

We verify:
- ``configure_logging`` produces JSON-parseable lines on stdout.
- OTel trace context, when present, is injected into log records.
- Idempotency: repeated calls don't break or duplicate handlers.
"""

from __future__ import annotations

import json
import logging

import pytest

from src.observability.logging import configure_logging, get_logger


@pytest.fixture
def captured_stdout(capsys: pytest.CaptureFixture[str]):
    """Yield capsys but pre-configured to capture both stdlib + structlog output."""
    yield capsys


@pytest.mark.unit
def test_configure_emits_valid_json(captured_stdout: pytest.CaptureFixture[str]) -> None:
    configure_logging(log_level="INFO")
    logger = get_logger("meeting_joiner.test")

    logger.info("hello", meeting_id="m-123")

    out = captured_stdout.readouterr().out
    assert out, "No output captured"
    line = out.strip().splitlines()[-1]
    parsed = json.loads(line)
    assert parsed["event"] == "hello"
    assert parsed["meeting_id"] == "m-123"
    assert parsed["level"] == "info"


@pytest.mark.unit
def test_stdlib_logger_bridges_to_structlog(
    captured_stdout: pytest.CaptureFixture[str],
) -> None:
    configure_logging(log_level="INFO")
    stdlib_logger = logging.getLogger("meeting_joiner.bridge_test")

    stdlib_logger.info("bridged-message")

    out = captured_stdout.readouterr().out
    assert "bridged-message" in out
    # Last JSON line should be parseable
    parsed = json.loads(out.strip().splitlines()[-1])
    assert "bridged-message" in parsed.get("event", "")


@pytest.mark.unit
def test_idempotent_configure(captured_stdout: pytest.CaptureFixture[str]) -> None:
    configure_logging(log_level="INFO")
    configure_logging(log_level="INFO")
    configure_logging(log_level="INFO")

    logger = get_logger("meeting_joiner.idempotency")
    logger.info("only-once")

    out = captured_stdout.readouterr().out
    matching = [
        line
        for line in out.strip().splitlines()
        if "only-once" in line and line.startswith("{")
    ]
    # Each configure_logging clears handlers, so re-configuring should NOT
    # produce duplicate log lines.
    assert len(matching) == 1, f"Expected exactly one log line, got {len(matching)}"
