"""OAuth2 provider config + token exchange for calendar connect (raw httpx).

No authlib dependency — Google and Microsoft both speak standard OAuth2
authorization-code flow, which is a couple of HTTP calls. Provider config is
derived from ``settings``; if a provider's client id/secret is unset the
``connect`` route returns 501 ``calendar_provider_not_configured``.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlencode

import httpx

from shared.config import settings

_TIMEOUT = httpx.Timeout(15.0, connect=5.0)


@dataclass(frozen=True)
class ProviderConfig:
    name: str
    client_id: Optional[str]
    client_secret: Optional[str]
    authorize_url: str
    token_url: str
    userinfo_url: str
    scope: str

    @property
    def configured(self) -> bool:
        return bool(self.client_id and self.client_secret)


def _google() -> ProviderConfig:
    return ProviderConfig(
        name="google",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
        token_url="https://oauth2.googleapis.com/token",
        userinfo_url="https://openidconnect.googleapis.com/v1/userinfo",
        scope=(
            "openid email https://www.googleapis.com/auth/calendar.readonly"
        ),
    )


def _microsoft() -> ProviderConfig:
    return ProviderConfig(
        name="microsoft",
        client_id=settings.MS_CLIENT_ID,
        client_secret=settings.MS_CLIENT_SECRET,
        authorize_url="https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        token_url="https://login.microsoftonline.com/common/oauth2/v2.0/token",
        userinfo_url="https://graph.microsoft.com/v1.0/me",
        scope="openid email offline_access Calendars.Read",
    )


_PROVIDERS = {"google": _google, "microsoft": _microsoft}


def get_provider(name: str) -> Optional[ProviderConfig]:
    factory = _PROVIDERS.get(name)
    return factory() if factory else None


def redirect_uri(provider: str) -> str:
    base = settings.CALENDAR_OAUTH_REDIRECT_BASE.rstrip("/")
    return f"{base}/api/v1/calendar/callback/{provider}"


def build_authorize_url(provider: ProviderConfig, *, state: str) -> str:
    params = {
        "client_id": provider.client_id,
        "redirect_uri": redirect_uri(provider.name),
        "response_type": "code",
        "scope": provider.scope,
        "state": state,
        "access_type": "offline",  # Google: request a refresh token.
        "prompt": "consent",
    }
    return f"{provider.authorize_url}?{urlencode(params)}"


@dataclass(frozen=True)
class TokenSet:
    access_token: Optional[str]
    refresh_token: Optional[str]
    expires_in: Optional[int]


async def exchange_code(provider: ProviderConfig, code: str) -> TokenSet:
    data = {
        "client_id": provider.client_id,
        "client_secret": provider.client_secret,
        "code": code,
        "redirect_uri": redirect_uri(provider.name),
        "grant_type": "authorization_code",
    }
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(
            provider.token_url,
            data=data,
            headers={"Accept": "application/json"},
        )
    resp.raise_for_status()
    payload = resp.json()
    return TokenSet(
        access_token=payload.get("access_token"),
        refresh_token=payload.get("refresh_token"),
        expires_in=payload.get("expires_in"),
    )


async def fetch_email(provider: ProviderConfig, access_token: str) -> Optional[str]:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(
            provider.userinfo_url,
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if resp.status_code >= 400:
        return None
    data = resp.json()
    # Google userinfo: {"email": ...}; MS Graph: {"mail": ..., "userPrincipalName": ...}
    return data.get("email") or data.get("mail") or data.get("userPrincipalName")
