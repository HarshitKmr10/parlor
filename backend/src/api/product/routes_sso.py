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
from .errors import ApiError, is_unique_violation
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


@router.get(
    "/status",
    response_model=SsoStatus,
    summary="Get SSO status",
    description="Returns whether an OIDC identity provider is configured via env for this deployment, and its label.",
)
async def sso_status() -> SsoStatus:
    config = oidc_config_from_env()
    return SsoStatus(enabled=config is not None, provider=config.provider if config else None)


@router.get(
    "/authorize-url",
    response_model=SsoAuthorizeUrl,
    summary="Get the SSO authorize URL",
    description=(
        "Builds the IdP authorization URL the browser should redirect to, "
        "embedding a signed, 10-minute CSRF state token. 400 `sso_disabled` "
        "if no IdP is configured."
    ),
)
async def authorize_url() -> SsoAuthorizeUrl:
    config = oidc_config_from_env()
    if config is None:
        raise ApiError(400, "sso_disabled", "SSO is not configured")
    state = sign_state(settings.JWT_SECRET)
    return SsoAuthorizeUrl(url=build_authorize_url(config, state))


@router.post(
    "/exchange",
    response_model=SignupResponse,
    summary="Exchange an SSO auth code for a session",
    description=(
        "Verifies the CSRF state, exchanges the authorization code with the "
        "IdP, and finds-or-creates the user plus a default workspace on "
        "first login. Existing links resolve via the IdP's stable "
        "(issuer, subject) identity, never by email. Returns the same "
        "shape as signup/login."
    ),
)
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
        raise ApiError(
            400,
            "sso_unverified_email",
            "IdP did not return a verified email and subject claim",
        )

    # Already-linked accounts MUST resolve via the IdP's stable (issuer, sub)
    # identity, never by email — email is mutable at the IdP and must not be
    # trusted as the account-linking key once a link exists.
    user_row = await repo.get_user_by_sso_identity(
        issuer=config.issuer, subject=profile["sub"]
    )
    if user_row is None:
        # First-time SSO login for this subject: find-or-create by verified
        # email (safe here because profile_from_userinfo already enforced
        # email_verified: true), then persist the (issuer, sub) link so every
        # future login for this identity uses it instead of email.
        user_row = await repo.get_user_by_email(profile["email"])
        if user_row is None:
            # The users_email_lower_uk unique index is the source of truth;
            # catch its violation so a concurrent signup/SSO race for the same
            # email logs into the winning account instead of a 500.
            try:
                user_row = await repo.create_user(
                    email=profile["email"],
                    name=profile["name"],
                    password_hash=hash_password(secrets.token_urlsafe(32)),
                )
            except Exception as exc:  # noqa: BLE001 - re-raised unless it's the unique case
                if not is_unique_violation(exc):
                    raise
                user_row = await repo.get_user_by_email(profile["email"])
                if user_row is None:
                    raise
        await repo.link_sso_identity(
            user_id=str(user_row["id"]),
            issuer=config.issuer,
            subject=profile["sub"],
            email=profile["email"],
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
