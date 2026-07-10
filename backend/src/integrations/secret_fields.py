"""Encrypt-at-rest handling for secret fields embedded in integration config.

Third-party integration config (``workspace_integrations.config``) carries live
credentials — Notion ``token``/``apiKey``, HubSpot ``accessToken``, Salesforce
``accessToken`` + ``refreshToken`` (see ``crm_providers.py``). These are
encrypted with the same Fernet-based pattern already used for calendar OAuth
tokens (``api/product/token_crypto.py``) before they touch the database, and
never returned verbatim on read — mirroring how the Google Workspace
service-account JSON is handled (see ``GoogleWorkspaceConfig`` in
``api/product/schemas.py``: "encrypted at rest and NEVER returned").
"""

from __future__ import annotations

from typing import Any, Dict

from ..api.product.token_crypto import decrypt_token, encrypt_token

#: Config keys (camelCase, plus the legacy snake_case aliases the providers
#: also accept — see ``crm_providers.py``) that hold live third-party
#: credentials and must never be stored or returned in plaintext.
SECRET_FIELD_NAMES: tuple[str, ...] = (
    "token",
    "apiKey",
    "api_key",
    "accessToken",
    "access_token",
    "refreshToken",
    "refresh_token",
)


def encrypt_config_secrets(config: Dict[str, Any]) -> Dict[str, Any]:
    """Return a copy of ``config`` with known secret fields Fernet-encrypted.

    Call this immediately before persisting admin-supplied config.
    """
    out = dict(config or {})
    for field in SECRET_FIELD_NAMES:
        value = out.get(field)
        if isinstance(value, str) and value:
            out[field] = encrypt_token(value)
    return out


def decrypt_config_secrets(config: Dict[str, Any]) -> Dict[str, Any]:
    """Return a copy of ``config`` with known secret fields decrypted.

    Only for the internal delivery path (``deliver_recap`` -> provider
    ``deliver``/``is_configured``) — never for a path that returns config to
    an API client.
    """
    out = dict(config or {})
    for field in SECRET_FIELD_NAMES:
        value = out.get(field)
        if isinstance(value, str) and value:
            out[field] = decrypt_token(value)
    return out


def redact_config_secrets(config: Dict[str, Any]) -> Dict[str, Any]:
    """Return a copy of ``config`` safe to return from an API response.

    Known secret fields (whether plaintext or already-encrypted ciphertext)
    are replaced with a boolean presence marker so a client can render
    "credentials configured" without the secret — or its ciphertext — ever
    being re-serialized.
    """
    out = dict(config or {})
    for field in SECRET_FIELD_NAMES:
        value = out.get(field)
        if isinstance(value, str) and value:
            out[field] = True
    return out
