"""Pure scoped idempotency-key hashing."""

from __future__ import annotations

import hashlib


def idempotency_key_hash(
    *, principal: str, method: str, path: str, idem_key: str
) -> str:
    """Hash the client key scoped to principal+method+path.

    Scoping by principal stops one tenant's key from colliding with another's,
    and by method+path stops the same key being reused across endpoints.
    """
    raw = f"{principal}\x00{method.upper()}\x00{path}\x00{idem_key}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
