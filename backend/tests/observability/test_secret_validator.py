"""Unit tests for startup secret validation.

The validator should:
- Pass when all required secrets are present and well-formed.
- Fail loudly listing every missing secret in a single error.
- Reject placeholder defaults like "changeme", "todo", empty strings.
- Respect platform configuration (Zoom-only deployments don't need MS creds).
"""

from __future__ import annotations

import pytest

from shared.secret_validator import (
    MissingSecretError,
    ValidationConfig,
    config_for_configure_request,
    required_secret_names,
    validate_secrets,
)


_VALID_PG_URL = "postgresql://user:pass@host/db"
_VALID_AZURE_STORAGE = (
    "DefaultEndpointsProtocol=https;AccountName=x;AccountKey=y;"
    "EndpointSuffix=core.windows.net"
)


def _set_zoom_base_secrets(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", _VALID_AZURE_STORAGE)
    monkeypatch.setenv("ZOOM_CLIENT_ID", "zoom-id")
    monkeypatch.setenv("ZOOM_CLIENT_SECRET", "zoom-secret-long-enough")


@pytest.fixture(autouse=True)
def _clear_secret_env(monkeypatch: pytest.MonkeyPatch):
    for var in (
        "DATABASE_URL",
        "MICROSOFT_APP_ID",
        "MICROSOFT_APP_PASSWORD",
        "MICROSOFT_APP_TENANT_ID",
        "ZOOM_APP_CLIENT_ID",
        "ZOOM_APP_CLIENT_SECRET",
        "ZOOM_CLIENT_ID",
        "ZOOM_CLIENT_SECRET",
        "OPENAI_API_KEY",
        "AZURE_SPEECH_KEY",
        "AZURE_SPEECH_REGION",
        "AZURE_SPEECH_ENDPOINT",
        "AZURE_SPEECH_CONTAINER_ENDPOINT",
        "AZURE_SPEECH_AUTH",
        "AWS_ACCESS_KEY_ID",
        "AWS_SECRET_ACCESS_KEY",
        "AWS_SESSION_TOKEN",
        "AWS_ACCOUNT_ID",
        "S3_BUCKET_NAME",
        "HEALTHSCRIBE_DATA_ACCESS_ROLE_ARN",
        "AZURE_STORAGE_CONNECTION_STRING",
        "AZURE_STORAGE_AUTH",
        "AZURE_STORAGE_ACCOUNT_NAME",
        "AZURE_STORAGE_BLOB_ENDPOINT",
        "LLM_PROVIDER",
        "ASR_PROVIDER",
        "MSTEAMS_ASR_PROVIDER",
        "MSTEAMS_TRANSCRIPT_SOURCE",
        "MSTEAMS_ATTRIBUTION_MODE",
        "GOOGLEMEET_TRANSCRIPT_SOURCE",
        "GOOGLEMEET_CAPTURE_MODE",
        "MEETING_JOINER_ENABLED_PLATFORMS",
        "MEETING_JOINER_STT_PROVIDERS",
        "MEETING_JOINER_STORAGE_REQUIRED",
        "JWT_SECRET",
        "RUNTIME_MODE",
    ):
        monkeypatch.delenv(var, raising=False)
    yield


@pytest.mark.unit
def test_default_config_passes_with_complete_secrets(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-1234567890")
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", _VALID_AZURE_STORAGE)

    # No exception
    validate_secrets()


@pytest.mark.unit
def test_missing_database_url_raises_with_name() -> None:
    with pytest.raises(MissingSecretError) as excinfo:
        validate_secrets()

    assert any("DATABASE_URL" in entry for entry in excinfo.value.missing)


@pytest.mark.unit
def test_placeholder_default_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("OPENAI_API_KEY", "changeme")  # sentinel default
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", _VALID_AZURE_STORAGE)

    with pytest.raises(MissingSecretError) as excinfo:
        validate_secrets()

    assert any("OPENAI_API_KEY" in entry for entry in excinfo.value.missing)


@pytest.mark.unit
def test_zoom_only_config_does_not_require_microsoft(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_zoom_base_secrets(monkeypatch)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-1234567890")

    config = ValidationConfig(
        enabled_platforms=("zoom",),
        stt_providers=("openai",),
        storage_required=True,
    )
    validate_secrets(config)  # no exception

    names = list(required_secret_names(config))
    assert "MICROSOFT_APP_PASSWORD" not in names


@pytest.mark.unit
def test_zoom_accepts_legacy_app_credential_aliases(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", _VALID_AZURE_STORAGE)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-1234567890")
    monkeypatch.setenv("ZOOM_APP_CLIENT_ID", "zoom-app-id")
    monkeypatch.setenv("ZOOM_APP_CLIENT_SECRET", "zoom-app-secret-long-enough")

    config = ValidationConfig(
        enabled_platforms=("zoom",),
        stt_providers=("openai",),
        storage_required=True,
    )

    validate_secrets(config)

    names = list(required_secret_names(config))
    assert "ZOOM_APP_CLIENT_ID" in names
    assert "ZOOM_APP_CLIENT_SECRET" in names
    assert "ZOOM_CLIENT_ID" in names
    assert "ZOOM_CLIENT_SECRET" in names


@pytest.mark.unit
def test_zoom_rejects_invalid_preferred_app_alias(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_zoom_base_secrets(monkeypatch)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-1234567890")
    monkeypatch.setenv("ZOOM_APP_CLIENT_SECRET", "changeme")

    config = ValidationConfig(
        enabled_platforms=("zoom",),
        stt_providers=("openai",),
        storage_required=True,
    )

    with pytest.raises(MissingSecretError) as excinfo:
        validate_secrets(config)

    missing_names = " ".join(excinfo.value.missing)
    assert "ZOOM_APP_CLIENT_SECRET" in missing_names
    assert "ZOOM_CLIENT_SECRET" in missing_names


@pytest.mark.unit
def test_zoom_uses_python_fallback_to_openai_for_unsupported_provider(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_zoom_base_secrets(monkeypatch)
    monkeypatch.setenv("AZURE_SPEECH_KEY", "real-key")
    monkeypatch.setenv("AZURE_SPEECH_REGION", "eastus")

    config = ValidationConfig(
        enabled_platforms=("zoom",),
        storage_required=True,
        selected_stt_provider="azure_speech",
    )

    with pytest.raises(MissingSecretError) as excinfo:
        validate_secrets(config)

    missing_names = " ".join(excinfo.value.missing)
    assert "OPENAI_API_KEY" in missing_names
    assert "AZURE_SPEECH_KEY" not in missing_names
    assert "AZURE_SPEECH_REGION" not in missing_names


@pytest.mark.unit
def test_zoom_uses_python_case_insensitive_azure_openai_provider(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_zoom_base_secrets(monkeypatch)
    monkeypatch.setenv("AZURE_OPENAI_API_KEY", "azure-openai-key")
    monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://azure-openai.example.com")

    config = ValidationConfig(
        enabled_platforms=("zoom",),
        storage_required=True,
        selected_stt_provider="AZURE_OPENAI",
    )

    validate_secrets(config)

    names = list(required_secret_names(config))
    assert "AZURE_OPENAI_API_KEY" in names
    assert "AZURE_OPENAI_ENDPOINT" in names
    assert "OPENAI_API_KEY" not in names


@pytest.mark.unit
def test_zoom_supports_python_bedrock_nova_provider_default_credential_chain(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_zoom_base_secrets(monkeypatch)

    config = ValidationConfig(
        enabled_platforms=("zoom",),
        storage_required=True,
        selected_stt_provider="bedrock_nova",
    )

    validate_secrets(config)

    names = list(required_secret_names(config))
    assert "OPENAI_API_KEY" not in names
    assert "AWS_ACCESS_KEY_ID" not in names
    assert "AWS_SECRET_ACCESS_KEY" not in names


@pytest.mark.unit
def test_zoom_healthscribe_uses_python_default_credential_chain(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_zoom_base_secrets(monkeypatch)
    monkeypatch.setenv("S3_BUCKET_NAME", "healthscribe-input")
    monkeypatch.setenv("AWS_ACCOUNT_ID", "123456789012")

    config = ValidationConfig(
        enabled_platforms=("zoom",),
        storage_required=True,
        selected_stt_provider="healthscribe",
    )

    validate_secrets(config)

    names = list(required_secret_names(config))
    assert "S3_BUCKET_NAME" in names
    assert "AWS_ACCOUNT_ID" in names
    assert "AWS_ACCESS_KEY_ID" not in names
    assert "AWS_SECRET_ACCESS_KEY" not in names


@pytest.mark.unit
def test_url_prefix_validation(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "mysql://wrong-protocol/db")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-1234567890")
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", _VALID_AZURE_STORAGE)

    with pytest.raises(MissingSecretError) as excinfo:
        validate_secrets()

    assert any("DATABASE_URL" in entry for entry in excinfo.value.missing)


@pytest.mark.unit
def test_stt_provider_list_does_not_override_runtime_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Without LLM_PROVIDER, runtime still selects OpenAI."""
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", _VALID_AZURE_STORAGE)
    monkeypatch.setenv("MEETING_JOINER_STT_PROVIDERS", "azure_speech")
    monkeypatch.setenv("AZURE_SPEECH_KEY", "real-key")
    monkeypatch.setenv("AZURE_SPEECH_REGION", "eastus")

    with pytest.raises(MissingSecretError) as excinfo:
        validate_secrets()

    missing_names = " ".join(excinfo.value.missing)
    assert "OPENAI_API_KEY" in missing_names
    assert "AZURE_SPEECH_KEY" not in missing_names
    assert "AZURE_SPEECH_REGION" not in missing_names


@pytest.mark.unit
def test_azure_speech_managed_identity_accepts_endpoint_without_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", _VALID_AZURE_STORAGE)
    monkeypatch.setenv("AZURE_SPEECH_AUTH", "managed_identity")
    monkeypatch.setenv("AZURE_SPEECH_ENDPOINT", "https://speech.example.com")

    config = ValidationConfig(
        enabled_platforms=("msteams_playwright",),
        stt_providers=("azure_speech",),
        storage_required=True,
        selected_stt_provider="azure_speech",
    )

    validate_secrets(config)

    names = list(required_secret_names(config))
    assert "AZURE_SPEECH_ENDPOINT" in names
    assert "AZURE_SPEECH_KEY" not in names
    assert "AZURE_SPEECH_REGION" not in names


@pytest.mark.unit
def test_azure_speech_managed_identity_requires_endpoint_not_key_or_region(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", _VALID_AZURE_STORAGE)
    monkeypatch.setenv("AZURE_SPEECH_AUTH", "managed_identity")

    config = ValidationConfig(
        enabled_platforms=("msteams_playwright",),
        stt_providers=("azure_speech",),
        storage_required=True,
        selected_stt_provider="azure_speech",
    )

    with pytest.raises(MissingSecretError) as excinfo:
        validate_secrets(config)

    missing_names = " ".join(excinfo.value.missing)
    assert "AZURE_SPEECH_ENDPOINT" in missing_names
    assert "AZURE_SPEECH_KEY" not in missing_names
    assert "AZURE_SPEECH_REGION" not in missing_names


@pytest.mark.unit
def test_azure_speech_container_endpoint_satisfies_provider(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", _VALID_AZURE_STORAGE)
    monkeypatch.setenv(
        "AZURE_SPEECH_CONTAINER_ENDPOINT", "http://speech-container:5000"
    )

    config = ValidationConfig(
        enabled_platforms=("msteams_playwright",),
        stt_providers=("azure_speech",),
        storage_required=True,
        selected_stt_provider="azure_speech",
    )

    validate_secrets(config)

    names = list(required_secret_names(config))
    assert "AZURE_SPEECH_CONTAINER_ENDPOINT" in names
    assert "AZURE_SPEECH_ENDPOINT" not in names
    assert "AZURE_SPEECH_KEY" not in names
    assert "AZURE_SPEECH_REGION" not in names


@pytest.mark.unit
def test_azure_speech_container_endpoint_rejects_managed_identity_auth(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", _VALID_AZURE_STORAGE)
    monkeypatch.setenv("AZURE_SPEECH_AUTH", "managed_identity")
    monkeypatch.setenv(
        "AZURE_SPEECH_CONTAINER_ENDPOINT", "http://speech-container:5000"
    )

    config = ValidationConfig(
        enabled_platforms=("msteams_playwright",),
        stt_providers=("azure_speech",),
        storage_required=True,
        selected_stt_provider="azure_speech",
    )

    with pytest.raises(ValueError, match="AZURE_SPEECH_CONTAINER_ENDPOINT"):
        validate_secrets(config)


@pytest.mark.unit
def test_azure_speech_auto_rejects_placeholder_key_even_with_endpoint(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", _VALID_AZURE_STORAGE)
    monkeypatch.setenv("AZURE_SPEECH_ENDPOINT", "https://speech.example.com")
    monkeypatch.setenv("AZURE_SPEECH_KEY", "changeme")

    config = ValidationConfig(
        enabled_platforms=("msteams_playwright",),
        stt_providers=("azure_speech",),
        storage_required=True,
        selected_stt_provider="azure_speech",
    )

    with pytest.raises(MissingSecretError) as excinfo:
        validate_secrets(config)

    missing_names = " ".join(excinfo.value.missing)
    assert "AZURE_SPEECH_KEY" in missing_names
    assert "AZURE_SPEECH_ENDPOINT" not in missing_names


@pytest.mark.unit
def test_azure_speech_auto_rejects_whitespace_key_even_with_endpoint(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", _VALID_AZURE_STORAGE)
    monkeypatch.setenv("AZURE_SPEECH_ENDPOINT", "https://speech.example.com")
    monkeypatch.setenv("AZURE_SPEECH_KEY", " ")

    config = ValidationConfig(
        enabled_platforms=("msteams_playwright",),
        stt_providers=("azure_speech",),
        storage_required=True,
        selected_stt_provider="azure_speech",
    )

    with pytest.raises(MissingSecretError) as excinfo:
        validate_secrets(config)

    missing_names = " ".join(excinfo.value.missing)
    assert "AZURE_SPEECH_KEY" in missing_names
    assert "AZURE_SPEECH_ENDPOINT" not in missing_names


@pytest.mark.unit
def test_azure_speech_auto_rejects_invalid_endpoint_even_with_key_region(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", _VALID_AZURE_STORAGE)
    monkeypatch.setenv("AZURE_SPEECH_ENDPOINT", "not a url")
    monkeypatch.setenv("AZURE_SPEECH_KEY", "real-key")
    monkeypatch.setenv("AZURE_SPEECH_REGION", "eastus")

    config = ValidationConfig(
        enabled_platforms=("msteams_playwright",),
        stt_providers=("azure_speech",),
        storage_required=True,
        selected_stt_provider="azure_speech",
    )

    with pytest.raises(MissingSecretError) as excinfo:
        validate_secrets(config)

    missing_names = " ".join(excinfo.value.missing)
    assert "AZURE_SPEECH_ENDPOINT" in missing_names
    assert "AZURE_SPEECH_KEY" not in missing_names
    assert "AZURE_SPEECH_REGION" not in missing_names


@pytest.mark.unit
def test_selected_llm_provider_does_not_fall_back_to_valid_openai(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", _VALID_AZURE_STORAGE)
    monkeypatch.setenv("LLM_PROVIDER", "azure_speech")
    monkeypatch.setenv("MEETING_JOINER_STT_PROVIDERS", "azure_speech,openai")
    monkeypatch.setenv("AZURE_SPEECH_ENDPOINT", "not a url")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-1234567890")

    with pytest.raises(MissingSecretError) as excinfo:
        validate_secrets()

    missing_names = " ".join(excinfo.value.missing)
    assert "AZURE_SPEECH_ENDPOINT" in missing_names
    assert "OPENAI_API_KEY" not in missing_names


@pytest.mark.unit
def test_selected_llm_provider_must_match_runtime_case_sensitively(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", _VALID_AZURE_STORAGE)
    monkeypatch.setenv("LLM_PROVIDER", "AZURE_SPEECH")
    monkeypatch.setenv("AZURE_SPEECH_ENDPOINT", "https://speech.example.com")

    with pytest.raises(ValueError, match="AZURE_SPEECH"):
        validate_secrets()


@pytest.mark.unit
def test_selected_azure_openai_provider_is_supported(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", _VALID_AZURE_STORAGE)
    monkeypatch.setenv("LLM_PROVIDER", "azure_openai")
    monkeypatch.setenv("AZURE_OPENAI_API_KEY", "azure-openai-key")
    monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://azure-openai.example.com")

    validate_secrets()

    names = list(required_secret_names())
    assert "AZURE_OPENAI_API_KEY" in names
    assert "AZURE_OPENAI_ENDPOINT" in names
    assert "OPENAI_API_KEY" not in names


@pytest.mark.unit
def test_teams_captions_skips_stt_provider_secrets(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", _VALID_AZURE_STORAGE)
    monkeypatch.setenv("MSTEAMS_TRANSCRIPT_SOURCE", "teams_captions")

    validate_secrets()

    names = list(required_secret_names())
    assert "OPENAI_API_KEY" not in names
    assert "AZURE_STORAGE_CONNECTION_STRING" in names


@pytest.mark.unit
def test_configure_request_transcript_source_overrides_startup_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MSTEAMS_TRANSCRIPT_SOURCE", "teams_captions")

    config = config_for_configure_request(
        platform="msteams",
        transcript_source="audio_asr",
    )

    names = list(required_secret_names(config))
    assert "OPENAI_API_KEY" in names


@pytest.mark.unit
def test_configure_request_captions_override_skips_startup_stt_provider(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "azure_speech")

    config = config_for_configure_request(
        platform="msteams",
        transcript_source="teams_captions",
    )

    names = list(required_secret_names(config))
    assert "AZURE_SPEECH_KEY" not in names
    assert "AZURE_SPEECH_REGION" not in names


@pytest.mark.unit
def test_configure_request_teams_caption_singular_matches_runtime_as_asr(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MSTEAMS_TRANSCRIPT_SOURCE", "teams_captions")

    config = config_for_configure_request(
        platform="msteams",
        transcript_source="caption",
    )

    names = list(required_secret_names(config))
    assert "OPENAI_API_KEY" in names


@pytest.mark.unit
def test_teams_webrtc_csrc_uses_azure_asr_provider(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", _VALID_AZURE_STORAGE)
    monkeypatch.setenv("MSTEAMS_ATTRIBUTION_MODE", "webrtc_csrc")
    monkeypatch.setenv("ASR_PROVIDER", "azure")
    monkeypatch.setenv("AZURE_SPEECH_ENDPOINT", "https://speech.example.com")

    validate_secrets()

    names = list(required_secret_names())
    assert "AZURE_SPEECH_ENDPOINT" in names
    assert "OPENAI_API_KEY" not in names


@pytest.mark.unit
def test_teams_webrtc_csrc_azure_prefers_key_region_when_endpoint_is_present(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", _VALID_AZURE_STORAGE)
    monkeypatch.setenv("MSTEAMS_ATTRIBUTION_MODE", "webrtc_csrc")
    monkeypatch.setenv("ASR_PROVIDER", "azure")
    monkeypatch.setenv("AZURE_SPEECH_ENDPOINT", "not a url")
    monkeypatch.setenv("AZURE_SPEECH_KEY", "real-key")
    monkeypatch.setenv("AZURE_SPEECH_REGION", "eastus")

    validate_secrets()

    names = list(required_secret_names())
    assert "AZURE_SPEECH_KEY" in names
    assert "AZURE_SPEECH_REGION" in names
    assert "AZURE_SPEECH_ENDPOINT" not in names


@pytest.mark.unit
def test_teams_webrtc_csrc_azure_requires_region_with_key_preferred_auto_mode(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", _VALID_AZURE_STORAGE)
    monkeypatch.setenv("MSTEAMS_ATTRIBUTION_MODE", "webrtc_csrc")
    monkeypatch.setenv("ASR_PROVIDER", "azure")
    monkeypatch.setenv("AZURE_SPEECH_ENDPOINT", "https://speech.example.com")
    monkeypatch.setenv("AZURE_SPEECH_KEY", "real-key")
    monkeypatch.setenv("AZURE_SPEECH_REGION", " ")

    with pytest.raises(MissingSecretError) as excinfo:
        validate_secrets()

    missing_names = " ".join(excinfo.value.missing)
    assert "AZURE_SPEECH_REGION" in missing_names
    assert "AZURE_SPEECH_ENDPOINT" not in missing_names


@pytest.mark.unit
def test_teams_webrtc_csrc_default_aws_asr_does_not_require_llm_provider(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", _VALID_AZURE_STORAGE)
    monkeypatch.setenv("MSTEAMS_ATTRIBUTION_MODE", "webrtc_csrc")

    validate_secrets()

    names = list(required_secret_names())
    assert "OPENAI_API_KEY" not in names
    assert "S3_BUCKET_NAME" not in names
    assert "AWS_ACCESS_KEY_ID" not in names
    assert "AWS_SECRET_ACCESS_KEY" not in names


@pytest.mark.unit
def test_teams_webrtc_csrc_validates_partial_explicit_aws_credentials(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", _VALID_AZURE_STORAGE)
    monkeypatch.setenv("MSTEAMS_ATTRIBUTION_MODE", "webrtc_csrc")
    monkeypatch.setenv("AWS_SESSION_TOKEN", "session-token")

    with pytest.raises(MissingSecretError) as excinfo:
        validate_secrets()

    missing_names = " ".join(excinfo.value.missing)
    assert "AWS_ACCESS_KEY_ID" in missing_names
    assert "AWS_SECRET_ACCESS_KEY" in missing_names


@pytest.mark.unit
def test_googlemeet_captions_skips_streaming_asr_secrets(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", _VALID_AZURE_STORAGE)
    monkeypatch.setenv("MEETING_JOINER_ENABLED_PLATFORMS", "googlemeet")
    monkeypatch.setenv("GOOGLEMEET_TRANSCRIPT_SOURCE", "gmeet_captions")

    validate_secrets()

    names = list(required_secret_names())
    assert "OPENAI_API_KEY" not in names
    assert "AWS_ACCESS_KEY_ID" not in names


@pytest.mark.unit
def test_googlemeet_audio_asr_uses_shared_asr_provider(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", _VALID_AZURE_STORAGE)
    monkeypatch.setenv("MEETING_JOINER_ENABLED_PLATFORMS", "googlemeet")
    monkeypatch.setenv("ASR_PROVIDER", "azure")
    monkeypatch.setenv("AZURE_SPEECH_ENDPOINT", "https://speech.example.com")

    validate_secrets()

    names = list(required_secret_names())
    assert "AZURE_SPEECH_ENDPOINT" in names
    assert "OPENAI_API_KEY" not in names


@pytest.mark.unit
def test_selected_aws_transcribe_storage_uses_s3_not_azure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("LLM_PROVIDER", "aws_transcribe")
    monkeypatch.setenv("S3_BUCKET_NAME", "meeting-audio")

    validate_secrets()

    names = list(required_secret_names())
    assert "S3_BUCKET_NAME" in names
    assert "AWS_ACCESS_KEY_ID" not in names
    assert "AWS_SECRET_ACCESS_KEY" not in names
    assert "AZURE_STORAGE_CONNECTION_STRING" not in names


@pytest.mark.unit
def test_selected_aws_transcribe_storage_validates_partial_explicit_credentials(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("LLM_PROVIDER", "aws_transcribe")
    monkeypatch.setenv("S3_BUCKET_NAME", "meeting-audio")
    monkeypatch.setenv("AWS_SESSION_TOKEN", "session-token")

    with pytest.raises(MissingSecretError) as excinfo:
        validate_secrets()

    missing_names = " ".join(excinfo.value.missing)
    assert "AWS_ACCESS_KEY_ID" in missing_names
    assert "AWS_SECRET_ACCESS_KEY" in missing_names


@pytest.mark.unit
def test_selected_aws_transcribe_medical_allows_default_credential_chain(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("LLM_PROVIDER", "aws_transcribe_medical")
    monkeypatch.setenv("S3_BUCKET_NAME", "medical-audio")
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", _VALID_AZURE_STORAGE)

    validate_secrets()

    names = list(required_secret_names())
    assert "S3_BUCKET_NAME" in names
    assert "AWS_ACCESS_KEY_ID" not in names
    assert "AWS_SECRET_ACCESS_KEY" not in names


@pytest.mark.unit
def test_selected_aws_transcribe_medical_validates_partial_explicit_credentials(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("LLM_PROVIDER", "aws_transcribe_medical")
    monkeypatch.setenv("S3_BUCKET_NAME", "medical-audio")
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", _VALID_AZURE_STORAGE)
    monkeypatch.setenv("AWS_SESSION_TOKEN", "session-token")

    with pytest.raises(MissingSecretError) as excinfo:
        validate_secrets()

    missing_names = " ".join(excinfo.value.missing)
    assert "AWS_ACCESS_KEY_ID" in missing_names
    assert "AWS_SECRET_ACCESS_KEY" in missing_names


@pytest.mark.unit
def test_selected_bedrock_storage_requires_s3_bucket_when_uploads_enabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("LLM_PROVIDER", "bedrock")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "aws-key")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "aws-secret")

    with pytest.raises(MissingSecretError) as excinfo:
        validate_secrets()

    missing_names = " ".join(excinfo.value.missing)
    assert "S3_BUCKET_NAME" in missing_names
    assert "AZURE_STORAGE_CONNECTION_STRING" not in missing_names


@pytest.mark.unit
def test_selected_healthscribe_requires_role_arn_or_account_id(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", _VALID_AZURE_STORAGE)
    monkeypatch.setenv("LLM_PROVIDER", "healthscribe")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "aws-key")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "aws-secret")
    monkeypatch.setenv("S3_BUCKET_NAME", "healthscribe-input")

    with pytest.raises(MissingSecretError) as excinfo:
        validate_secrets()

    missing_names = " ".join(excinfo.value.missing)
    assert "HEALTHSCRIBE_DATA_ACCESS_ROLE_ARN" in missing_names
    assert "AWS_ACCOUNT_ID" in missing_names


@pytest.mark.unit
def test_selected_healthscribe_accepts_account_id(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", _VALID_AZURE_STORAGE)
    monkeypatch.setenv("LLM_PROVIDER", "healthscribe")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "aws-key")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "aws-secret")
    monkeypatch.setenv("S3_BUCKET_NAME", "healthscribe-input")
    monkeypatch.setenv("AWS_ACCOUNT_ID", "123456789012")

    validate_secrets()

    names = list(required_secret_names())
    assert "AWS_ACCOUNT_ID" in names
    assert "HEALTHSCRIBE_DATA_ACCESS_ROLE_ARN" not in names


@pytest.mark.unit
def test_selected_bedrock_nova_is_rejected_for_managed_worker_runtime(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", _VALID_AZURE_STORAGE)
    monkeypatch.setenv("LLM_PROVIDER", "bedrock_nova")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "aws-key")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "aws-secret")

    with pytest.raises(ValueError, match="bedrock_nova"):
        validate_secrets()


@pytest.mark.unit
def test_azure_storage_managed_identity_accepts_account_without_connection_string(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-1234567890")
    monkeypatch.setenv("AZURE_STORAGE_AUTH", "managed_identity")
    monkeypatch.setenv("AZURE_STORAGE_ACCOUNT_NAME", "meetingrecordings")

    validate_secrets()

    names = list(required_secret_names())
    assert "AZURE_STORAGE_ACCOUNT_NAME" in names
    assert "AZURE_STORAGE_CONNECTION_STRING" not in names


@pytest.mark.unit
def test_azure_storage_managed_identity_requires_endpoint_or_account_not_connection_string(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-1234567890")
    monkeypatch.setenv("AZURE_STORAGE_AUTH", "managed_identity")

    with pytest.raises(MissingSecretError) as excinfo:
        validate_secrets()

    missing_names = " ".join(excinfo.value.missing)
    assert "AZURE_STORAGE_BLOB_ENDPOINT" in missing_names
    assert "AZURE_STORAGE_ACCOUNT_NAME" in missing_names
    assert "AZURE_STORAGE_CONNECTION_STRING" not in missing_names


@pytest.mark.unit
def test_azure_storage_auto_rejects_placeholder_connection_string_even_with_endpoint(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-1234567890")
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", "changeme")
    monkeypatch.setenv(
        "AZURE_STORAGE_BLOB_ENDPOINT", "https://meetingrecordings.blob.core.windows.net"
    )

    with pytest.raises(MissingSecretError) as excinfo:
        validate_secrets()

    missing_names = " ".join(excinfo.value.missing)
    assert "AZURE_STORAGE_CONNECTION_STRING" in missing_names
    assert "AZURE_STORAGE_BLOB_ENDPOINT" not in missing_names


@pytest.mark.unit
def test_azure_storage_auto_rejects_whitespace_connection_string_even_with_endpoint(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-1234567890")
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", " ")
    monkeypatch.setenv(
        "AZURE_STORAGE_BLOB_ENDPOINT", "https://meetingrecordings.blob.core.windows.net"
    )

    with pytest.raises(MissingSecretError) as excinfo:
        validate_secrets()

    missing_names = " ".join(excinfo.value.missing)
    assert "AZURE_STORAGE_CONNECTION_STRING" in missing_names
    assert "AZURE_STORAGE_BLOB_ENDPOINT" not in missing_names


@pytest.mark.unit
def test_azure_storage_managed_identity_rejects_invalid_endpoint_even_with_account(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-1234567890")
    monkeypatch.setenv("AZURE_STORAGE_AUTH", "managed_identity")
    monkeypatch.setenv("AZURE_STORAGE_BLOB_ENDPOINT", "not a url")
    monkeypatch.setenv("AZURE_STORAGE_ACCOUNT_NAME", "meetingrecordings")

    with pytest.raises(MissingSecretError) as excinfo:
        validate_secrets()

    missing_names = " ".join(excinfo.value.missing)
    assert "AZURE_STORAGE_BLOB_ENDPOINT" in missing_names
    assert "AZURE_STORAGE_ACCOUNT_NAME" not in missing_names


@pytest.mark.unit
def test_azure_storage_managed_identity_rejects_invalid_account_name(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-1234567890")
    monkeypatch.setenv("AZURE_STORAGE_AUTH", "managed_identity")
    monkeypatch.setenv("AZURE_STORAGE_ACCOUNT_NAME", "not a url")

    with pytest.raises(MissingSecretError) as excinfo:
        validate_secrets()

    missing_names = " ".join(excinfo.value.missing)
    assert "AZURE_STORAGE_ACCOUNT_NAME" in missing_names
    assert "AZURE_STORAGE_BLOB_ENDPOINT" not in missing_names


@pytest.mark.unit
def test_collects_all_missing_in_one_error(monkeypatch: pytest.MonkeyPatch) -> None:
    """The operator should see every missing secret in one boot attempt."""
    # Everything missing
    with pytest.raises(MissingSecretError) as excinfo:
        validate_secrets()

    missing_names = " ".join(excinfo.value.missing)
    assert "DATABASE_URL" in missing_names
    assert "AZURE_STORAGE_CONNECTION_STRING" in missing_names
    assert "OPENAI_API_KEY" in missing_names


@pytest.mark.unit
def test_unknown_platform_raises_value_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-1234567890")
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", _VALID_AZURE_STORAGE)

    config = ValidationConfig(
        enabled_platforms=("not-a-real-platform",),
        stt_providers=("openai",),
        storage_required=True,
    )
    with pytest.raises(ValueError) as excinfo:
        validate_secrets(config)

    assert "not-a-real-platform" in str(excinfo.value)


@pytest.mark.unit
def test_jwt_secret_unset_raises_in_non_dev(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RUNTIME_MODE", "k8s")
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-1234567890")
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", _VALID_AZURE_STORAGE)

    with pytest.raises(MissingSecretError) as excinfo:
        validate_secrets()

    assert any("JWT_SECRET" in entry for entry in excinfo.value.missing)


@pytest.mark.unit
def test_jwt_secret_default_value_raises_in_non_dev(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("RUNTIME_MODE", "k8s")
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-1234567890")
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", _VALID_AZURE_STORAGE)
    monkeypatch.setenv("JWT_SECRET", "dev-insecure-change-me")

    with pytest.raises(MissingSecretError) as excinfo:
        validate_secrets()

    assert any("JWT_SECRET" in entry for entry in excinfo.value.missing)


@pytest.mark.unit
def test_jwt_secret_default_value_allowed_in_dev(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("RUNTIME_MODE", "standalone")
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-1234567890")
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", _VALID_AZURE_STORAGE)
    monkeypatch.setenv("JWT_SECRET", "dev-insecure-change-me")

    validate_secrets()  # no exception


@pytest.mark.unit
def test_jwt_secret_real_value_passes_in_non_dev(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("RUNTIME_MODE", "k8s")
    monkeypatch.setenv("DATABASE_URL", _VALID_PG_URL)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-1234567890")
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", _VALID_AZURE_STORAGE)
    monkeypatch.setenv("JWT_SECRET", "a-real-random-secret-value")

    validate_secrets()  # no exception
