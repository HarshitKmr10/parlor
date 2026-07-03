"""Configuration loading for the capture client.

Resolution order (highest priority first):
1. Explicit CLI flags (passed into :func:`load_config`).
2. Environment variables (``VERDANT_*``).
3. The ini-style file at ``~/.verdant/config`` (section ``[verdant]``).

No secret is ever hardcoded; credentials only come from env or the config
file, which lives in the user's home directory.
"""

from __future__ import annotations

import configparser
import os
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Optional

from .errors import ConfigError

DEFAULT_API_URL = "http://localhost:8000"
CONFIG_PATH = Path.home() / ".verdant" / "config"
CONFIG_SECTION = "verdant"


@dataclass(frozen=True)
class Config:
    """Resolved client configuration. Immutable; use :meth:`merge` to override."""

    api_url: str = DEFAULT_API_URL
    api_key: Optional[str] = None
    workspace_id: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    # Optional override for the transcript-ingest path on the backend. The
    # public contract does not expose a botless ingest endpoint; if a private
    # one is mounted, point this at it (see README "Transcript ingest").
    ingest_path: Optional[str] = None

    def merge(self, **overrides: Optional[str]) -> "Config":
        """Return a copy with any non-``None`` overrides applied."""
        clean = {k: v for k, v in overrides.items() if v is not None}
        return replace(self, **clean)

    @property
    def has_credentials(self) -> bool:
        return bool(self.api_key) or bool(self.email and self.password)


def _from_file(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    parser = configparser.ConfigParser()
    try:
        parser.read(path)
    except configparser.Error as exc:
        raise ConfigError(f"Could not parse config file {path}: {exc}") from exc
    if not parser.has_section(CONFIG_SECTION):
        return {}
    return dict(parser.items(CONFIG_SECTION))


def _from_env() -> dict[str, Optional[str]]:
    return {
        "api_url": os.environ.get("VERDANT_API_URL"),
        "api_key": os.environ.get("VERDANT_API_KEY"),
        "workspace_id": os.environ.get("VERDANT_WORKSPACE_ID"),
        "email": os.environ.get("VERDANT_EMAIL"),
        "password": os.environ.get("VERDANT_PASSWORD"),
        "ingest_path": os.environ.get("VERDANT_INGEST_PATH"),
    }


def load_config(
    *,
    api_url: Optional[str] = None,
    api_key: Optional[str] = None,
    workspace_id: Optional[str] = None,
    email: Optional[str] = None,
    password: Optional[str] = None,
    ingest_path: Optional[str] = None,
    config_path: Path = CONFIG_PATH,
) -> Config:
    """Build a :class:`Config` from file, env, and explicit flags."""
    file_values = _from_file(config_path)
    env_values = {k: v for k, v in _from_env().items() if v is not None}

    base = Config()
    base = base.merge(**{k: v for k, v in file_values.items() if k in vars(base)})
    base = base.merge(**env_values)
    base = base.merge(
        api_url=api_url,
        api_key=api_key,
        workspace_id=workspace_id,
        email=email,
        password=password,
        ingest_path=ingest_path,
    )
    return base
