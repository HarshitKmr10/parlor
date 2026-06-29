"""Unit tests for OIDC SSO pure helpers."""

from urllib.parse import parse_qs, urlparse

from src.sso import (
    OidcConfig,
    build_authorize_url,
    oidc_config_from_env,
    profile_from_userinfo,
    sign_state,
    verify_state,
)

CFG = OidcConfig(
    issuer="https://idp.example.com",
    client_id="cid",
    client_secret="csecret",
    authorize_url="https://idp.example.com/authorize",
    token_url="https://idp.example.com/token",
    userinfo_url="https://idp.example.com/userinfo",
    redirect_uri="https://app.example.com/api/auth/sso/callback",
)


def test_config_from_env_none_when_unset():
    assert oidc_config_from_env({}) is None


def test_config_from_env_built_when_complete():
    env = {
        "SSO_OIDC_CLIENT_ID": "c",
        "SSO_OIDC_CLIENT_SECRET": "s",
        "SSO_OIDC_AUTHORIZE_URL": "https://i/a",
        "SSO_OIDC_TOKEN_URL": "https://i/t",
        "SSO_OIDC_USERINFO_URL": "https://i/u",
        "SSO_OIDC_REDIRECT_URI": "https://app/cb",
    }
    cfg = oidc_config_from_env(env)
    assert cfg is not None and cfg.client_id == "c"


def test_authorize_url_has_required_params():
    url = build_authorize_url(CFG, "state123")
    q = parse_qs(urlparse(url).query)
    assert q["response_type"] == ["code"]
    assert q["client_id"] == ["cid"]
    assert q["redirect_uri"] == [CFG.redirect_uri]
    assert q["state"] == ["state123"]
    assert "openid" in q["scope"][0]


def test_state_round_trip():
    tok = sign_state("secret")
    assert verify_state("secret", tok) is True
    assert verify_state("wrong-secret", tok) is False
    assert verify_state("secret", "garbage") is False


def test_expired_state_rejected():
    tok = sign_state("secret", ttl_sec=-1)  # already expired
    assert verify_state("secret", tok) is False


def test_profile_mapping_requires_email():
    assert profile_from_userinfo({"name": "X"}) is None
    p = profile_from_userinfo({"email": "Alice@Example.com", "name": "Alice"})
    assert p == {"email": "alice@example.com", "name": "Alice"}
    # Falls back to email local-part when no name.
    p2 = profile_from_userinfo({"email": "bob@x.com"})
    assert p2["name"] == "bob"


# ── exchange route find-or-create (network mocked) ───────────────────────────
import pytest
from unittest.mock import AsyncMock
from src.api.product import routes_sso


@pytest.mark.asyncio
async def test_exchange_provisions_new_user(monkeypatch):
    monkeypatch.setattr(routes_sso, "oidc_config_from_env", lambda: CFG)
    monkeypatch.setattr(routes_sso, "verify_state", lambda secret, tok: True)

    async def fake_userinfo(config, code):
        return {"email": "new@corp.com", "name": "New User"}

    monkeypatch.setattr(routes_sso, "_fetch_userinfo", fake_userinfo)
    monkeypatch.setattr(routes_sso, "_issue_tokens", AsyncMock(return_value=("at", "rt")))

    repo = AsyncMock()
    repo.get_user_by_email.return_value = None
    repo.create_user.return_value = {
        "id": "u-new", "email": "new@corp.com", "name": "New User",
        "created_at": "2026-06-29T00:00:00Z",
    }
    repo.list_workspaces_for_user.return_value = []
    repo.create_workspace.return_value = {"id": "ws-1", "name": "New User's workspace", "slug": "nu"}

    body = routes_sso.SsoExchangeRequest(code="abc", state="signed")
    resp = await routes_sso.exchange(body, repo)
    assert resp.user.email == "new@corp.com"
    assert resp.access_token == "at"
    repo.create_user.assert_awaited()      # provisioned
    repo.create_workspace.assert_awaited()  # got a workspace


@pytest.mark.asyncio
async def test_exchange_uses_existing_user_and_workspace(monkeypatch):
    monkeypatch.setattr(routes_sso, "oidc_config_from_env", lambda: CFG)
    monkeypatch.setattr(routes_sso, "verify_state", lambda secret, tok: True)

    async def fake_userinfo(config, code):
        return {"email": "old@corp.com", "name": "Old"}

    monkeypatch.setattr(routes_sso, "_fetch_userinfo", fake_userinfo)
    monkeypatch.setattr(routes_sso, "_issue_tokens", AsyncMock(return_value=("at", "rt")))

    repo = AsyncMock()
    repo.get_user_by_email.return_value = {
        "id": "u1", "email": "old@corp.com", "name": "Old",
        "created_at": "2026-06-29T00:00:00Z",
    }
    repo.list_workspaces_for_user.return_value = [
        {"id": "ws9", "name": "Acme", "slug": "acme", "role": "member"}
    ]
    body = routes_sso.SsoExchangeRequest(code="abc", state="signed")
    resp = await routes_sso.exchange(body, repo)
    assert resp.workspace.id == "ws9"
    repo.create_user.assert_not_awaited()
    repo.create_workspace.assert_not_awaited()
