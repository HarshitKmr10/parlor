"""OIDC single sign-on routes.

  GET  /api/v1/auth/sso/status         -> { enabled, provider }
  GET  /api/v1/auth/sso/authorize-url  -> { url }  (signed state embedded)
  POST /api/v1/auth/sso/exchange       -> session  (code + state -> tokens)

The web app orchestrates the browser redirect and owns the httpOnly session
cookies, mirroring the password login flow. Live use requires a configured IdP
(SSO_OIDC_* env). Pure helpers live in src/sso and are unit-tested.
"""

from __future__ import annotations

import secrets

import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from shared.config import settings

from ...sso import (
    build_authorize_url,
    oidc_config_from_env,
    profile_from_userinfo,
    sign_state,
    verify_state,
)
from .errors import ApiError
from .repository import AuthRepository
from .routes_auth import _issue_tokens, _unique_slug, get_repo
from .schemas import SignupResponse, User, Workspace
from .security import hash_password

router = APIRouter(prefix="/api/v1/auth/sso", tags=["sso"])

_TIMEOUT = httpx.Timeout(15.0, connect=5.0)


class SsoStatus(BaseModel):
    enabled: bool
    provider: str | None = None


class SsoAuthorizeUrl(BaseModel):
    url: str


class SsoExchangeRequest(BaseModel):
    code: str
    state: str


async def _fetch_userinfo(config, code: str) -> dict:
    """Exchange the auth code for tokens, then fetch userinfo. Isolated so
    tests can monkeypatch the network."""
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        token_resp = await client.post(
            config.token_url,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": config.redirect_uri,
                "client_id": config.client_id,
                "client_secret": config.client_secret,
            },
            headers={"Accept": "application/json"},
        )
        if token_resp.status_code >= 400:
            raise ApiError(502, "sso_token_error", "Token exchange failed")
        access = token_resp.json().get("access_token")
        if not access:
            raise ApiError(502, "sso_token_error", "No access token from IdP")
        ui = await client.get(
            config.userinfo_url, headers={"Authorization": f"Bearer {access}"}
        )
        if ui.status_code >= 400:
            raise ApiError(502, "sso_userinfo_error", "Failed to fetch userinfo")
        return ui.json()


@router.get("/status", response_model=SsoStatus)
async def sso_status() -> SsoStatus:
    config = oidc_config_from_env()
    return SsoStatus(enabled=config is not None, provider=config.provider if config else None)


@router.get("/authorize-url", response_model=SsoAuthorizeUrl)
async def authorize_url() -> SsoAuthorizeUrl:
    config = oidc_config_from_env()
    if config is None:
        raise ApiError(400, "sso_disabled", "SSO is not configured")
    state = sign_state(settings.JWT_SECRET)
    return SsoAuthorizeUrl(url=build_authorize_url(config, state))


@router.post("/exchange", response_model=SignupResponse)
async def exchange(
    body: SsoExchangeRequest, repo: AuthRepository = Depends(get_repo)
) -> SignupResponse:
    config = oidc_config_from_env()
    if config is None:
        raise ApiError(400, "sso_disabled", "SSO is not configured")
    if not verify_state(settings.JWT_SECRET, body.state):
        raise ApiError(400, "sso_bad_state", "Invalid or expired SSO state")

    userinfo = await _fetch_userinfo(config, body.code)
    profile = profile_from_userinfo(userinfo)
    if profile is None:
        raise ApiError(400, "sso_no_email", "IdP did not return an email")

    # Find or provision the user (random password — they log in via SSO).
    user_row = await repo.get_user_by_email(profile["email"])
    if user_row is None:
        user_row = await repo.create_user(
            email=profile["email"],
            name=profile["name"],
            password_hash=hash_password(secrets.token_urlsafe(32)),
        )
    user = User.model_validate(user_row)

    # Ensure the user has a workspace.
    workspaces = await repo.list_workspaces_for_user(user.id)
    if workspaces:
        w = workspaces[0]
        workspace = Workspace(
            id=str(w["id"]), name=w["name"], slug=w["slug"], role=w.get("role", "owner")
        )
    else:
        slug = await _unique_slug(repo, f"{profile['name']} workspace")
        ws_row = await repo.create_workspace(name=f"{profile['name']}'s workspace", slug=slug)
        await repo.add_member(workspace_id=str(ws_row["id"]), user_id=user.id, role="owner")
        workspace = Workspace(
            id=str(ws_row["id"]), name=ws_row["name"], slug=ws_row["slug"], role="owner"
        )

    access, refresh = await _issue_tokens(repo, user)
    return SignupResponse(
        user=user, workspace=workspace, access_token=access, refresh_token=refresh
    )
