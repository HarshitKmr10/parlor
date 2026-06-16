from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from fastapi import HTTPException
import pytest

from shared.secret_validator import MissingSecretError
from src.sidecar import main as sidecar_main
from src.sidecar.models import ConfigureRequest
from src.sidecar.state import MeetingState, SidecarStateSnapshot


@pytest.mark.asyncio
@pytest.mark.unit
async def test_sidecar_lifespan_validates_secrets_before_serving(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str] = []

    monkeypatch.setattr(sidecar_main, "configure_logging", lambda _level: None)
    monkeypatch.setattr(sidecar_main, "configure_otel", lambda **_kwargs: None)
    monkeypatch.setattr(
        sidecar_main, "validate_secrets", lambda: calls.append("validate")
    )

    async def wait_forever() -> None:
        await asyncio.Event().wait()

    monkeypatch.setattr(sidecar_main, "_health_poller_loop", wait_forever)
    monkeypatch.setattr(sidecar_main.bot_supervisor, "is_alive", lambda: False)

    async with sidecar_main.lifespan(sidecar_main.app):
        assert calls == ["validate"]


@pytest.mark.asyncio
@pytest.mark.unit
async def test_sidecar_lifespan_defers_startup_secret_validation_failures(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(sidecar_main, "configure_logging", lambda _level: None)
    monkeypatch.setattr(sidecar_main, "configure_otel", lambda **_kwargs: None)

    def fail_validation() -> None:
        raise MissingSecretError(["OPENAI_API_KEY (OpenAI Whisper API key)"])

    monkeypatch.setattr(sidecar_main, "validate_secrets", fail_validation)

    async def wait_forever() -> None:
        await asyncio.Event().wait()

    monkeypatch.setattr(sidecar_main, "_health_poller_loop", wait_forever)
    monkeypatch.setattr(sidecar_main.bot_supervisor, "is_alive", lambda: False)

    async with sidecar_main.lifespan(sidecar_main.app):
        pass


@pytest.mark.asyncio
@pytest.mark.unit
async def test_configure_validates_request_specific_secret_requirements(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    spawn_called = False
    captured_config = None

    class FakeStateManager:
        async def snapshot(self) -> SidecarStateSnapshot:
            return SidecarStateSnapshot(
                meeting_state=MeetingState.WARM,
                current_meeting_id=None,
                current_session_number=None,
                bot_pid=None,
                bot_returncode=None,
                exit_reason=None,
                started_at=datetime.now(timezone.utc),
                config=None,
            )

        async def mark_configuring(self, _request, _pid) -> None:  # noqa: ANN001
            raise AssertionError("mark_configuring should not be called")

    def fail_validation(config) -> None:  # noqa: ANN001
        nonlocal captured_config
        captured_config = config
        raise MissingSecretError(["OPENAI_API_KEY (OpenAI Whisper API key)"])

    async def spawn(_request) -> int:  # noqa: ANN001
        nonlocal spawn_called
        spawn_called = True
        return 123

    monkeypatch.setattr(sidecar_main, "state_manager", FakeStateManager())
    monkeypatch.setattr(sidecar_main, "validate_secrets", fail_validation)
    monkeypatch.setattr(sidecar_main.bot_supervisor, "spawn", spawn)

    request = ConfigureRequest(
        meeting_id="meeting-1",
        meeting_url="https://teams.microsoft.com/l/meetup-join/test",
        org_id="org-1",
        platform="msteams",
        bot_name="Meeting Bot",
        transcript_source="audio_asr",
    )

    with pytest.raises(HTTPException) as excinfo:
        await sidecar_main.configure(request)

    assert excinfo.value.status_code == 503
    assert captured_config is not None
    assert captured_config.enabled_platforms == ("msteams_playwright",)
    assert captured_config.msteams_transcript_source == "audio_asr"
    assert spawn_called is False


@pytest.mark.asyncio
@pytest.mark.unit
async def test_configure_reports_secret_validation_value_error_as_503(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    spawn_called = False

    class FakeStateManager:
        async def snapshot(self) -> SidecarStateSnapshot:
            return SidecarStateSnapshot(
                meeting_state=MeetingState.WARM,
                current_meeting_id=None,
                current_session_number=None,
                bot_pid=None,
                bot_returncode=None,
                exit_reason=None,
                started_at=datetime.now(timezone.utc),
                config=None,
            )

        async def mark_configuring(self, _request, _pid) -> None:  # noqa: ANN001
            raise AssertionError("mark_configuring should not be called")

    def fail_validation(_config) -> None:  # noqa: ANN001
        raise ValueError("Unknown STT provider 'bedrock_nova'")

    async def spawn(_request) -> int:  # noqa: ANN001
        nonlocal spawn_called
        spawn_called = True
        return 123

    monkeypatch.setattr(sidecar_main, "state_manager", FakeStateManager())
    monkeypatch.setattr(sidecar_main, "validate_secrets", fail_validation)
    monkeypatch.setattr(sidecar_main.bot_supervisor, "spawn", spawn)

    request = ConfigureRequest(
        meeting_id="meeting-1",
        meeting_url="https://teams.microsoft.com/l/meetup-join/test",
        org_id="org-1",
        platform="msteams",
        bot_name="Meeting Bot",
        transcript_source="audio_asr",
    )

    with pytest.raises(HTTPException) as excinfo:
        await sidecar_main.configure(request)

    assert excinfo.value.status_code == 503
    assert "bedrock_nova" in excinfo.value.detail
    assert spawn_called is False
