"""Pure helpers for share tokens and activity checks (no I/O)."""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Optional

# 32 bytes → ~43 url-safe chars → 256 bits of entropy. Not brute-forceable.
_TOKEN_BYTES = 32


def generate_share_token() -> str:
    """Return a cryptographically-random, URL-safe capability token."""
    return secrets.token_urlsafe(_TOKEN_BYTES)


def _as_aware(dt: datetime) -> datetime:
    """Treat naive timestamps (asyncpg without tz) as UTC."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def is_share_active(
    *,
    revoked: bool,
    expires_at: Optional[datetime],
    now: Optional[datetime] = None,
) -> bool:
    """A share is viewable iff it is not revoked and not past its expiry."""
    if revoked:
        return False
    if expires_at is None:
        return True
    now = now or datetime.now(timezone.utc)
    return _as_aware(expires_at) > _as_aware(now)


def check_passcode(
    required: Optional[str], provided: Optional[str]
) -> Optional[str]:
    """Decide whether a share's passcode gate lets a viewer through.

    Returns ``None`` when access is allowed (no passcode set, or the provided
    one matches), ``"passcode_required"`` when one is needed but absent, and
    ``"invalid_passcode"`` when the provided one is wrong. Pure — no I/O."""
    if not required:
        return None
    if not provided:
        return "passcode_required"
    if provided != required:
        return "invalid_passcode"
    return None
