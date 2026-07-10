"""Pure helpers: derive a rate-limit key + tier from request attributes.

Keying precedence: API key → bearer token → client IP. Secrets are hashed
before use as a dict key so they never sit in memory in cleartext or leak via
diagnostics. Public/unauthenticated routes get a stricter tier.
"""

from __future__ import annotations

import hashlib
from typing import Optional

PUBLIC_PREFIX = "/api/v1/public"

# Brute-force- and enumeration-sensitive auth endpoints: login (credential
# guessing), the password-reset request/confirm pair (token guessing), and
# signup (email-enumeration via its 409 "email_taken" response). Kept as an
# explicit set rather than a prefix match so unrelated /auth/* routes (me,
# logout) keep the default tier.
_STRICT_AUTH_PATHS = {
    "/api/v1/auth/login",
    "/api/v1/auth/signup",
    "/api/v1/auth/forgot-password",
    "/api/v1/auth/reset-password",
}


def _short_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:32]


def principal_key(
    *,
    api_key: Optional[str],
    authorization: Optional[str],
    client_host: Optional[str],
    workspace_scope: Optional[str] = None,
) -> str:
    """Stable per-principal bucket key.

    ``workspace_scope`` (e.g. the workspace owning a public share token)
    scopes the IP-fallback bucket so anonymous viewers of two different
    workspaces' share links behind the same NAT/corporate-proxy IP don't
    collide into the same bucket. Ignored when a key/bearer principal is
    present since those are already precisely scoped.
    """
    if api_key:
        return "key:" + _short_hash(api_key)
    if authorization:
        parts = authorization.split(" ", 1)
        if len(parts) == 2 and parts[0].lower() == "bearer" and parts[1].strip():
            return "user:" + _short_hash(parts[1].strip())
    if workspace_scope:
        return "ip:" + workspace_scope + ":" + (client_host or "unknown")
    return "ip:" + (client_host or "unknown")


def tier_for_path(path: str) -> str:
    """``public`` for the unauthenticated share surface, ``auth`` for
    brute-force-sensitive credential/token endpoints, else ``default``."""
    if path.startswith(PUBLIC_PREFIX):
        return "public"
    if path in _STRICT_AUTH_PATHS:
        return "auth"
    return "default"
