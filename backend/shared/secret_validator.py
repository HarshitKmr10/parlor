"""Startup secret validation.

Runs once at API + sidecar boot, before any handler is accepting traffic. If
any required secret is missing or malformed, raises :class:`MissingSecretError`
which causes the process to exit non-zero so K8s restarts it (or fails the
deployment).

Why not rely on pydantic field validators in ``shared/config.py``?
Today the config uses ``str = ""`` defaults for all secrets (see lines 27-29
and 32 of ``shared/config.py``). That makes the service appear to start fine
and then fail at first use deep inside a handler, which is exactly the
"service is running but broken" failure mode we are trying to eliminate. This
module is the explicit single source of truth for what the service requires
and runs *before* dependents read those values.

Required vs optional is platform-dependent: a customer cluster that only does
Zoom doesn't need ``MICROSOFT_APP_PASSWORD``. The validator therefore takes a
configuration that lists enabled platforms, derived from the ConfigMap.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field, replace
from typing import Callable, Iterable
from urllib.parse import urlparse

# Sentinel values commonly left in env files that are NOT real secrets.
_INVALID_DEFAULTS = frozenset(
    {"", "changeme", "todo", "tbd", "xxx", "placeholder", "null", "none"}
)
_TEAMS_CAPTIONS_TRANSCRIPT_SOURCE_ALIASES = frozenset(
    {
        "teams_captions",
        "team_captions",
        "captions",
        "closed_captions",
        "closed_caption",
        "closed_caption_from_platform",
    }
)
_GOOGLEMEET_CAPTIONS_TRANSCRIPT_SOURCE_ALIASES = frozenset(
    {
        "gmeet_captions",
        "gmeet_caption",
        "google_meet_captions",
        "captions",
        "caption",
        "closed_captions",
        "cc",
    }
)
_GOOGLEMEET_ASR_TRANSCRIPT_SOURCE_ALIASES = frozenset(
    {"audio_asr", "asr", "audio", "streaming", "aws", "azure"}
)
_CSRC_ASR_PROVIDERS = frozenset({"aws", "azure"})
_AZURE_SPEECH_AUTH_ALIASES = {
    "auto": "auto",
    "key": "key",
    "api_key": "key",
    "subscription_key": "key",
    "subscription": "key",
    "managed_identity": "managed_identity",
    "managedidentity": "managed_identity",
    "workload_identity": "managed_identity",
    "workloadidentity": "managed_identity",
    "identity": "managed_identity",
    "aad": "managed_identity",
    "entra": "managed_identity",
}


class MissingSecretError(RuntimeError):
    """Raised at startup when one or more required secrets are missing."""

    def __init__(self, missing: list[str]) -> None:
        self.missing = list(missing)
        joined = ", ".join(self.missing)
        super().__init__(
            f"Required secret(s) missing or invalid: {joined}. "
            "Set these env vars (typically via ExternalSecret / sealed Secret) "
            "and restart the service."
        )


@dataclass(frozen=True)
class SecretRequirement:
    """Declares one required secret + how to validate its shape."""

    name: str
    description: str
    starts_with: tuple[str, ...] = ()
    min_length: int = 1
    validator: Callable[[str], bool] | None = None
    env_names: tuple[str, ...] = ()


def _valid_absolute_url(value: str, allowed_schemes: tuple[str, ...]) -> bool:
    if any(char.isspace() for char in value):
        return False
    parsed = urlparse(value)
    return parsed.scheme in allowed_schemes and bool(parsed.netloc)


def _valid_speech_endpoint(value: str) -> bool:
    if not any(char.isspace() for char in value) and "://" not in value:
        value = f"https://{value}"
    return _valid_absolute_url(value, ("https", "wss"))


def _valid_https_url(value: str) -> bool:
    return _valid_absolute_url(value, ("https",))


def _valid_http_url(value: str) -> bool:
    return _valid_absolute_url(value, ("http", "https"))


def _valid_azure_storage_account_name(value: str) -> bool:
    return re.fullmatch(r"[a-z0-9]{3,24}", value) is not None


def _valid_aws_account_id(value: str) -> bool:
    return re.fullmatch(r"\d{12}", value) is not None


def _valid_iam_role_arn(value: str) -> bool:
    if "YOUR_ACCOUNT_ID" in value:
        return False
    return re.fullmatch(r"arn:aws[a-zA-Z-]*:iam::\d{12}:role/.+", value) is not None


_JWT_SECRET_DEFAULT = "dev-insecure-change-me"


def _valid_jwt_secret(value: str) -> bool:
    return value != _JWT_SECRET_DEFAULT


def _is_dev_environment() -> bool:
    # Mirrors src/main.py's _is_standalone(): "standalone"/"compose" are the
    # K8s-free local dev / docker-compose paths (matches Settings.RUNTIME_MODE's
    # "standalone" default); anything else is a real (k8s) deployment.
    return os.environ.get("RUNTIME_MODE", "standalone").lower() in (
        "standalone",
        "compose",
    )


# Always required regardless of which platforms are enabled.
_CORE_REQUIRED: tuple[SecretRequirement, ...] = (
    SecretRequirement(
        name="DATABASE_URL",
        description="PostgreSQL connection string for the shared application DB",
        starts_with=("postgresql://", "postgres://"),
    ),
)

_JWT_SECRET_REQUIREMENT = SecretRequirement(
    name="JWT_SECRET",
    description="JWT signing secret for product access/refresh tokens",
    validator=_valid_jwt_secret,
)


# Per-platform requirements, opt-in via the ``enabled_platforms`` config.
_PLATFORM_REQUIREMENTS: dict[str, tuple[SecretRequirement, ...]] = {
    "msteams_playwright": (
        # Playwright bot needs nothing additional beyond an STT provider key,
        # which is captured under "stt" below.
    ),
    "zoom": (
        SecretRequirement(
            name="ZOOM_CLIENT_ID",
            description="Zoom OAuth client ID for the Meeting SDK bot",
            env_names=("ZOOM_APP_CLIENT_ID", "ZOOM_CLIENT_ID"),
        ),
        SecretRequirement(
            name="ZOOM_CLIENT_SECRET",
            description="Zoom OAuth client secret",
            min_length=8,
            env_names=("ZOOM_APP_CLIENT_SECRET", "ZOOM_CLIENT_SECRET"),
        ),
    ),
    "googlemeet": (),  # Guest-mode Playwright bot; no extra secrets.
}


_AZURE_SPEECH_KEY_REQUIREMENT = SecretRequirement(
    name="AZURE_SPEECH_KEY",
    description="Azure Speech Service key",
)
_AZURE_SPEECH_REGION_REQUIREMENT = SecretRequirement(
    name="AZURE_SPEECH_REGION",
    description="Azure Speech Service region",
)
_AZURE_SPEECH_ENDPOINT_REQUIREMENT = SecretRequirement(
    name="AZURE_SPEECH_ENDPOINT",
    description="Azure Speech custom-subdomain endpoint for managed identity auth",
    validator=_valid_speech_endpoint,
)
_AZURE_SPEECH_CONTAINER_ENDPOINT_REQUIREMENT = SecretRequirement(
    name="AZURE_SPEECH_CONTAINER_ENDPOINT",
    description="Azure Speech container endpoint",
    validator=_valid_http_url,
)
_AZURE_OPENAI_API_KEY_REQUIREMENT = SecretRequirement(
    name="AZURE_OPENAI_API_KEY",
    description="Azure OpenAI API key",
)
_AZURE_OPENAI_ENDPOINT_REQUIREMENT = SecretRequirement(
    name="AZURE_OPENAI_ENDPOINT",
    description="Azure OpenAI endpoint",
    starts_with=("https://",),
    validator=_valid_https_url,
)
_AWS_ACCESS_KEY_ID_REQUIREMENT = SecretRequirement(
    name="AWS_ACCESS_KEY_ID",
    description="AWS access key",
)
_AWS_SECRET_ACCESS_KEY_REQUIREMENT = SecretRequirement(
    name="AWS_SECRET_ACCESS_KEY",
    description="AWS secret key",
)
_S3_BUCKET_NAME_REQUIREMENT = SecretRequirement(
    name="S3_BUCKET_NAME",
    description="S3 bucket name for transcription input/output",
)
_AWS_ACCOUNT_ID_REQUIREMENT = SecretRequirement(
    name="AWS_ACCOUNT_ID",
    description="AWS account ID used to build the HealthScribe data access role ARN",
    validator=_valid_aws_account_id,
)
_HEALTHSCRIBE_DATA_ACCESS_ROLE_ARN_REQUIREMENT = SecretRequirement(
    name="HEALTHSCRIBE_DATA_ACCESS_ROLE_ARN",
    description="HealthScribe data access IAM role ARN",
    validator=_valid_iam_role_arn,
)


# STT provider — at least one must be configured.
_STT_PROVIDER_REQUIREMENTS: dict[str, tuple[SecretRequirement, ...]] = {
    "openai": (
        SecretRequirement(
            name="OPENAI_API_KEY",
            description="OpenAI Whisper API key",
            starts_with=("sk-",),
        ),
    ),
    "azure_speech": (
        _AZURE_SPEECH_KEY_REQUIREMENT,
        _AZURE_SPEECH_REGION_REQUIREMENT,
    ),
    "azure_openai": (
        _AZURE_OPENAI_API_KEY_REQUIREMENT,
        _AZURE_OPENAI_ENDPOINT_REQUIREMENT,
    ),
    "aws_transcribe": (_S3_BUCKET_NAME_REQUIREMENT,),
    "aws_transcribe_medical": (_S3_BUCKET_NAME_REQUIREMENT,),
    "bedrock": (
        _AWS_ACCESS_KEY_ID_REQUIREMENT,
        _AWS_SECRET_ACCESS_KEY_REQUIREMENT,
    ),
    "healthscribe": (
        _AWS_ACCESS_KEY_ID_REQUIREMENT,
        _AWS_SECRET_ACCESS_KEY_REQUIREMENT,
        _S3_BUCKET_NAME_REQUIREMENT,
    ),
}


_AZURE_STORAGE_CONNECTION_STRING_REQUIREMENT = SecretRequirement(
    name="AZURE_STORAGE_CONNECTION_STRING",
    description="Azure Blob connection string for recording uploads",
    starts_with=("DefaultEndpointsProtocol=",),
)
_AZURE_STORAGE_BLOB_ENDPOINT_REQUIREMENT = SecretRequirement(
    name="AZURE_STORAGE_BLOB_ENDPOINT",
    description="Azure Blob endpoint for managed identity auth",
    starts_with=("https://",),
    validator=_valid_https_url,
)
_AZURE_STORAGE_ACCOUNT_NAME_REQUIREMENT = SecretRequirement(
    name="AZURE_STORAGE_ACCOUNT_NAME",
    description="Azure Storage account name for managed identity auth",
    validator=_valid_azure_storage_account_name,
)


@dataclass(frozen=True)
class ValidationConfig:
    """Drives which platform / STT secrets are required for this deployment.

    Populated from the K8s ConfigMap at startup. Default values keep the
    legacy behaviour (Teams Playwright + OpenAI STT + Azure storage) for
    customers who haven't yet adopted the chart's values overrides.
    """

    enabled_platforms: tuple[str, ...] = ("msteams_playwright",)
    stt_providers: tuple[str, ...] = ("openai",)
    storage_required: bool = True
    selected_stt_provider: str | None = "openai"
    msteams_transcript_source: str | None = None
    msteams_attribution_mode: str | None = None
    googlemeet_transcript_source: str | None = None
    googlemeet_capture_mode: str | None = None
    asr_provider: str | None = None
    msteams_asr_provider: str | None = None

    @classmethod
    def from_env(cls) -> "ValidationConfig":
        platforms = _split_csv(os.environ.get("MEETING_JOINER_ENABLED_PLATFORMS"))
        stt = _split_csv(os.environ.get("MEETING_JOINER_STT_PROVIDERS"))
        selected_stt = os.environ.get("LLM_PROVIDER")
        storage = (
            os.environ.get("MEETING_JOINER_STORAGE_REQUIRED", "true").strip().lower()
            != "false"
        )
        return cls(
            enabled_platforms=platforms or ("msteams_playwright",),
            stt_providers=stt or ("openai",),
            storage_required=storage,
            selected_stt_provider=selected_stt if selected_stt else "openai",
            msteams_transcript_source=os.environ.get("MSTEAMS_TRANSCRIPT_SOURCE"),
            msteams_attribution_mode=os.environ.get("MSTEAMS_ATTRIBUTION_MODE"),
            googlemeet_transcript_source=os.environ.get("GOOGLEMEET_TRANSCRIPT_SOURCE"),
            googlemeet_capture_mode=os.environ.get("GOOGLEMEET_CAPTURE_MODE"),
            asr_provider=os.environ.get("ASR_PROVIDER"),
            msteams_asr_provider=os.environ.get("MSTEAMS_ASR_PROVIDER"),
        )


def _split_csv(raw: str | None) -> tuple[str, ...]:
    if not raw:
        return ()
    return tuple(part.strip() for part in raw.split(",") if part.strip())


def _platform_for_validation(platform: str) -> str:
    normalized = platform.strip().lower()
    if normalized in {"msteams", "msteams_playwright"}:
        return "msteams_playwright"
    if normalized == "googlemeet":
        return "googlemeet"
    if normalized == "zoom":
        return "zoom"
    raise ValueError(
        f"Unknown platform '{platform}' in sidecar configure request. "
        f"Allowed: ['googlemeet', 'msteams', 'zoom']"
    )


def config_for_configure_request(
    *,
    platform: str,
    transcript_source: str | None,
) -> "ValidationConfig":
    """Build validation config for a specific sidecar /configure request."""
    validation_platform = _platform_for_validation(platform)
    config = ValidationConfig.from_env()
    overrides = {
        "enabled_platforms": (validation_platform,),
    }
    if transcript_source is not None:
        if validation_platform == "msteams_playwright":
            overrides["msteams_transcript_source"] = transcript_source
        elif validation_platform == "googlemeet":
            overrides["googlemeet_transcript_source"] = transcript_source
            overrides["googlemeet_capture_mode"] = None
    return replace(config, **overrides)


def _is_valid(value: str | None, requirement: SecretRequirement) -> bool:
    if value is None:
        return False
    cleaned = value.strip()
    if cleaned.lower() in _INVALID_DEFAULTS:
        return False
    if len(cleaned) < requirement.min_length:
        return False
    if requirement.starts_with and not any(
        cleaned.startswith(prefix) for prefix in requirement.starts_with
    ):
        return False
    if requirement.validator and not requirement.validator(cleaned):
        return False
    return True


def _candidate_secret_names(requirement: SecretRequirement) -> tuple[str, ...]:
    return requirement.env_names or (requirement.name,)


def _selected_env_value(requirement: SecretRequirement) -> str | None:
    # Match runtime fallback semantics such as
    # ``ZOOM_APP_CLIENT_ID or ZOOM_CLIENT_ID``: empty strings fall through, but
    # whitespace strings are selected and then rejected by _is_valid.
    for name in _candidate_secret_names(requirement):
        value = os.environ.get(name)
        if value is not None and value != "":
            return value
    return None


def _requirement_label(requirement: SecretRequirement) -> str:
    return " or ".join(_candidate_secret_names(requirement))


def _has_env_value(name: str) -> bool:
    value = os.environ.get(name)
    return value is not None and value.strip() != ""


def _has_raw_env_value(name: str) -> bool:
    value = os.environ.get(name)
    return value is not None and value != ""


def _normalized_auth_mode(
    raw: str | None, aliases: dict[str, str], env_name: str
) -> str:
    value = (raw or "auto").strip().lower().replace("-", "_").replace(" ", "_")
    if not value:
        return "auto"
    normalized = aliases.get(value)
    if normalized is None:
        raise ValueError(f"Unsupported {env_name} value: {raw}")
    return normalized


def _azure_speech_requirements() -> tuple[SecretRequirement, ...]:
    auth_mode = _azure_speech_auth_mode()
    endpoint_is_present = _has_env_value("AZURE_SPEECH_ENDPOINT")
    container_endpoint_is_present = _has_raw_env_value(
        "AZURE_SPEECH_CONTAINER_ENDPOINT"
    )

    if container_endpoint_is_present:
        if auth_mode == "managed_identity":
            raise ValueError(
                "AZURE_SPEECH_AUTH=managed_identity is not supported with "
                "AZURE_SPEECH_CONTAINER_ENDPOINT"
            )
        return (_AZURE_SPEECH_CONTAINER_ENDPOINT_REQUIREMENT,)

    if auth_mode == "managed_identity":
        return (_AZURE_SPEECH_ENDPOINT_REQUIREMENT,)

    if auth_mode == "key":
        if endpoint_is_present:
            return (_AZURE_SPEECH_ENDPOINT_REQUIREMENT, _AZURE_SPEECH_KEY_REQUIREMENT)
        return (_AZURE_SPEECH_KEY_REQUIREMENT, _AZURE_SPEECH_REGION_REQUIREMENT)

    if endpoint_is_present and _has_raw_env_value("AZURE_SPEECH_KEY"):
        return (_AZURE_SPEECH_ENDPOINT_REQUIREMENT, _AZURE_SPEECH_KEY_REQUIREMENT)
    if endpoint_is_present:
        return (_AZURE_SPEECH_ENDPOINT_REQUIREMENT,)
    return (_AZURE_SPEECH_KEY_REQUIREMENT, _AZURE_SPEECH_REGION_REQUIREMENT)


def _azure_speech_streaming_requirements() -> tuple[SecretRequirement, ...]:
    auth_mode = _azure_speech_auth_mode()
    endpoint_is_present = _has_env_value("AZURE_SPEECH_ENDPOINT")
    container_endpoint_is_present = _has_raw_env_value(
        "AZURE_SPEECH_CONTAINER_ENDPOINT"
    )

    if container_endpoint_is_present:
        if auth_mode == "managed_identity":
            raise ValueError(
                "AZURE_SPEECH_AUTH=managed_identity is not supported with "
                "AZURE_SPEECH_CONTAINER_ENDPOINT"
            )
        return (_AZURE_SPEECH_CONTAINER_ENDPOINT_REQUIREMENT,)

    if auth_mode == "managed_identity":
        return (_AZURE_SPEECH_ENDPOINT_REQUIREMENT,)

    if auth_mode == "key":
        if endpoint_is_present:
            return (_AZURE_SPEECH_ENDPOINT_REQUIREMENT, _AZURE_SPEECH_KEY_REQUIREMENT)
        return (_AZURE_SPEECH_KEY_REQUIREMENT, _AZURE_SPEECH_REGION_REQUIREMENT)

    if _has_raw_env_value("AZURE_SPEECH_KEY") and _has_raw_env_value(
        "AZURE_SPEECH_REGION"
    ):
        return (_AZURE_SPEECH_KEY_REQUIREMENT, _AZURE_SPEECH_REGION_REQUIREMENT)
    if endpoint_is_present and _has_raw_env_value("AZURE_SPEECH_KEY"):
        return (_AZURE_SPEECH_ENDPOINT_REQUIREMENT, _AZURE_SPEECH_KEY_REQUIREMENT)
    if endpoint_is_present:
        return (_AZURE_SPEECH_ENDPOINT_REQUIREMENT,)
    return (_AZURE_SPEECH_KEY_REQUIREMENT, _AZURE_SPEECH_REGION_REQUIREMENT)


def _azure_speech_auth_mode() -> str:
    return _normalized_auth_mode(
        os.environ.get("AZURE_SPEECH_AUTH"),
        _AZURE_SPEECH_AUTH_ALIASES,
        "AZURE_SPEECH_AUTH",
    )


def _azure_storage_requirements() -> tuple[SecretRequirement, ...]:
    auth_mode = _normalized_auth_mode(
        os.environ.get("AZURE_STORAGE_AUTH"),
        {
            "auto": "auto",
            "connection_string": "connection_string",
            "connectionstring": "connection_string",
            "key": "connection_string",
            "managed_identity": "managed_identity",
            "managedidentity": "managed_identity",
            "workload_identity": "managed_identity",
            "workloadidentity": "managed_identity",
            "identity": "managed_identity",
            "aad": "managed_identity",
            "entra": "managed_identity",
        },
        "AZURE_STORAGE_AUTH",
    )
    endpoint_is_present = _has_raw_env_value("AZURE_STORAGE_BLOB_ENDPOINT")
    account_name_is_present = _has_raw_env_value("AZURE_STORAGE_ACCOUNT_NAME")

    if auth_mode == "managed_identity":
        if endpoint_is_present:
            return (_AZURE_STORAGE_BLOB_ENDPOINT_REQUIREMENT,)
        if account_name_is_present:
            return (_AZURE_STORAGE_ACCOUNT_NAME_REQUIREMENT,)
        return (
            _AZURE_STORAGE_BLOB_ENDPOINT_REQUIREMENT,
            _AZURE_STORAGE_ACCOUNT_NAME_REQUIREMENT,
        )

    if auth_mode == "connection_string":
        return (_AZURE_STORAGE_CONNECTION_STRING_REQUIREMENT,)

    if _has_raw_env_value("AZURE_STORAGE_CONNECTION_STRING"):
        return (_AZURE_STORAGE_CONNECTION_STRING_REQUIREMENT,)
    if endpoint_is_present:
        return (_AZURE_STORAGE_BLOB_ENDPOINT_REQUIREMENT,)
    if account_name_is_present:
        return (_AZURE_STORAGE_ACCOUNT_NAME_REQUIREMENT,)
    return (_AZURE_STORAGE_CONNECTION_STRING_REQUIREMENT,)


def _stt_provider_requirements(provider: str) -> tuple[SecretRequirement, ...] | None:
    if provider == "azure_speech":
        return _azure_speech_requirements()
    if provider in {"aws_transcribe", "aws_transcribe_medical"}:
        return (
            _S3_BUCKET_NAME_REQUIREMENT,
            *_aws_streaming_asr_requirements(),
        )
    if provider == "healthscribe":
        return _healthscribe_requirements()
    return _STT_PROVIDER_REQUIREMENTS.get(provider)


def _llm_provider_requirements(
    config: ValidationConfig,
) -> tuple[SecretRequirement, ...]:
    # Node workers select exactly ``process.env.LLM_PROVIDER || "openai"``
    # for the MultiProviderTranscriber path and do not consume
    # MEETING_JOINER_STT_PROVIDERS as a fallback list.
    selected_provider = config.selected_stt_provider or "openai"
    requirements = _stt_provider_requirements(selected_provider)
    if requirements is None:
        raise _unknown_stt_provider_error(selected_provider, "LLM_PROVIDER")
    return requirements


def _python_transcribe_service_requirements(
    config: ValidationConfig,
) -> tuple[SecretRequirement, ...]:
    # Zoom managed pods run the Python TranscribeService, which lower-cases
    # LLM_PROVIDER and falls back to OpenAI for unrecognized values.
    selected_provider = (config.selected_stt_provider or "openai").lower()
    if selected_provider == "healthscribe":
        return _python_healthscribe_requirements()
    if selected_provider == "aws_transcribe":
        return (
            _S3_BUCKET_NAME_REQUIREMENT,
            *_aws_streaming_asr_requirements(),
        )
    if selected_provider == "bedrock_nova":
        return _aws_streaming_asr_requirements()
    if selected_provider == "azure_openai":
        return _STT_PROVIDER_REQUIREMENTS["azure_openai"]
    return _STT_PROVIDER_REQUIREMENTS["openai"]


def _normalize_teams_transcript_source(raw: str | None) -> str:
    value = (raw or "").strip().lower()
    if value in _TEAMS_CAPTIONS_TRANSCRIPT_SOURCE_ALIASES:
        return "teams_captions"
    return "csrc_asr"


def _normalize_googlemeet_transcript_source(config: ValidationConfig) -> str:
    for raw in (config.googlemeet_transcript_source, config.googlemeet_capture_mode):
        if not isinstance(raw, str):
            continue
        value = raw.strip().lower()
        if value in _GOOGLEMEET_CAPTIONS_TRANSCRIPT_SOURCE_ALIASES:
            return "gmeet_captions"
        if value in _GOOGLEMEET_ASR_TRANSCRIPT_SOURCE_ALIASES:
            return "audio_asr"
    return "audio_asr"


def _is_webrtc_csrc_mode(raw: str | None) -> bool:
    return (raw or "dom").lower() == "webrtc_csrc"


def _resolve_csrc_asr_provider(config: ValidationConfig) -> str:
    for raw in (config.asr_provider, config.msteams_asr_provider):
        if not isinstance(raw, str):
            continue
        value = raw.strip().lower()
        if value in _CSRC_ASR_PROVIDERS:
            return value
    return "aws"


def _aws_streaming_asr_requirements() -> tuple[SecretRequirement, ...]:
    # The streaming adapter can use the AWS SDK default credential chain
    # (IRSA, instance profile, local profile, etc.). If a deployment does set
    # explicit env credentials, validate the pair so a projected
    # AWS_SESSION_TOKEN cannot mask a missing access key or secret.
    if any(
        _has_raw_env_value(name)
        for name in (
            "AWS_ACCESS_KEY_ID",
            "AWS_SECRET_ACCESS_KEY",
            "AWS_SESSION_TOKEN",
        )
    ):
        return (_AWS_ACCESS_KEY_ID_REQUIREMENT, _AWS_SECRET_ACCESS_KEY_REQUIREMENT)
    return ()


def _csrc_asr_requirements(config: ValidationConfig) -> tuple[SecretRequirement, ...]:
    provider = _resolve_csrc_asr_provider(config)
    if provider == "azure":
        return _azure_speech_streaming_requirements()
    return _aws_streaming_asr_requirements()


def _transcription_requirements_for_platform(
    platform: str, config: ValidationConfig
) -> tuple[SecretRequirement, ...]:
    if platform == "msteams_playwright":
        if (
            _normalize_teams_transcript_source(config.msteams_transcript_source)
            == "teams_captions"
        ):
            return ()
        if _is_webrtc_csrc_mode(config.msteams_attribution_mode):
            return _csrc_asr_requirements(config)
        return _llm_provider_requirements(config)

    if platform == "googlemeet":
        if _normalize_googlemeet_transcript_source(config) == "gmeet_captions":
            return ()
        return _csrc_asr_requirements(config)

    if platform == "zoom":
        return _python_transcribe_service_requirements(config)

    return _llm_provider_requirements(config)


def _healthscribe_data_access_requirements() -> tuple[SecretRequirement, ...]:
    if _has_raw_env_value("HEALTHSCRIBE_DATA_ACCESS_ROLE_ARN"):
        return (_HEALTHSCRIBE_DATA_ACCESS_ROLE_ARN_REQUIREMENT,)
    if _has_raw_env_value("AWS_ACCOUNT_ID"):
        return (_AWS_ACCOUNT_ID_REQUIREMENT,)
    return (
        _HEALTHSCRIBE_DATA_ACCESS_ROLE_ARN_REQUIREMENT,
        _AWS_ACCOUNT_ID_REQUIREMENT,
    )


def _healthscribe_requirements() -> tuple[SecretRequirement, ...]:
    requirements: list[SecretRequirement] = [
        _AWS_ACCESS_KEY_ID_REQUIREMENT,
        _AWS_SECRET_ACCESS_KEY_REQUIREMENT,
        _S3_BUCKET_NAME_REQUIREMENT,
    ]
    requirements.extend(_healthscribe_data_access_requirements())
    return tuple(requirements)


def _python_healthscribe_requirements() -> tuple[SecretRequirement, ...]:
    return (
        _S3_BUCKET_NAME_REQUIREMENT,
        *_aws_streaming_asr_requirements(),
        *_healthscribe_data_access_requirements(),
    )


def _unknown_stt_provider_error(provider: str, env_name: str) -> ValueError:
    return ValueError(
        f"Unknown STT provider '{provider}' in {env_name}. "
        f"Allowed: {sorted(_STT_PROVIDER_REQUIREMENTS)}"
    )


def _storage_requirements(provider: str) -> tuple[SecretRequirement, ...]:
    if provider == "aws_transcribe":
        return (
            _S3_BUCKET_NAME_REQUIREMENT,
            *_aws_streaming_asr_requirements(),
        )
    if provider == "bedrock":
        return (
            _AWS_ACCESS_KEY_ID_REQUIREMENT,
            _AWS_SECRET_ACCESS_KEY_REQUIREMENT,
            _S3_BUCKET_NAME_REQUIREMENT,
        )
    return _azure_storage_requirements()


def _dedupe_requirements(
    requirements: Iterable[SecretRequirement],
) -> tuple[SecretRequirement, ...]:
    seen: set[str] = set()
    deduped: list[SecretRequirement] = []
    for requirement in requirements:
        if requirement.name in seen:
            continue
        seen.add(requirement.name)
        deduped.append(requirement)
    return tuple(deduped)


def _collect_required(config: ValidationConfig) -> tuple[SecretRequirement, ...]:
    requirements: list[SecretRequirement] = list(_CORE_REQUIRED)
    if not _is_dev_environment():
        requirements.append(_JWT_SECRET_REQUIREMENT)
    for platform in config.enabled_platforms:
        platform_reqs = _PLATFORM_REQUIREMENTS.get(platform)
        if platform_reqs is None:
            raise ValueError(
                f"Unknown platform '{platform}' in MEETING_JOINER_ENABLED_PLATFORMS. "
                f"Allowed: {sorted(_PLATFORM_REQUIREMENTS)}"
            )
        requirements.extend(platform_reqs)
        requirements.extend(_transcription_requirements_for_platform(platform, config))

    if config.storage_required:
        storage_provider = config.selected_stt_provider or "openai"
        requirements.extend(_storage_requirements(storage_provider))

    return _dedupe_requirements(requirements)


def validate_secrets(config: ValidationConfig | None = None) -> None:
    """Validate all required secrets are present and well-formed.

    Raises :class:`MissingSecretError` listing every missing secret. We
    accumulate all failures before raising so the operator sees the full list
    in one boot attempt rather than fixing them one at a time.
    """
    cfg = config or ValidationConfig.from_env()
    requirements = _collect_required(cfg)

    missing = [
        f"{_requirement_label(req)} ({req.description})"
        for req in requirements
        if not _is_valid(_selected_env_value(req), req)
    ]
    if missing:
        raise MissingSecretError(missing)


def required_secret_names(config: ValidationConfig | None = None) -> Iterable[str]:
    """Return the names of secrets the current configuration requires.

    Useful for diagnostic endpoints (e.g. ``/ready`` to list what was checked).
    """
    cfg = config or ValidationConfig.from_env()
    names: list[str] = []
    seen: set[str] = set()
    for requirement in _collect_required(cfg):
        for name in _candidate_secret_names(requirement):
            if name in seen:
                continue
            names.append(name)
            seen.add(name)
    return tuple(names)
