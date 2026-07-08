"""FastAPI dependencies for the product layer: DB, repo, auth, tenancy.

Two credential types are accepted:
- Bearer JWT access token (the web/dashboard path) -> :func:`get_current_user`.
- ``X-API-Key`` workspace API key (the MCP-server path) -> resolves the
  workspace directly, no JWT.

``get_current_workspace`` resolves the active workspace from either an
``X-Workspace-Id`` header (JWT path; membership validated) or the API key's
own workspace.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import jwt
from fastapi import Depends, Header, Request

from ..database.connection import DatabaseConnection, get_db_connection
from .errors import ApiError
from .repository import AuthRepository
from .schemas import User, Workspace
from .security import decode_access_token, hash_token, looks_like_api_key


async def get_db() -> DatabaseConnection:
    return await get_db_connection()


async def get_repo(
    db: DatabaseConnection = Depends(get_db),
) -> AuthRepository:
    return AuthRepository(db)


@dataclass
class AuthContext:
    """Resolved principal for a request.

    Exactly one of ``user`` / ``api_key_id`` is the primary credential, but a
    workspace is always resolved so downstream handlers can scope queries.
    """

    user: Optional[User]
    workspace: Workspace
    via_api_key: bool


def _bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return None


async def get_current_user(
    authorization: Optional[str] = Header(None),
    repo: AuthRepository = Depends(get_repo),
) -> User:
    """Decode the Bearer JWT and load the user. 401 on any failure."""
    token = _bearer_token(authorization)
    if not token:
        raise ApiError(401, "unauthorized", "Missing or malformed Authorization header")
    try:
        payload = decode_access_token(token)
    except jwt.ExpiredSignatureError:
        raise ApiError(401, "token_expired", "Access token has expired")
    except jwt.PyJWTError:
        raise ApiError(401, "invalid_token", "Invalid access token")

    user_id = payload.get("sub")
    if not user_id:
        raise ApiError(401, "invalid_token", "Token missing subject")
    row = await repo.get_user_by_id(user_id)
    if not row:
        raise ApiError(401, "invalid_token", "User no longer exists")
    return User.model_validate(row)


async def get_current_context(
    request: Request,
    authorization: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None),
    x_workspace_id: Optional[str] = Header(None),
    repo: AuthRepository = Depends(get_repo),
) -> AuthContext:
    """Resolve the principal + active workspace from JWT or API key."""
    # API-key path (MCP server): the key alone identifies a workspace.
    if looks_like_api_key(x_api_key):
        record = await repo.get_api_key_by_hash(hash_token(x_api_key))
        if not record:
            raise ApiError(401, "invalid_api_key", "Unknown or revoked API key")
        await repo.touch_api_key(str(record["id"]))
        workspace = Workspace(
            id=str(record["workspace_id"]),
            name="",
            slug="",
            role="member",
        )
        return AuthContext(user=None, workspace=workspace, via_api_key=True)

    # JWT path: a valid user, plus an active workspace. X-Workspace-Id selects
    # it; if absent (e.g. a session whose parlor_ws cookie was never set or
    # expired), default to the user's workspace instead of hard-failing — a
    # single-workspace user must never need to send the header.
    user = await get_current_user(authorization=authorization, repo=repo)
    if not x_workspace_id:
        rows = await repo.list_workspaces_for_user(user.id)
        if not rows:
            raise ApiError(
                400, "no_workspace", "Your account has no workspace"
            )
        workspace = Workspace.model_validate(rows[0])
        return AuthContext(user=user, workspace=workspace, via_api_key=False)
    membership = await repo.get_membership(
        workspace_id=x_workspace_id, user_id=user.id
    )
    if not membership:
        raise ApiError(
            403, "forbidden", "You are not a member of this workspace"
        )
    workspace = Workspace.model_validate(membership)
    return AuthContext(user=user, workspace=workspace, via_api_key=False)


async def get_current_workspace(
    ctx: AuthContext = Depends(get_current_context),
) -> Workspace:
    return ctx.workspace
