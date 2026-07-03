"""Regression for #82: MemoryMonitor must actually be started/stopped by the
sidecar's lifespan, not just constructed as dead code.

memory_monitor.py's own docstring says "the sidecar's lifespan creates a
MemoryMonitor and calls start once the bot PID is known" — these tests prove
main.lifespan() really does call .start()/.stop() on the module-level
singleton, alongside the existing health-poller task lifecycle.
"""

from __future__ import annotations

import asyncio

import pytest

from src.sidecar import main as sidecar_main


@pytest.mark.asyncio
@pytest.mark.unit
async def test_lifespan_starts_and_stops_memory_monitor(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str] = []

    monkeypatch.setattr(sidecar_main, "configure_logging", lambda _level: None)
    monkeypatch.setattr(sidecar_main, "configure_otel", lambda **_kwargs: None)
    monkeypatch.setattr(sidecar_main, "validate_secrets", lambda: None)

    async def wait_forever() -> None:
        await asyncio.Event().wait()

    monkeypatch.setattr(sidecar_main, "_health_poller_loop", wait_forever)
    monkeypatch.setattr(sidecar_main.bot_supervisor, "is_alive", lambda: False)

    async def fake_start() -> None:
        calls.append("start")

    async def fake_stop() -> None:
        calls.append("stop")

    monkeypatch.setattr(sidecar_main.memory_monitor, "start", fake_start)
    monkeypatch.setattr(sidecar_main.memory_monitor, "stop", fake_stop)

    async with sidecar_main.lifespan(sidecar_main.app):
        assert calls == ["start"]

    assert calls == ["start", "stop"]


@pytest.mark.asyncio
@pytest.mark.unit
async def test_memory_monitor_is_constructed_with_the_shared_bot_supervisor() -> None:
    assert sidecar_main.memory_monitor._supervisor is sidecar_main.bot_supervisor
