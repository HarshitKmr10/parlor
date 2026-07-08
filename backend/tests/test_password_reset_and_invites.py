"""Route-level tests for password reset + workspace invites.

Follows the dependency-override pattern used elsewhere (e.g.
test_meetings_list.py): the DB-backed repo is stubbed with an AsyncMock so
these run without a live Postgres, pinning the route contract (status codes,
error envelopes, and which repo calls each branch makes).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from src.api.product import security
from src.api.product.deps import get_current_user, get_repo
from src.api.product.schemas import User
from src.main import app

UTC = timezone.utc


@pytest.fixture(autouse=True)
def _reset_shared_ratelimit_store():
    """This module hits the real, process-wide RateLimitMiddleware on the
    shared ``app`` singleton (via the ``client_with_repo``/``authed_client``
    fixtures below) many times per test across 16+ tests. Without a reset,
    those calls exhaust the "default" tier's in-memory token bucket for the
    TestClient's fixed key, and whichever *other* test module happens to run
    afterward and also hits ``app`` unauthenticated starts failing with 429s
    that have nothing to do with what it's testing. The middleware instance
    is built once (lazily, on first ASGI call) and cached on
    ``app.middleware_stack`` for the process lifetime, so it must be found
    and cleared directly rather than reconstructed.
    """
    from src.ratelimit.middleware import RateLimitMiddleware

    def _find_store():
        node = getattr(app, "middleware_stack", None)
        seen = set()
        while node is not None and id(node) not in seen:
            seen.add(id(node))
            if isinstance(node, RateLimitMiddleware):
                return node._store
            node = getattr(node, "app", None)
        return None

    yield
    store = _find_store()
    if store is not None:
        store._state.clear()


def _user_row(**overrides) -> dict:
    base = dict(
        id=str(uuid4()),
        email="ada@example.com",
        name="Ada Lovelace",
        password_hash="argon2$fake",
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
    )
    base.update(overrides)
    return base


def _membership_row(*, role: str, workspace_id: str) -> dict:
    return {"id": workspace_id, "name": "Acme", "slug": "acme", "role": role}


@pytest.fixture
def client_with_repo():
    repo = AsyncMock()

    def override_repo():
        return repo

    app.dependency_overrides[get_repo] = override_repo
    try:
        yield TestClient(app), repo
    finally:
        app.dependency_overrides.pop(get_repo, None)


@pytest.fixture
def authed_client(client_with_repo):
    client, repo = client_with_repo
    user_row = _user_row()
    user = User.model_validate(user_row)

    def override_user():
        return user

    app.dependency_overrides[get_current_user] = override_user
    try:
        yield client, repo, user
    finally:
        app.dependency_overrides.pop(get_current_user, None)


# ── forgot-password ─────────────────────────────────────────────────────────


def test_forgot_password_existing_email_issues_token(client_with_repo):
    client, repo = client_with_repo
    repo.get_user_by_email.return_value = _user_row()

    res = client.post("/api/v1/auth/forgot-password", json={"email": "ada@example.com"})

    assert res.status_code == 200
    repo.store_password_reset_token.assert_awaited_once()


def test_forgot_password_unknown_email_still_returns_200(client_with_repo):
    client, repo = client_with_repo
    repo.get_user_by_email.return_value = None

    res = client.post(
        "/api/v1/auth/forgot-password", json={"email": "nobody@example.com"}
    )

    assert res.status_code == 200
    repo.store_password_reset_token.assert_not_awaited()
    # No account-existence leak: same generic message either way.
    assert "if that email exists" in res.json()["message"].lower()


# ── reset-password ──────────────────────────────────────────────────────────


def test_reset_password_valid_token_updates_and_revokes_sessions(client_with_repo):
    client, repo = client_with_repo
    user_id = str(uuid4())
    repo.get_active_password_reset_token.return_value = {
        "id": str(uuid4()),
        "user_id": user_id,
        "expires_at": datetime.now(UTC) + timedelta(minutes=10),
        "used_at": None,
    }

    res = client.post(
        "/api/v1/auth/reset-password",
        json={"token": "sometoken", "newPassword": "brandnewpassword123"},
    )

    assert res.status_code == 200
    repo.update_password_hash.assert_awaited_once()
    repo.mark_password_reset_token_used.assert_awaited_once()
    repo.revoke_all_refresh_tokens.assert_awaited_once_with(user_id)


def test_reset_password_invalid_token_is_rejected(client_with_repo):
    client, repo = client_with_repo
    repo.get_active_password_reset_token.return_value = None

    res = client.post(
        "/api/v1/auth/reset-password",
        json={"token": "bad", "newPassword": "brandnewpassword123"},
    )

    assert res.status_code == 400
    assert res.json()["error"]["code"] == "invalid_reset_token"
    repo.update_password_hash.assert_not_awaited()


# ── invite creation / listing / revocation (owner/admin-only) ──────────────


def test_create_invite_requires_owner_or_admin(authed_client):
    client, repo, _ = authed_client
    workspace_id = str(uuid4())
    repo.get_membership.return_value = _membership_row(
        role="member", workspace_id=workspace_id
    )

    res = client.post(
        f"/api/v1/workspaces/{workspace_id}/invites",
        json={"email": "new@example.com", "role": "member"},
    )

    assert res.status_code == 403
    repo.create_invite.assert_not_awaited()


def test_create_invite_as_owner_succeeds(authed_client):
    client, repo, user = authed_client
    workspace_id = str(uuid4())
    repo.get_membership.return_value = _membership_row(
        role="owner", workspace_id=workspace_id
    )
    repo.create_invite.return_value = {
        "id": str(uuid4()),
        "workspace_id": workspace_id,
        "email": "new@example.com",
        "role": "member",
        "status": "pending",
        "invited_by_user_id": user.id,
        "expires_at": datetime.now(UTC) + timedelta(days=7),
        "created_at": datetime.now(UTC),
    }

    res = client.post(
        f"/api/v1/workspaces/{workspace_id}/invites",
        json={"email": "new@example.com", "role": "member"},
    )

    assert res.status_code == 201
    body = res.json()
    assert body["email"] == "new@example.com"
    assert body["status"] == "pending"
    assert "acceptUrl" in body
    repo.create_invite.assert_awaited_once()


def test_list_invites_requires_owner_or_admin(authed_client):
    client, repo, _ = authed_client
    workspace_id = str(uuid4())
    repo.get_membership.return_value = _membership_row(
        role="member", workspace_id=workspace_id
    )

    res = client.get(f"/api/v1/workspaces/{workspace_id}/invites")

    assert res.status_code == 403


def test_list_invites_as_admin_returns_pending(authed_client):
    client, repo, user = authed_client
    workspace_id = str(uuid4())
    repo.get_membership.return_value = _membership_row(
        role="admin", workspace_id=workspace_id
    )
    repo.list_invites.return_value = [
        {
            "id": str(uuid4()),
            "workspace_id": workspace_id,
            "email": "pending@example.com",
            "role": "member",
            "status": "pending",
            "invited_by_user_id": user.id,
            "expires_at": datetime.now(UTC) + timedelta(days=7),
            "created_at": datetime.now(UTC),
        }
    ]

    res = client.get(f"/api/v1/workspaces/{workspace_id}/invites")

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert body["items"][0]["email"] == "pending@example.com"


def test_revoke_invite_not_found_returns_404(authed_client):
    client, repo, _ = authed_client
    workspace_id = str(uuid4())
    repo.get_membership.return_value = _membership_row(
        role="owner", workspace_id=workspace_id
    )
    repo.revoke_invite.return_value = False

    res = client.delete(f"/api/v1/workspaces/{workspace_id}/invites/{uuid4()}")

    assert res.status_code == 404


def test_revoke_invite_success(authed_client):
    client, repo, _ = authed_client
    workspace_id = str(uuid4())
    repo.get_membership.return_value = _membership_row(
        role="owner", workspace_id=workspace_id
    )
    repo.revoke_invite.return_value = True

    res = client.delete(f"/api/v1/workspaces/{workspace_id}/invites/{uuid4()}")

    assert res.status_code == 204


# ── invite preview / accept (public) ────────────────────────────────────────


def _invite_row(*, email: str, workspace_id: str, expired: bool = False) -> dict:
    expires_at = datetime.now(UTC) + (
        timedelta(days=-1) if expired else timedelta(days=7)
    )
    return {
        "id": str(uuid4()),
        "workspace_id": workspace_id,
        "email": email,
        "role": "member",
        "status": "pending",
        "invited_by_user_id": str(uuid4()),
        "token_hash": security.hash_token("irrelevant"),
        "expires_at": expires_at,
        "created_at": datetime.now(UTC),
    }


def test_preview_invite_expired_returns_404(client_with_repo):
    client, repo = client_with_repo
    workspace_id = str(uuid4())
    repo.get_invite_by_token_hash.return_value = _invite_row(
        email="a@b.com", workspace_id=workspace_id, expired=True
    )

    res = client.get("/api/v1/invites/sometoken")

    assert res.status_code == 404
    assert res.json()["error"]["code"] == "invite_not_found"


def test_preview_invite_valid_reports_signup_required(client_with_repo):
    client, repo = client_with_repo
    workspace_id = str(uuid4())
    repo.get_invite_by_token_hash.return_value = _invite_row(
        email="new@example.com", workspace_id=workspace_id
    )
    repo.get_workspace_by_id.return_value = {"name": "Acme", "id": workspace_id}
    repo.get_user_by_email.return_value = None

    res = client.get("/api/v1/invites/sometoken")

    assert res.status_code == 200
    body = res.json()
    assert body["workspaceName"] == "Acme"
    assert body["requiresSignup"] is True


def test_accept_invite_creates_account_for_new_email(client_with_repo):
    client, repo = client_with_repo
    workspace_id = str(uuid4())
    invite = _invite_row(email="new@example.com", workspace_id=workspace_id)
    repo.get_invite_by_token_hash.return_value = invite
    repo.get_user_by_email.return_value = None
    new_user_id = str(uuid4())
    repo.create_user.return_value = _user_row(
        id=new_user_id, email="new@example.com", name="Grace Hopper"
    )
    repo.get_membership.return_value = _membership_row(
        role="member", workspace_id=workspace_id
    )

    res = client.post(
        "/api/v1/invites/sometoken/accept",
        json={"name": "Grace Hopper", "password": "brandnewpassword123"},
    )

    assert res.status_code == 200
    body = res.json()
    assert body["user"]["email"] == "new@example.com"
    assert body["workspace"]["role"] == "member"
    repo.add_member.assert_awaited_once_with(
        workspace_id=workspace_id, user_id=new_user_id, role="member"
    )
    repo.mark_invite_accepted.assert_awaited_once()


def test_accept_invite_missing_credentials_for_new_email_is_rejected(
    client_with_repo,
):
    client, repo = client_with_repo
    workspace_id = str(uuid4())
    repo.get_invite_by_token_hash.return_value = _invite_row(
        email="new@example.com", workspace_id=workspace_id
    )
    repo.get_user_by_email.return_value = None

    res = client.post("/api/v1/invites/sometoken/accept", json={})

    assert res.status_code == 400
    assert res.json()["error"]["code"] == "signup_required"


def test_accept_invite_existing_email_without_auth_requires_login(client_with_repo):
    client, repo = client_with_repo
    workspace_id = str(uuid4())
    repo.get_invite_by_token_hash.return_value = _invite_row(
        email="existing@example.com", workspace_id=workspace_id
    )
    repo.get_user_by_email.return_value = _user_row(email="existing@example.com")

    res = client.post("/api/v1/invites/sometoken/accept", json={})

    assert res.status_code == 401
    assert res.json()["error"]["code"] == "login_required"
    repo.add_member.assert_not_awaited()


def test_accept_invite_existing_email_with_matching_session_succeeds(
    client_with_repo,
):
    client, repo = client_with_repo
    workspace_id = str(uuid4())
    existing_row = _user_row(email="existing@example.com")
    repo.get_invite_by_token_hash.return_value = _invite_row(
        email="existing@example.com", workspace_id=workspace_id
    )
    repo.get_user_by_email.return_value = existing_row
    repo.get_membership.return_value = _membership_row(
        role="member", workspace_id=workspace_id
    )
    token = security.create_access_token(
        user_id=existing_row["id"], email="existing@example.com"
    )

    res = client.post(
        "/api/v1/invites/sometoken/accept",
        json={},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert res.status_code == 200
    repo.add_member.assert_awaited_once()
