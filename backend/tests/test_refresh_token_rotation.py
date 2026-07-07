"""Refresh token rotation + reuse (theft) detection for POST /api/v1/auth/refresh."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from src.api.product.deps import get_repo
from src.api.product.security import hash_token
from src.main import app

_USER = {
    "id": "00000000-0000-0000-0000-0000000000aa",
    "email": "u@example.com",
    "name": "U",
    "created_at": datetime.now(timezone.utc),
}


class FakeAuthRepo:
    """In-memory double for AuthRepository's refresh-token surface."""

    def __init__(self, user_row: dict) -> None:
        self._user_row = user_row
        self._tokens: dict[str, dict] = {}

    async def store_refresh_token(
        self, *, user_id: str, token_hash: str, expires_at: datetime, family_id: str
    ) -> None:
        self._tokens[token_hash] = {
            "user_id": user_id,
            "family_id": family_id,
            "expires_at": expires_at,
            "revoked_at": None,
        }

    async def get_refresh_token_by_hash(self, token_hash: str):
        row = self._tokens.get(token_hash)
        return dict(row) if row else None

    async def revoke_refresh_token(self, token_hash: str) -> None:
        row = self._tokens.get(token_hash)
        if row is not None and row["revoked_at"] is None:
            row["revoked_at"] = datetime.now(timezone.utc)

    async def revoke_refresh_token_family(self, family_id: str) -> None:
        for row in self._tokens.values():
            if row["family_id"] == family_id and row["revoked_at"] is None:
                row["revoked_at"] = datetime.now(timezone.utc)

    async def get_user_by_id(self, user_id: str):
        return self._user_row if user_id == self._user_row["id"] else None

    def seed_active_token(self, plaintext_token: str, *, family_id: str | None = None) -> str:
        family = family_id or str(uuid.uuid4())
        self._tokens[hash_token(plaintext_token)] = {
            "user_id": self._user_row["id"],
            "family_id": family,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=1),
            "revoked_at": None,
        }
        return family


@pytest.fixture
def refresh_client():
    repo = FakeAuthRepo(_USER)
    app.dependency_overrides[get_repo] = lambda: repo
    try:
        yield TestClient(app), repo
    finally:
        app.dependency_overrides.pop(get_repo, None)


def test_refresh_rotates_token(refresh_client):
    client, repo = refresh_client
    old_token = "original-refresh-token"
    repo.seed_active_token(old_token)

    res = client.post("/api/v1/auth/refresh", json={"refreshToken": old_token})

    assert res.status_code == 200, res.text
    new_token = res.json()["refreshToken"]
    assert new_token != old_token
    assert repo._tokens[hash_token(old_token)]["revoked_at"] is not None


def test_replayed_refresh_token_is_rejected_and_revokes_family(refresh_client):
    client, repo = refresh_client
    old_token = "original-refresh-token"
    repo.seed_active_token(old_token)

    first = client.post("/api/v1/auth/refresh", json={"refreshToken": old_token})
    assert first.status_code == 200, first.text
    new_token = first.json()["refreshToken"]

    replay = client.post("/api/v1/auth/refresh", json={"refreshToken": old_token})
    assert replay.status_code == 401
    assert replay.json()["error"]["code"] == "invalid_refresh_token"

    reuse_of_new = client.post("/api/v1/auth/refresh", json={"refreshToken": new_token})
    assert reuse_of_new.status_code == 401
    assert reuse_of_new.json()["error"]["code"] == "invalid_refresh_token"


def test_unknown_refresh_token_is_rejected(refresh_client):
    client, _repo = refresh_client
    res = client.post("/api/v1/auth/refresh", json={"refreshToken": "never-issued"})
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "invalid_refresh_token"


def test_expired_refresh_token_is_rejected(refresh_client):
    client, repo = refresh_client
    token = "expired-token"
    repo._tokens[hash_token(token)] = {
        "user_id": _USER["id"],
        "family_id": str(uuid.uuid4()),
        "expires_at": datetime.now(timezone.utc) - timedelta(seconds=1),
        "revoked_at": None,
    }
    res = client.post("/api/v1/auth/refresh", json={"refreshToken": token})
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "invalid_refresh_token"
