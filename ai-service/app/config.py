"""Runtime configuration loaded from environment variables.

All settings are derived once at import time. No secrets are hardcoded; keys
come exclusively from the environment. The service auto-detects ``mock`` mode
when no provider keys are present so the full system runs in dev without keys.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field

# --- Model identifiers (see Anthropic / OpenAI model catalogs) -------------
# Premium = final summary + chat answers. Cheap = live/embed-adjacent tasks.
ANTHROPIC_PREMIUM_MODEL = "claude-sonnet-4-6"
ANTHROPIC_CHEAP_MODEL = "claude-haiku-4-5-20251001"
OPENAI_PREMIUM_MODEL = "gpt-4o"
OPENAI_CHEAP_MODEL = "gpt-4o-mini"

# Azure OpenAI routes by *deployment name*, not model id. The default chat
# deployment maps to the user's "5.4 mini" (deployment id ``gpt-5.4-mini`` in
# their resource). Overridable via AZURE_OPENAI_DEPLOYMENT.
AZURE_OPENAI_DEFAULT_DEPLOYMENT = "gpt-5.4-mini"
AZURE_OPENAI_DEFAULT_API_VERSION = "2024-02-15-preview"

# OpenAI embedding model + dimensionality. The mock provider mirrors this
# dimension so the pgvector column width is identical across modes.
OPENAI_EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536

# Azure config resolved from the environment at import time (mirrors the other
# provider settings). The chat deployment defaults to the "5.4 mini" deployment;
# the embedding deployment is optional (falls through to mock when unset).
AZURE_OPENAI_ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT") or None
AZURE_OPENAI_API_KEY = os.environ.get("AZURE_OPENAI_API_KEY") or None
AZURE_OPENAI_API_VERSION = (
    os.environ.get("AZURE_OPENAI_API_VERSION") or AZURE_OPENAI_DEFAULT_API_VERSION
)
AZURE_OPENAI_DEPLOYMENT = (
    os.environ.get("AZURE_OPENAI_DEPLOYMENT") or AZURE_OPENAI_DEFAULT_DEPLOYMENT
)
AZURE_OPENAI_EMBEDDING_DEPLOYMENT = (
    os.environ.get("AZURE_OPENAI_EMBEDDING_DEPLOYMENT") or None
)

# Vector index tuning.
IVFFLAT_LISTS = 100
DEFAULT_TOP_K = 6

# Map-reduce chunking thresholds (approximate characters, ~4 chars/token).
MAX_CHARS_PER_CHUNK = 48_000

# Request timeout for provider calls (seconds).
PROVIDER_TIMEOUT = 60.0


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    """Immutable snapshot of environment-derived settings."""

    anthropic_api_key: str | None
    openai_api_key: str | None
    azure_openai_endpoint: str | None
    azure_openai_api_key: str | None
    azure_openai_api_version: str
    azure_openai_deployment: str
    azure_openai_embedding_deployment: str | None
    provider_order: list[str]
    database_url: str | None
    mode: str = field(default="mock")
    port: int = 8100

    @property
    def azure_configured(self) -> bool:
        return bool(self.azure_openai_endpoint and self.azure_openai_api_key)

    @property
    def has_any_key(self) -> bool:
        return bool(
            self.anthropic_api_key or self.openai_api_key or self.azure_configured
        )

    @property
    def is_mock(self) -> bool:
        return self.mode == "mock"


def load_settings() -> Settings:
    """Build a :class:`Settings` instance from the current environment."""

    anthropic_key = os.environ.get("ANTHROPIC_API_KEY") or None
    openai_key = os.environ.get("OPENAI_API_KEY") or None
    azure_endpoint = AZURE_OPENAI_ENDPOINT
    azure_key = AZURE_OPENAI_API_KEY
    order = _split_csv(
        os.environ.get("AI_PROVIDER_ORDER", "azure,anthropic,openai")
    )
    database_url = os.environ.get("DATABASE_URL") or None

    requested_mode = os.environ.get("AI_MODE", "").strip().lower()
    azure_configured = bool(azure_endpoint and azure_key)
    has_key = bool(anthropic_key or openai_key or azure_configured)
    if requested_mode in {"mock", "live"}:
        mode = requested_mode
    else:
        # Auto-detect: mock unless at least one key is present.
        mode = "live" if has_key else "mock"

    # A live mode request without any key cannot be honored; degrade to mock
    # so the service still boots and serves structured mock responses.
    if mode == "live" and not has_key:
        mode = "mock"

    port = int(os.environ.get("AI_SERVICE_PORT", "8100"))

    return Settings(
        anthropic_api_key=anthropic_key,
        openai_api_key=openai_key,
        azure_openai_endpoint=azure_endpoint,
        azure_openai_api_key=azure_key,
        azure_openai_api_version=AZURE_OPENAI_API_VERSION,
        azure_openai_deployment=AZURE_OPENAI_DEPLOYMENT,
        azure_openai_embedding_deployment=AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
        provider_order=order or ["azure", "anthropic", "openai"],
        database_url=database_url,
        mode=mode,
        port=port,
    )


settings = load_settings()
