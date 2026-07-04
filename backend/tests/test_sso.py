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
    p = profile_from_userinfo(
        {
            "email": "Alice@Example.com",
            "name": "Alice",
            "email_verified": True,
            "sub": "idp-1",
        }
    )
    assert p == {"email": "alice@example.com", "name": "Alice", "sub": "idp-1"}
    # Falls back to email local-part when no name.
    p2 = profile_from_userinfo(
        {"email": "bob@x.com", "email_verified": True, "sub": "idp-2"}
    )
    assert p2["name"] == "bob"


def test_profile_mapping_rejects_unverified_email():
    # No email_verified claim at all.
    assert profile_from_userinfo({"email": "eve@corp.com", "sub": "idp-3"}) is None
    # Explicitly false.
    assert (
        profile_from_userinfo(
            {"email": "eve@corp.com", "email_verified": False, "sub": "idp-3"}
        )
        is None
    )
    # Truthy-but-not-True (e.g. a string "true") must not slip past an `is True` check.
    assert (
        profile_from_userinfo(
            {"email": "eve@corp.com", "email_verified": "true", "sub": "idp-3"}
        )
        is None
    )


def test_profile_mapping_requires_sub():
    assert (
        profile_from_userinfo({"email": "eve@corp.com", "email_verified": True})
        is None
    )


# ── exchange route find-or-create (network mocked) ───────────────────────────
import pytest
from unittest.mock import AsyncMock
from src.api.product import routes_sso


@pytest.mark.asyncio
async def test_exchange_provisions_new_user(monkeypatch):
    monkeypatch.setattr(routes_sso, "oidc_config_from_env", lambda: CFG)
    monkeypatch.setattr(routes_sso, "verify_state", lambda secret, tok: True)

    async def fake_userinfo(config, code):
        return {
            "email": "new@corp.com",
            "name": "New User",
            "email_verified": True,
            "sub": "idp-sub-new",
        }

    monkeypatch.setattr(routes_sso, "_fetch_userinfo", fake_userinfo)
    monkeypatch.setattr(routes_sso, "_issue_tokens", AsyncMock(return_value=("at", "rt")))

    repo = AsyncMock()
    repo.get_user_by_sso_identity.return_value = None
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
    repo.link_sso_identity.assert_awaited_once_with(
        user_id="u-new", issuer=CFG.issuer, subject="idp-sub-new", email="new@corp.com"
    )


@pytest.mark.asyncio
async def test_exchange_uses_existing_user_and_workspace(monkeypatch):
    monkeypatch.setattr(routes_sso, "oidc_config_from_env", lambda: CFG)
    monkeypatch.setattr(routes_sso, "verify_state", lambda secret, tok: True)

    async def fake_userinfo(config, code):
        return {
            "email": "old@corp.com",
            "name": "Old",
            "email_verified": True,
            "sub": "idp-sub-old",
        }

    monkeypatch.setattr(routes_sso, "_fetch_userinfo", fake_userinfo)
    monkeypatch.setattr(routes_sso, "_issue_tokens", AsyncMock(return_value=("at", "rt")))

    repo = AsyncMock()
    repo.get_user_by_sso_identity.return_value = None
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
    # First-time link for this (issuer, sub): the identity gets persisted.
    repo.link_sso_identity.assert_awaited_once_with(
        user_id="u1", issuer=CFG.issuer, subject="idp-sub-old", email="old@corp.com"
    )


@pytest.mark.asyncio
async def test_exchange_rejects_unverified_email(monkeypatch):
    """The core fix: an IdP that returns an email with no (or false)
    email_verified must not be trusted to look up or create an account —
    otherwise an attacker who controls an unverified-email IdP response could
    log into any Parlor account whose email they know."""
    monkeypatch.setattr(routes_sso, "oidc_config_from_env", lambda: CFG)
    monkeypatch.setattr(routes_sso, "verify_state", lambda secret, tok: True)

    async def fake_userinfo(config, code):
        # No email_verified claim — must not be trusted for account linking.
        return {"email": "attacker@corp.com", "name": "Attacker"}

    monkeypatch.setattr(routes_sso, "_fetch_userinfo", fake_userinfo)

    repo = AsyncMock()
    body = routes_sso.SsoExchangeRequest(code="abc", state="signed")
    with pytest.raises(routes_sso.ApiError) as exc_info:
        await routes_sso.exchange(body, repo)
    assert exc_info.value.code == "sso_unverified_email"
    repo.get_user_by_email.assert_not_awaited()
    repo.get_user_by_sso_identity.assert_not_awaited()


@pytest.mark.asyncio
async def test_exchange_recovers_from_concurrent_create_user_race(monkeypatch):
    """Two concurrent first-time SSO logins for the same email both pass the
    get_user_by_email check before either commits, so create_user is called
    twice. The users_email_lower_uk unique index lets the DB reject the
    loser -- the exchange must catch that violation and log the caller into
    the winning account instead of a 500."""
    monkeypatch.setattr(routes_sso, "oidc_config_from_env", lambda: CFG)
    monkeypatch.setattr(routes_sso, "verify_state", lambda secret, tok: True)

    async def fake_userinfo(config, code):
        return {
            "email": "racer@corp.com",
            "name": "Racer",
            "email_verified": True,
            "sub": "idp-sub-racer",
        }

    monkeypatch.setattr(routes_sso, "_fetch_userinfo", fake_userinfo)
    monkeypatch.setattr(routes_sso, "_issue_tokens", AsyncMock(return_value=("at", "rt")))

    existing_row = {
        "id": "u-winner", "email": "racer@corp.com", "name": "Racer",
        "created_at": "2026-06-29T00:00:00Z",
    }
    repo = AsyncMock()
    repo.get_user_by_sso_identity.return_value = None
    # First call (pre-create check): no row yet. Second call (post-violation
    # re-fetch): the other request's row has landed.
    repo.get_user_by_email.side_effect = [None, existing_row]
    repo.create_user.side_effect = Exception(
        'duplicate key value violates unique constraint "users_email_lower_uk"'
    )
    repo.list_workspaces_for_user.return_value = []
    repo.create_workspace.return_value = {"id": "ws-1", "name": "Racer's workspace", "slug": "rw"}

    body = routes_sso.SsoExchangeRequest(code="abc", state="signed")
    resp = await routes_sso.exchange(body, repo)

    assert resp.user.id == "u-winner"
    repo.create_user.assert_awaited_once()
    assert repo.get_user_by_email.await_count == 2
    repo.link_sso_identity.assert_awaited_once_with(
        user_id="u-winner", issuer=CFG.issuer, subject="idp-sub-racer", email="racer@corp.com"
    )


@pytest.mark.asyncio
async def test_exchange_reraises_non_unique_create_user_errors(monkeypatch):
    """A create_user failure unrelated to the unique index (e.g. a DB outage)
    must propagate, not be swallowed as if it were the race case."""
    monkeypatch.setattr(routes_sso, "oidc_config_from_env", lambda: CFG)
    monkeypatch.setattr(routes_sso, "verify_state", lambda secret, tok: True)

    async def fake_userinfo(config, code):
        return {
            "email": "broken@corp.com",
            "name": "Broken",
            "email_verified": True,
            "sub": "idp-sub-broken",
        }

    monkeypatch.setattr(routes_sso, "_fetch_userinfo", fake_userinfo)

    repo = AsyncMock()
    repo.get_user_by_sso_identity.return_value = None
    repo.get_user_by_email.return_value = None
    repo.create_user.side_effect = Exception("connection reset by peer")

    body = routes_sso.SsoExchangeRequest(code="abc", state="signed")
    with pytest.raises(Exception, match="connection reset by peer"):
        await routes_sso.exchange(body, repo)


@pytest.mark.asyncio
async def test_exchange_already_linked_account_ignores_email_lookup(monkeypatch):
    """Once an (issuer, sub) identity is linked, the exchange must resolve
    the user via that identity — never by re-querying email — even if the
    IdP now reports a different (still verified) email for the same subject
    (e.g. the IdP account's email was changed)."""
    monkeypatch.setattr(routes_sso, "oidc_config_from_env", lambda: CFG)
    monkeypatch.setattr(routes_sso, "verify_state", lambda secret, tok: True)

    async def fake_userinfo(config, code):
        return {
            "email": "changed-email@corp.com",
            "name": "Renamed",
            "email_verified": True,
            "sub": "idp-sub-existing",
        }

    monkeypatch.setattr(routes_sso, "_fetch_userinfo", fake_userinfo)
    monkeypatch.setattr(routes_sso, "_issue_tokens", AsyncMock(return_value=("at", "rt")))

    repo = AsyncMock()
    repo.get_user_by_sso_identity.return_value = {
        "id": "u-existing", "email": "original@corp.com", "name": "Original",
        "created_at": "2026-06-29T00:00:00Z",
    }
    repo.list_workspaces_for_user.return_value = [
        {"id": "ws9", "name": "Acme", "slug": "acme", "role": "member"}
    ]
    body = routes_sso.SsoExchangeRequest(code="abc", state="signed")
    resp = await routes_sso.exchange(body, repo)

    assert resp.user.id == "u-existing"
    repo.get_user_by_sso_identity.assert_awaited_once_with(
        issuer=CFG.issuer, subject="idp-sub-existing"
    )
    # Already-linked: no email-keyed lookup, no re-linking, no new account.
    repo.get_user_by_email.assert_not_awaited()
    repo.create_user.assert_not_awaited()
    repo.link_sso_identity.assert_not_awaited()
