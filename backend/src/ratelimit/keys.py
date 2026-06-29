"""Pure helpers: derive a rate-limit key + tier from request attributes.

Keying precedence: API key → bearer token → client IP. Secrets are hashed
before use as a dict key so they never sit in memory in cleartext or leak via
diagnostics. Public/unauthenticated routes get a stricter tier.
"""

from __future__ import annotations

import hashlib
from typing import Optional

PUBLIC_PREFIX = "/api/v1/public"


def _short_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:32]


def principal_key(
    *,
    api_key: Optional[str],
    authorization: Optional[str],
    client_host: Optional[str],
) -> str:
    """Stable per-principal bucket key."""
    if api_key:
        return "key:" + _short_hash(api_key)
    if authorization:
        parts = authorization.split(" ", 1)
        if len(parts) == 2 and parts[0].lower() == "bearer" and parts[1].strip():
            return "user:" + _short_hash(parts[1].strip())
    return "ip:" + (client_host or "unknown")


def tier_for_path(path: str) -> str:
    """``public`` for the unauthenticated share surface, else ``default``."""
    return "public" if path.startswith(PUBLIC_PREFIX) else "default"
