"""/api/v1/auth/* and /api/v1/workspaces/{id}/api-keys routers."""

from __future__ import annotations

import re
import secrets

from fastapi import APIRouter, Depends, Path, Response, status

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
    LoginRequest,
    LoginResponse,
    MeResponse,
    RefreshRequest,
    SignupRequest,
    SignupResponse,
    TokenPairResponse,
    User,
    Workspace,
)
from .security import (
    create_access_token,
    generate_api_key,
    generate_refresh_token,
    hash_password,
    hash_token,
    refresh_token_expiry,
    verify_password,
)

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


async def _issue_tokens(repo: AuthRepository, user: User) -> tuple[str, str]:
    access = create_access_token(user_id=user.id, email=user.email)
    refresh = generate_refresh_token()
    await repo.store_refresh_token(
        user_id=user.id,
        token_hash=hash_token(refresh),
        expires_at=refresh_token_expiry(),
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
    record = await repo.get_active_refresh_token(token_hash)
    if not record:
        raise ApiError(401, "invalid_refresh_token", "Refresh token is invalid or expired")

    user_row = await repo.get_user_by_id(str(record["user_id"]))
    if not user_row:
        raise ApiError(401, "invalid_refresh_token", "User no longer exists")

    # Rotate: revoke the presented token and issue a fresh pair.
    await repo.revoke_refresh_token(token_hash)
    user = User.model_validate(user_row)
    access, new_refresh = await _issue_tokens(repo, user)
    return TokenPairResponse(access_token=access, refresh_token=new_refresh)


@auth_router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    body: RefreshRequest, repo: AuthRepository = Depends(get_repo)
) -> Response:
    # Best-effort revoke of the presented refresh token; logout is idempotent.
    await repo.revoke_refresh_token(hash_token(body.refresh_token))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
