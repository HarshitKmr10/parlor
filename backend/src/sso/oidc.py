"""OIDC config + pure helpers for the authorization-code flow."""

from __future__ import annotations

import os
import time
from dataclasses import dataclass
from typing import Any, Mapping, Optional
from urllib.parse import urlencode

import jwt


@dataclass(frozen=True)
class OidcConfig:
    issuer: str
    client_id: str
    client_secret: str
    authorize_url: str
    token_url: str
    userinfo_url: str
    redirect_uri: str
    provider: str = "oidc"
    scopes: str = "openid email profile"


def oidc_config_from_env(env: Optional[Mapping[str, str]] = None) -> Optional[OidcConfig]:
    """Build config from env, or None if SSO isn't configured."""
    e = env if env is not None else os.environ
    required = [
        e.get("SSO_OIDC_CLIENT_ID"),
        e.get("SSO_OIDC_CLIENT_SECRET"),
        e.get("SSO_OIDC_AUTHORIZE_URL"),
        e.get("SSO_OIDC_TOKEN_URL"),
        e.get("SSO_OIDC_USERINFO_URL"),
        e.get("SSO_OIDC_REDIRECT_URI"),
    ]
    if not all(required):
        return None
    return OidcConfig(
        issuer=e.get("SSO_OIDC_ISSUER", ""),
        client_id=e["SSO_OIDC_CLIENT_ID"],
        client_secret=e["SSO_OIDC_CLIENT_SECRET"],
        authorize_url=e["SSO_OIDC_AUTHORIZE_URL"],
        token_url=e["SSO_OIDC_TOKEN_URL"],
        userinfo_url=e["SSO_OIDC_USERINFO_URL"],
        redirect_uri=e["SSO_OIDC_REDIRECT_URI"],
        provider=e.get("SSO_OIDC_PROVIDER", "oidc"),
        scopes=e.get("SSO_OIDC_SCOPES", "openid email profile"),
    )


def build_authorize_url(config: OidcConfig, state: str) -> str:
    """Construct the IdP authorization URL for the code flow."""
    params = {
        "response_type": "code",
        "client_id": config.client_id,
        "redirect_uri": config.redirect_uri,
        "scope": config.scopes,
        "state": state,
    }
    sep = "&" if "?" in config.authorize_url else "?"
    return f"{config.authorize_url}{sep}{urlencode(params)}"


def sign_state(secret: str, *, ttl_sec: int = 600, now: Optional[int] = None) -> str:
    """A short-lived signed CSRF state token (HS256)."""
    issued = int(now if now is not None else time.time())
    return jwt.encode(
        {"k": "sso_state", "iat": issued, "exp": issued + ttl_sec},
        secret,
        algorithm="HS256",
    )


def verify_state(secret: str, token: str) -> bool:
    try:
        claims = jwt.decode(token, secret, algorithms=["HS256"])
        return claims.get("k") == "sso_state"
    except jwt.PyJWTError:
        return False


def profile_from_userinfo(userinfo: Mapping[str, Any]) -> Optional[dict]:
    """Map OIDC userinfo to {email, name, sub}. Email is required and MUST be
    IdP-verified (``email_verified: true``) — an unverified email claim is
    attacker-controllable at many IdPs (self-service, unverified-by-design, or
    simply misconfigured) and must never be trusted to look up or create an
    account. ``sub`` (the IdP's stable subject claim) is also required so
    callers can bind the login to a subject+issuer identity rather than the
    mutable email string.
    """
    email = userinfo.get("email")
    if not email or not isinstance(email, str):
        return None
    if userinfo.get("email_verified") is not True:
        return None
    sub = userinfo.get("sub")
    if not sub or not isinstance(sub, str):
        return None
    name = (
        userinfo.get("name")
        or userinfo.get("preferred_username")
        or email.split("@")[0]
    )
    return {"email": email.lower().strip(), "name": str(name), "sub": sub}
