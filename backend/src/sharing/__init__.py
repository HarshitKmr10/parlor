"""Public shareable meeting pages.

A capability-URL token grants read-only public access to one meeting's recap,
gated by per-share scope flags. Owners create/rotate/revoke; anyone with the
token can view (no auth) until it's revoked or expires.

Public surface:
* :func:`generate_share_token` — 256-bit URL-safe token.
* :func:`is_share_active` — pure revoked/expiry check.
* :class:`SharesRepo` — workspace-scoped persistence + public-by-token lookup.
"""

from __future__ import annotations

from .repo import SharesRepo
from .tokens import check_passcode, generate_share_token, is_share_active

__all__ = [
    "SharesRepo",
    "check_passcode",
    "generate_share_token",
    "is_share_active",
]
