"""Fernet encryption for calendar OAuth tokens at rest.

Tokens are encrypted before they touch the database and decrypted only when
the poller / refresh flow needs them. The key comes from
``settings.CALENDAR_TOKEN_KEY`` (env ``CALENDAR_TOKEN_KEY``); never hardcode a
real key. If unset, an ephemeral key is generated at process start so dev still
boots — tokens won't survive a restart, which is acceptable for local dev and
loudly warned about.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from shared.config import settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    key = settings.CALENDAR_TOKEN_KEY
    if not key:
        key = Fernet.generate_key().decode("utf-8")
        logger.warning(
            "CALENDAR_TOKEN_KEY is unset; generated an ephemeral key. "
            "Calendar tokens will NOT survive a restart. Set CALENDAR_TOKEN_KEY "
            "in production."
        )
    if isinstance(key, str):
        key = key.encode("utf-8")
    return Fernet(key)


def encrypt_token(plaintext: Optional[str]) -> Optional[str]:
    """Encrypt a token. ``None``/empty passes through unchanged."""
    if not plaintext:
        return None
    return _fernet().encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_token(ciphertext: Optional[str]) -> Optional[str]:
    """Decrypt a token. Returns ``None`` on empty input or undecryptable data.

    An ``InvalidToken`` (wrong/rotated key, corrupt data) is swallowed and
    logged rather than raised, so a single bad row can't crash the poller.
    """
    if not ciphertext:
        return None
    try:
        return _fernet().decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except (InvalidToken, ValueError) as exc:
        logger.warning("Failed to decrypt calendar token: %s", exc)
        return None
