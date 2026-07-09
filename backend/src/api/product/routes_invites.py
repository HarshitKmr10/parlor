"""Workspace invite endpoints.

  POST   /api/v1/workspaces/{workspace_id}/invites             owner/admin-only, creates + emails an invite
  GET    /api/v1/workspaces/{workspace_id}/invites             owner/admin-only, lists pending invites
  DELETE /api/v1/workspaces/{workspace_id}/invites/{invite_id} owner/admin-only, revokes
  GET    /api/v1/invites/{token}                                public, preview (workspace name, email, role)
  POST   /api/v1/invites/{token}/accept                         public, accepts — joins the EXISTING workspace
                                                                 instead of auto-provisioning a new one

An invited email that has no account yet is created inline (name + password
required); an invited email that already has an account only needs to accept
while authenticated as that user (no body required).
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

import jwt
from fastapi import APIRouter, Depends, Header, Path

from ...integrations.email_provider import send_plain_email
from ...observability import get_logger
from .deps import AuthRepository, get_current_user, get_repo
from .errors import ApiError
from .routes_auth import _issue_tokens, _require_workspace_member
from .schemas import (
    InviteAcceptRequest,
    InviteAcceptResponse,
    InvitePreview,
    User,
    Workspace,
    WorkspaceInvite,
    WorkspaceInviteCreated,
    WorkspaceInviteCreateRequest,
    WorkspaceInviteListResponse,
)
from .security import (
    decode_access_token,
    generate_invite_token,
    hash_password,
    hash_token,
    invite_token_expiry,
)

logger = get_logger(__name__)

router = APIRouter(prefix="/api/v1", tags=["invites"])


def _is_expired(expires_at: datetime) -> bool:
    now = datetime.now(timezone.utc)
    expires = expires_at if expires_at.tzinfo else expires_at.replace(tzinfo=timezone.utc)
    return expires <= now


@router.post(
    "/workspaces/{workspace_id}/invites",
    response_model=WorkspaceInviteCreated,
    status_code=201,
    summary="Invite a teammate to a workspace",
    description=(
        "Creates a pending invite and emails an accept link (valid 7 days). "
        "Owner/admin only. Email delivery failure is logged but doesn't "
        "fail the request — the invite record and `acceptUrl` are still "
        "returned."
    ),
)
async def create_invite(
    body: WorkspaceInviteCreateRequest,
    workspace_id: str = Path(...),
    repo: AuthRepository = Depends(get_repo),
    user: User = Depends(get_current_user),
) -> WorkspaceInviteCreated:
    role = await _require_workspace_member(workspace_id, repo, user)
    if role not in ("owner", "admin"):
        raise ApiError(403, "forbidden", "Only owners or admins can invite teammates")

    token = generate_invite_token()
    row = await repo.create_invite(
        workspace_id=workspace_id,
        email=str(body.email),
        role=body.role,
        invited_by_user_id=user.id,
        token_hash=hash_token(token),
        expires_at=invite_token_expiry(),
    )

    base = (os.getenv("PUBLIC_APP_URL") or "").rstrip("/")
    accept_path = f"/invite/{token}"
    accept_url = f"{base}{accept_path}" if base else accept_path
    sent = await send_plain_email(
        to=str(body.email),
        subject="You've been invited to a Parlor workspace",
        body=(
            f"{user.name} invited you to join their team on Parlor.\n\n"
            f"Accept the invite within 7 days:\n\n{accept_url}\n\n"
            "If you weren't expecting this, you can safely ignore this email."
        ),
    )
    if not sent:
        logger.warning("invites.email_failed", workspace_id=workspace_id)

    return WorkspaceInviteCreated(**row, accept_url=accept_url)


@router.get(
    "/workspaces/{workspace_id}/invites",
    response_model=WorkspaceInviteListResponse,
    summary="List pending workspace invites",
    description="Returns pending invites for the workspace. Owner/admin only.",
)
async def list_invites(
    workspace_id: str = Path(...),
    repo: AuthRepository = Depends(get_repo),
    user: User = Depends(get_current_user),
) -> WorkspaceInviteListResponse:
    role = await _require_workspace_member(workspace_id, repo, user)
    if role not in ("owner", "admin"):
        raise ApiError(403, "forbidden", "Only owners or admins can view invites")
    rows = await repo.list_invites(workspace_id)
    items = [WorkspaceInvite.model_validate(r) for r in rows]
    return WorkspaceInviteListResponse(items=items, total=len(items))


@router.delete(
    "/workspaces/{workspace_id}/invites/{invite_id}",
    status_code=204,
    summary="Revoke a workspace invite",
    description="Revokes a pending invite so its token stops working. Owner/admin only. 404 if not found or already resolved.",
)
async def revoke_invite(
    workspace_id: str = Path(...),
    invite_id: str = Path(...),
    repo: AuthRepository = Depends(get_repo),
    user: User = Depends(get_current_user),
) -> None:
    role = await _require_workspace_member(workspace_id, repo, user)
    if role not in ("owner", "admin"):
        raise ApiError(403, "forbidden", "Only owners or admins can revoke invites")
    revoked = await repo.revoke_invite(workspace_id=workspace_id, invite_id=invite_id)
    if not revoked:
        raise ApiError(404, "not_found", "Invite not found or already resolved")


@router.get(
    "/invites/{token}",
    response_model=InvitePreview,
    summary="Preview an invite",
    description=(
        "Public, unauthenticated preview of a pending invite — workspace "
        "name, invited email, and role — plus whether the invited email "
        "already has an account (`requiresSignup`). 404 if the invite is "
        "invalid, expired, or already used."
    ),
)
async def preview_invite(
    token: str = Path(...), repo: AuthRepository = Depends(get_repo)
) -> InvitePreview:
    invite = await repo.get_invite_by_token_hash(hash_token(token))
    if not invite or invite["status"] != "pending" or _is_expired(invite["expires_at"]):
        raise ApiError(
            404, "invite_not_found", "This invite is invalid, expired, or already used"
        )
    workspace = await repo.get_workspace_by_id(str(invite["workspace_id"]))
    workspace_name = workspace["name"] if workspace else ""
    existing = await repo.get_user_by_email(invite["email"])
    return InvitePreview(
        workspace_name=workspace_name,
        email=invite["email"],
        role=invite["role"],
        requires_signup=existing is None,
    )


def _bearer_email(authorization: str | None) -> str | None:
    """Best-effort email of the caller's bearer token, or ``None``.

    Never raises: an absent/expired/malformed token just means "not logged
    in", which is a valid state for this public endpoint.
    """
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    try:
        payload = decode_access_token(parts[1].strip())
    except jwt.PyJWTError:
        return None
    return payload.get("email")


@router.post(
    "/invites/{token}/accept",
    response_model=InviteAcceptResponse,
    summary="Accept an invite",
    description=(
        "Joins the invited email into the EXISTING workspace (never auto-"
        "provisions a new one). If the email has no account yet, `name` "
        "and `password` in the body create one inline. If an account "
        "already exists, the caller must be authenticated as that exact "
        "email (401 `login_required` otherwise, no body needed). Returns "
        "fresh session tokens."
    ),
)
async def accept_invite(
    body: InviteAcceptRequest,
    token: str = Path(...),
    authorization: str | None = Header(None),
    repo: AuthRepository = Depends(get_repo),
) -> InviteAcceptResponse:
    invite = await repo.get_invite_by_token_hash(hash_token(token))
    if not invite or invite["status"] != "pending" or _is_expired(invite["expires_at"]):
        raise ApiError(
            404, "invite_not_found", "This invite is invalid, expired, or already used"
        )

    workspace_id = str(invite["workspace_id"])
    email = invite["email"]
    role = invite["role"]

    existing = await repo.get_user_by_email(email)
    if existing:
        # An account with this email already exists: accepting on its behalf
        # requires proving ownership via a valid session for that exact
        # email, not just knowledge of the (mailed) invite token.
        caller_email = _bearer_email(authorization)
        if not caller_email or caller_email.lower() != email.lower():
            raise ApiError(
                401,
                "login_required",
                "Sign in with the invited email to accept this invite",
            )
        user = User.model_validate(existing)
    else:
        if not body.name or not body.password:
            raise ApiError(
                400,
                "signup_required",
                "A name and password are required to accept this invite",
            )
        user_row = await repo.create_user(
            email=email, name=body.name, password_hash=hash_password(body.password)
        )
        user = User.model_validate(user_row)

    await repo.add_member(workspace_id=workspace_id, user_id=user.id, role=role)
    await repo.mark_invite_accepted(str(invite["id"]))

    membership = await repo.get_membership(workspace_id=workspace_id, user_id=user.id)
    assert membership is not None
    workspace = Workspace.model_validate(membership)

    access, refresh = await _issue_tokens(repo, user)
    return InviteAcceptResponse(
        user=user, workspace=workspace, access_token=access, refresh_token=refresh
    )
