"""/api/v1/calendar/* — connect Google/Microsoft calendars, manage auto-join.

OAuth flow:
* ``GET /connect/{provider}`` (auth required) → 302 to the provider's consent
  screen. The active workspace + user are packed into a short-lived signed
  ``state`` token (reusing the product JWT secret) because the OAuth redirect
  can't carry the Authorization / X-Workspace-Id headers.
* ``GET /callback/{provider}`` (no auth header; trust comes from ``state``) →
  exchange code, fetch the account email, encrypt + upsert tokens.

If a provider's client id/secret is unset, ``connect`` returns 501
``calendar_provider_not_configured`` so dev boots without OAuth creds.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List, Optional

import httpx
import jwt
from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse

from shared.config import settings

from ..database.connection import DatabaseConnection
from . import calendar_oauth
from .calendar_repo import CalendarRepo
from .deps import AuthContext, get_current_context, get_current_workspace, get_db
from .errors import ApiError
from .schemas import CalendarAccount, CalendarAccountUpdate, Workspace

router = APIRouter(prefix="/api/v1/calendar", tags=["calendar"])

UTC = timezone.utc
_STATE_TTL_SECONDS = 600  # OAuth round-trip should complete well within 10 min.


async def _repo(db: DatabaseConnection = Depends(get_db)) -> CalendarRepo:
    return CalendarRepo(db)


def _encode_state(workspace_id: str, user_id: Optional[str]) -> str:
    payload = {
        "ws": workspace_id,
        "uid": user_id,
        "exp": datetime.now(UTC) + timedelta(seconds=_STATE_TTL_SECONDS),
        "typ": "calendar_oauth_state",
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def _decode_state(state: str) -> dict:
    try:
        payload = jwt.decode(
            state, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
    except jwt.PyJWTError as exc:
        raise ApiError(400, "invalid_oauth_state", f"Invalid OAuth state: {exc}")
    if payload.get("typ") != "calendar_oauth_state":
        raise ApiError(400, "invalid_oauth_state", "Unexpected state token type")
    return payload


def _to_account(row: dict) -> CalendarAccount:
    return CalendarAccount(
        id=str(row["id"]),
        provider=row["provider"],
        email=row["email"],
        auto_join=bool(row["auto_join"]),
        connected_at=row["created_at"],
    )


@router.get(
    "/accounts",
    response_model=List[CalendarAccount],
    summary="List connected calendar accounts",
    description="Returns the workspace's connected Google/Microsoft calendar accounts and their auto-join setting.",
)
async def list_accounts(
    workspace: Workspace = Depends(get_current_workspace),
    repo: CalendarRepo = Depends(_repo),
) -> List[CalendarAccount]:
    rows = await repo.list_for_workspace(workspace.id)
    return [_to_account(r) for r in rows]


@router.get(
    "/connect/{provider}",
    summary="Start calendar OAuth connect flow",
    description=(
        "Redirects (302) to the given provider's ('google' or 'microsoft') "
        "OAuth consent screen, with the workspace + user packed into a "
        "short-lived signed state token. 501 `calendar_provider_not_"
        "configured` if that provider's client id/secret isn't set on this "
        "server."
    ),
)
async def connect(
    provider: str,
    ctx: AuthContext = Depends(get_current_context),
) -> RedirectResponse:
    cfg = calendar_oauth.get_provider(provider)
    if cfg is None:
        raise ApiError(404, "unknown_provider", f"Unknown calendar provider: {provider}")
    if not cfg.configured:
        raise ApiError(
            501,
            "calendar_provider_not_configured",
            f"The {provider} calendar integration is not configured on this server.",
        )
    state = _encode_state(ctx.workspace.id, ctx.user.id if ctx.user else None)
    url = calendar_oauth.build_authorize_url(cfg, state=state)
    return RedirectResponse(url, status_code=302)


@router.get(
    "/callback/{provider}",
    summary="Calendar OAuth callback",
    description=(
        "Provider redirects here after consent. No auth header — trust "
        "comes from the signed `state` param, which carries the workspace "
        "and user id. Exchanges the code for tokens, fetches the account "
        "email, and encrypts + upserts the connected account."
    ),
)
async def callback(
    provider: str,
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    repo: CalendarRepo = Depends(_repo),
):
    if error:
        raise ApiError(400, "oauth_denied", f"Authorization failed: {error}")
    if not code or not state:
        raise ApiError(400, "oauth_missing_params", "Missing code or state")

    cfg = calendar_oauth.get_provider(provider)
    if cfg is None:
        raise ApiError(404, "unknown_provider", f"Unknown calendar provider: {provider}")
    if not cfg.configured:
        raise ApiError(
            501,
            "calendar_provider_not_configured",
            f"The {provider} calendar integration is not configured on this server.",
        )

    decoded = _decode_state(state)
    workspace_id = decoded.get("ws")
    user_id = decoded.get("uid")
    if not workspace_id:
        raise ApiError(400, "invalid_oauth_state", "State missing workspace")

    try:
        tokens = await calendar_oauth.exchange_code(cfg, code)
    except httpx.HTTPError as exc:
        raise ApiError(
            502, "oauth_exchange_failed", f"Token exchange failed: {exc}"
        )

    email = None
    if tokens.access_token:
        try:
            email = await calendar_oauth.fetch_email(cfg, tokens.access_token)
        except httpx.HTTPError:
            email = None
    if not email:
        email = f"unknown@{provider}"

    row = await repo.upsert(
        workspace_id=workspace_id,
        user_id=user_id,
        provider=provider,
        email=email,
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        expires_in=tokens.expires_in,
    )
    return _to_account(row)


@router.patch(
    "/accounts/{account_id}",
    response_model=CalendarAccount,
    summary="Update a calendar account",
    description="Toggles auto-join for a connected calendar account. When on, the poller auto-dispatches a bot for its upcoming meetings.",
)
async def update_account(
    account_id: str,
    body: CalendarAccountUpdate,
    workspace: Workspace = Depends(get_current_workspace),
    repo: CalendarRepo = Depends(_repo),
) -> CalendarAccount:
    existing = await repo.get_scoped(account_id, workspace.id)
    if existing is None:
        raise ApiError(404, "not_found", "Calendar account not found in this workspace")
    row = await repo.set_auto_join(account_id, workspace.id, body.auto_join)
    if row is None:
        raise ApiError(404, "not_found", "Calendar account not found")
    return _to_account(row)
