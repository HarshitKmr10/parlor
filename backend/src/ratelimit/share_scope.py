"""Resolve a public share token to its owning workspace_id, so the rate-limit
key for the unauthenticated share-link surface can be workspace-scoped.

Why: the IP-fallback rate-limit key is otherwise just ``"ip:" + client_host``.
Two different workspaces' anonymous share-link viewers sitting behind the same
NAT/corporate-proxy IP would collide into the same bucket, letting one
workspace's heavily-used (or abused) public share link starve an unrelated
workspace's viewers.

A short-TTL in-memory cache avoids a DB hit on every request. Resolution is
best-effort and fails open: any error (bad token, DB unavailable, etc.) falls
back to ``None`` so the caller uses the plain IP-only key rather than blocking
the request.
"""

from __future__ import annotations

import re
import time
from typing import Optional

_SHARE_PATH_RE = re.compile(r"^/api/v1/public/shares/([^/]+)/?$")
_CACHE_TTL_S = 60.0

# token -> (expires_at_monotonic, workspace_id_or_None)
_cache: dict[str, tuple[float, Optional[str]]] = {}


def share_token_from_path(path: str) -> Optional[str]:
    """Extract the share token from a public share-link path, if it matches."""
    match = _SHARE_PATH_RE.match(path)
    return match.group(1) if match else None


async def resolve_share_workspace_id(token: str) -> Optional[str]:
    """Best-effort resolve ``token`` to its owning workspace_id.

    Returns ``None`` (fail open) for unknown tokens or on any lookup error so
    the rate-limit middleware can fall back to the IP-only key instead of
    blocking the request.
    """
    now = time.monotonic()
    cached = _cache.get(token)
    if cached is not None and cached[0] > now:
        return cached[1]

    workspace_id: Optional[str] = None
    try:
        from ..api.database.connection import get_db_connection  # noqa: PLC0415
        from ..sharing import SharesRepo  # noqa: PLC0415

        db = await get_db_connection()
        share = await SharesRepo(db).get_by_token(token)
        if share is not None and share.get("workspace_id") is not None:
            workspace_id = str(share["workspace_id"])
    except Exception:  # noqa: BLE001 -- fail open, never block on rate-limit scoping
        workspace_id = None

    _cache[token] = (now + _CACHE_TTL_S, workspace_id)
    return workspace_id


def clear_cache() -> None:
    """Test helper: reset the in-memory TTL cache between test cases."""
    _cache.clear()
