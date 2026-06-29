"""Role-based access control for workspace routes.

`role_satisfies` is a pure rank check; `require_role` is a FastAPI dependency
factory that 403s when the current member's role is below the requirement.
Role hierarchy: owner > admin > member.
"""

from __future__ import annotations

from typing import Optional

from fastapi import Depends

from .deps import AuthContext, get_current_context
from .errors import ApiError

ROLE_RANK = {"member": 1, "admin": 2, "owner": 3}


def role_satisfies(role: Optional[str], required: str) -> bool:
    """True if ``role`` is at least as privileged as ``required``."""
    return ROLE_RANK.get(role or "", 0) >= ROLE_RANK.get(required, 99)


def require_role(required: str):
    """Dependency that enforces a minimum workspace role."""

    async def _dep(ctx: AuthContext = Depends(get_current_context)) -> AuthContext:
        if not role_satisfies(ctx.workspace.role, required):
            raise ApiError(
                403,
                "insufficient_role",
                f"This action requires the '{required}' role or higher.",
            )
        return ctx

    return _dep
