"""/api/v1/auth/* and /api/v1/workspaces/{id}/api-keys routers."""

from __future__ import annotations

import os
import re
import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Path, Response, status

from ...integrations.email_provider import send_plain_email
from ...observability import get_logger
from .deps import (
    AuthContext,
    AuthRepository,
    get_current_context,
    get_current_user,
    get_repo,
)
from .errors import ApiError
from .schemas import (
    ApiKey,
    ApiKeyCreated,
    ApiKeyCreateRequest,
    ForgotPasswordRequest,
    LoginRequest,
    LoginResponse,
    MeResponse,
    RefreshRequest,
    ResetPasswordRequest,
    SignupRequest,
    SignupResponse,
    TokenPairResponse,
    User,
    Workspace,
)
from .security import (
    create_access_token,
    generate_api_key,
    generate_password_reset_token,
    generate_refresh_token,
    hash_password,
    hash_token,
    password_reset_token_expiry,
    refresh_token_expiry,
    verify_password,
)

logger = get_logger(__name__)

auth_router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
workspaces_router = APIRouter(prefix="/api/v1/workspaces", tags=["workspaces"])

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _slugify(name: str) -> str:
    base = _SLUG_RE.sub("-", name.strip().lower()).strip("-")
    return base or "workspace"


async def _unique_slug(repo: AuthRepository, name: str) -> str:
    base = _slugify(name)
    slug = base
    # Append a short random suffix on collision rather than counting, to avoid
    # a race-prone read-then-write loop.
    for _ in range(5):
        if not await repo.slug_exists(slug):
            return slug
        slug = f"{base}-{secrets.token_hex(2)}"
    return f"{base}-{secrets.token_hex(4)}"


async def _issue_tokens(
    repo: AuthRepository, user: User, *, family_id: str | None = None
) -> tuple[str, str]:
    access = create_access_token(user_id=user.id, email=user.email)
    refresh = generate_refresh_token()
    await repo.store_refresh_token(
        user_id=user.id,
        token_hash=hash_token(refresh),
        expires_at=refresh_token_expiry(),
        family_id=family_id or str(uuid.uuid4()),
    )
    return access, refresh


@auth_router.post(
    "/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED
)
async def signup(
    body: SignupRequest, repo: AuthRepository = Depends(get_repo)
) -> SignupResponse:
    if await repo.get_user_by_email(body.email):
        raise ApiError(409, "email_taken", "An account with this email exists")

    user_row = await repo.create_user(
        email=str(body.email),
        name=body.name,
        password_hash=hash_password(body.password),
    )
    user = User.model_validate(user_row)

    slug = await _unique_slug(repo, body.workspace_name)
    ws_row = await repo.create_workspace(name=body.workspace_name, slug=slug)
    await repo.add_member(
        workspace_id=str(ws_row["id"]), user_id=user.id, role="owner"
    )
    workspace = Workspace(
        id=str(ws_row["id"]),
        name=ws_row["name"],
        slug=ws_row["slug"],
        role="owner",
    )

    access, refresh = await _issue_tokens(repo, user)
    return SignupResponse(
        user=user,
        workspace=workspace,
        access_token=access,
        refresh_token=refresh,
    )


@auth_router.post("/login", response_model=LoginResponse)
async def login(
    body: LoginRequest, repo: AuthRepository = Depends(get_repo)
) -> LoginResponse:
    row = await repo.get_user_by_email(body.email)
    if not row or not verify_password(body.password, row["password_hash"]):
        raise ApiError(401, "invalid_credentials", "Incorrect email or password")
    user = User.model_validate(row)
    access, refresh = await _issue_tokens(repo, user)
    return LoginResponse(user=user, access_token=access, refresh_token=refresh)


@auth_router.post("/refresh", response_model=TokenPairResponse)
async def refresh(
    body: RefreshRequest, repo: AuthRepository = Depends(get_repo)
) -> TokenPairResponse:
    token_hash = hash_token(body.refresh_token)
    record = await repo.get_refresh_token_by_hash(token_hash)
    if not record:
        raise ApiError(401, "invalid_refresh_token", "Refresh token is invalid or expired")

    if record["revoked_at"] is not None:
        # Replay of an already-rotated token: treat as theft and kill every
        # token descended from the same original login, not just this one.
        await repo.revoke_refresh_token_family(str(record["family_id"]))
        raise ApiError(401, "invalid_refresh_token", "Refresh token is invalid or expired")

    expires_at = record["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= datetime.now(timezone.utc):
        raise ApiError(401, "invalid_refresh_token", "Refresh token is invalid or expired")

    user_row = await repo.get_user_by_id(str(record["user_id"]))
    if not user_row:
        raise ApiError(401, "invalid_refresh_token", "User no longer exists")

    # Rotate: revoke the presented token and issue a fresh pair in the same family.
    await repo.revoke_refresh_token(token_hash)
    user = User.model_validate(user_row)
    access, new_refresh = await _issue_tokens(
        repo, user, family_id=str(record["family_id"])
    )
    return TokenPairResponse(access_token=access, refresh_token=new_refresh)


@auth_router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    body: RefreshRequest, repo: AuthRepository = Depends(get_repo)
) -> Response:
    # Best-effort revoke of the presented refresh token; logout is idempotent.
    await repo.revoke_refresh_token(hash_token(body.refresh_token))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@auth_router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(
    body: ForgotPasswordRequest, repo: AuthRepository = Depends(get_repo)
) -> dict:
    # Always return 200 regardless of whether the email exists, so this
    # endpoint never leaks account existence to a caller.
    row = await repo.get_user_by_email(body.email)
    if row:
        user = User.model_validate(row)
        token = generate_password_reset_token()
        await repo.store_password_reset_token(
            user_id=user.id,
            token_hash=hash_token(token),
            expires_at=password_reset_token_expiry(),
        )
        base = (os.getenv("PUBLIC_APP_URL") or "").rstrip("/")
        link = f"{base}/reset-password?token={token}" if base else f"/reset-password?token={token}"
        sent = await send_plain_email(
            to=user.email,
            subject="Reset your Parlor password",
            body=(
                f"Hi {user.name},\n\n"
                "We received a request to reset your Parlor password. "
                f"Use the link below within 30 minutes:\n\n{link}\n\n"
                "If you didn't request this, you can safely ignore this email."
            ),
        )
        if not sent:
            logger.warning("auth.forgot_password.email_failed", user_id=user.id)
    return {"message": "If that email exists, we sent a password reset link."}


@auth_router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(
    body: ResetPasswordRequest, repo: AuthRepository = Depends(get_repo)
) -> dict:
    token_hash = hash_token(body.token)
    record = await repo.get_active_password_reset_token(token_hash)
    if not record:
        raise ApiError(
            400, "invalid_reset_token", "This reset link is invalid or has expired"
        )

    user_id = str(record["user_id"])
    await repo.update_password_hash(
        user_id=user_id, password_hash=hash_password(body.new_password)
    )
    await repo.mark_password_reset_token_used(token_hash)
    # A password reset is a strong signal of compromise-or-recovery; kill
    # every existing session so a stolen access/refresh token pair stops
    # working immediately.
    await repo.revoke_all_refresh_tokens(user_id)
    return {"message": "Password has been reset. Please sign in again."}


@auth_router.get("/me", response_model=MeResponse)
async def me(
    ctx: AuthContext = Depends(get_current_context),
    repo: AuthRepository = Depends(get_repo),
) -> MeResponse:
    # /me is only meaningful for the JWT (user) credential path.
    if ctx.user is None:
        raise ApiError(400, "user_required", "This endpoint requires a user token")
    rows = await repo.list_workspaces_for_user(ctx.user.id)
    workspaces = [Workspace.model_validate(r) for r in rows]
    current = next((w for w in workspaces if w.id == ctx.workspace.id), None)
    return MeResponse(
        user=ctx.user, workspaces=workspaces, current_workspace=current
    )


# ── API keys ─────────────────────────────────────────────────────────────
async def _require_workspace_member(
    workspace_id: str, repo: AuthRepository, user: User
) -> str:
    membership = await repo.get_membership(
        workspace_id=workspace_id, user_id=user.id
    )
    if not membership:
        raise ApiError(403, "forbidden", "You are not a member of this workspace")
    return membership["role"]


@workspaces_router.get(
    "/{workspace_id}/api-keys", response_model=list[ApiKey]
)
async def list_api_keys(
    workspace_id: str = Path(...),
    repo: AuthRepository = Depends(get_repo),
    user: User = Depends(get_current_user),
) -> list[ApiKey]:
    await _require_workspace_member(workspace_id, repo, user)
    rows = await repo.list_api_keys(workspace_id)
    return [ApiKey.model_validate(r) for r in rows]


@workspaces_router.post(
    "/{workspace_id}/api-keys",
    response_model=ApiKeyCreated,
    status_code=status.HTTP_201_CREATED,
)
async def create_api_key(
    body: ApiKeyCreateRequest,
    workspace_id: str = Path(...),
    repo: AuthRepository = Depends(get_repo),
    user: User = Depends(get_current_user),
) -> ApiKeyCreated:
    role = await _require_workspace_member(workspace_id, repo, user)
    if role not in ("owner", "admin"):
        raise ApiError(403, "forbidden", "Only owners or admins can create API keys")
    full_key, prefix, key_hash = generate_api_key()
    row = await repo.create_api_key(
        workspace_id=workspace_id, name=body.name, key_hash=key_hash, prefix=prefix
    )
    return ApiKeyCreated(**{**row, "key": full_key})


@workspaces_router.delete(
    "/{workspace_id}/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_api_key(
    workspace_id: str = Path(...),
    key_id: str = Path(...),
    repo: AuthRepository = Depends(get_repo),
    user: User = Depends(get_current_user),
) -> Response:
    role = await _require_workspace_member(workspace_id, repo, user)
    if role not in ("owner", "admin"):
        raise ApiError(403, "forbidden", "Only owners or admins can delete API keys")
    deleted = await repo.delete_api_key(workspace_id=workspace_id, key_id=key_id)
    if not deleted:
        raise ApiError(404, "not_found", "API key not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
