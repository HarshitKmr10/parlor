"""Password hashing, JWT issue/verify, and API-key helpers.

No secrets are hardcoded: the JWT signing secret comes from
``settings.JWT_SECRET`` (env ``JWT_SECRET``). Passwords are hashed with argon2
via pwdlib. Refresh tokens and API keys are opaque random strings; only their
SHA-256 digest is persisted.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import jwt
from pwdlib import PasswordHash

from shared.config import settings

_password_hasher = PasswordHash.recommended()

ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"

# API keys are presented as ``mk_<prefix>_<secret>``. The prefix is stored in
# clear for display ("mk_ab12cd"); the full key is hashed.
API_KEY_PUBLIC_PREFIX = "mk"


def hash_password(plain: str) -> str:
    return _password_hasher.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _password_hasher.verify(plain, hashed)
    except Exception:
        # A malformed stored hash must never raise into the auth path; treat
        # it as a failed verification.
        return False


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(*, user_id: str, email: str) -> str:
    expires = _now() + timedelta(minutes=settings.ACCESS_TOKEN_TTL_MINUTES)
    payload = {
        "sub": user_id,
        "email": email,
        "type": ACCESS_TOKEN_TYPE,
        "iat": int(_now().timestamp()),
        "exp": int(expires.timestamp()),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate an access token. Raises ``jwt.PyJWTError`` on failure."""
    payload = jwt.decode(
        token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
    )
    if payload.get("type") != ACCESS_TOKEN_TYPE:
        raise jwt.InvalidTokenError("not an access token")
    return payload


def generate_refresh_token() -> str:
    """Opaque high-entropy refresh token (not a JWT — stored hashed, revocable)."""
    return secrets.token_urlsafe(48)


def generate_password_reset_token() -> str:
    """Opaque high-entropy password-reset token; only its hash is persisted."""
    return secrets.token_urlsafe(32)


def password_reset_token_expiry() -> datetime:
    return _now() + timedelta(minutes=settings.PASSWORD_RESET_TTL_MINUTES)


def generate_invite_token() -> str:
    """Opaque high-entropy workspace-invite token; only its hash is persisted."""
    return secrets.token_urlsafe(32)


def invite_token_expiry() -> datetime:
    return _now() + timedelta(days=settings.INVITE_TTL_DAYS)


def hash_token(token: str) -> str:
    """SHA-256 hex digest used for refresh-token and API-key lookups."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def refresh_token_expiry() -> datetime:
    return _now() + timedelta(days=settings.REFRESH_TOKEN_TTL_DAYS)


def generate_api_key() -> tuple[str, str, str]:
    """Return ``(full_key, prefix, key_hash)``.

    The full key is shown to the caller exactly once; only ``prefix`` (for UI
    display) and ``key_hash`` are persisted.
    """
    public = secrets.token_hex(3)  # 6 hex chars, e.g. "ab12cd"
    secret = secrets.token_urlsafe(32)
    full_key = f"{API_KEY_PUBLIC_PREFIX}_{public}_{secret}"
    prefix = f"{API_KEY_PUBLIC_PREFIX}_{public}"
    return full_key, prefix, hash_token(full_key)


def looks_like_api_key(value: Optional[str]) -> bool:
    return bool(value) and value.startswith(f"{API_KEY_PUBLIC_PREFIX}_")
