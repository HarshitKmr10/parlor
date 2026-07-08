"""Unit tests for app.config: AI_PROVIDER_MODE / AI_PINNED_PROVIDER validation.

``load_settings()`` re-reads the environment fresh on each call (unlike the
module-level ``settings`` singleton), so these tests monkeypatch env vars and
call it directly rather than relying on process-wide state.
"""

from __future__ import annotations

import pytest

from app.config import ConfigError, load_settings


class TestProviderModeValidation:
    def test_defaults_to_fallback_mode_when_unset(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.delenv("AI_PROVIDER_MODE", raising=False)
        monkeypatch.delenv("AI_PINNED_PROVIDER", raising=False)

        settings = load_settings()

        assert settings.provider_mode == "fallback"
        assert settings.pinned_provider is None

    def test_rejects_invalid_provider_mode(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setenv("AI_PROVIDER_MODE", "bogus")

        with pytest.raises(ConfigError, match="AI_PROVIDER_MODE"):
            load_settings()

    def test_pinned_mode_requires_pinned_provider(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setenv("AI_PROVIDER_MODE", "pinned")
        monkeypatch.delenv("AI_PINNED_PROVIDER", raising=False)

        with pytest.raises(ConfigError, match="AI_PINNED_PROVIDER"):
            load_settings()

    def test_pinned_mode_with_pinned_provider_set_loads_successfully(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        monkeypatch.setenv("AI_PROVIDER_MODE", "pinned")
        monkeypatch.setenv("AI_PINNED_PROVIDER", "anthropic")

        settings = load_settings()

        assert settings.provider_mode == "pinned"
        assert settings.pinned_provider == "anthropic"

    def test_provider_mode_is_case_insensitive(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setenv("AI_PROVIDER_MODE", "PINNED")
        monkeypatch.setenv("AI_PINNED_PROVIDER", "openai")

        settings = load_settings()

        assert settings.provider_mode == "pinned"
