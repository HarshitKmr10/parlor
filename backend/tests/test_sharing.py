"""Unit tests for public meeting share links: tokens, expiry, repo scoping."""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest

from src.sharing import (
    SharesRepo,
    check_passcode,
    generate_share_token,
    is_share_active,
)

# ── tokens ──────────────────────────────────────────────────────────────────


def test_generate_token_is_long_and_unique():
    a, b = generate_share_token(), generate_share_token()
    assert a != b
    assert len(a) >= 40  # 32 bytes url-safe ≈ 43 chars
    assert "/" not in a and "+" not in a  # url-safe alphabet


# ── is_share_active ─────────────────────────────────────────────────────────


def test_active_when_not_revoked_and_no_expiry():
    assert is_share_active(revoked=False, expires_at=None) is True


def test_inactive_when_revoked():
    future = datetime.now(timezone.utc) + timedelta(days=1)
    assert is_share_active(revoked=True, expires_at=future) is False


def test_inactive_when_expired():
    past = datetime.now(timezone.utc) - timedelta(seconds=1)
    assert is_share_active(revoked=False, expires_at=past) is False


def test_active_before_expiry():
    future = datetime.now(timezone.utc) + timedelta(days=1)
    assert is_share_active(revoked=False, expires_at=future) is True


def test_naive_expiry_treated_as_utc():
    # asyncpg may hand back a naive datetime; must not raise and must compare.
    naive_future = (datetime.now(timezone.utc) + timedelta(days=1)).replace(tzinfo=None)
    assert is_share_active(revoked=False, expires_at=naive_future) is True


# ── SharesRepo (mocked) ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_for_meeting_is_workspace_scoped():
    db = AsyncMock()
    db.store.query_raw = AsyncMock(return_value=[])
    repo = SharesRepo(db)
    await repo.get_for_meeting("m1", "w1")
    sql, *params = db.store.query_raw.await_args.args
    assert "workspace_id = $2::uuid" in sql
    assert params == ["m1", "w1"]


@pytest.mark.asyncio
async def test_get_by_token_queries_token_only():
    db = AsyncMock()
    db.store.query_raw = AsyncMock(return_value=[])
    repo = SharesRepo(db)
    await repo.get_by_token("tok123")
    sql, *params = db.store.query_raw.await_args.args
    assert "WHERE token = $1" in sql
    assert params == ["tok123"]


@pytest.mark.asyncio
async def test_revoke_returns_false_when_no_row():
    db = AsyncMock()
    db.store.query_raw = AsyncMock(return_value=[])
    repo = SharesRepo(db)
    assert await repo.revoke("m1", "w1") is False


@pytest.mark.asyncio
async def test_upsert_normalizes_uuids():
    import uuid

    db = AsyncMock()
    db.store.query_raw = AsyncMock(
        return_value=[
            {
                "id": uuid.uuid4(),
                "meeting_id": uuid.uuid4(),
                "workspace_id": uuid.uuid4(),
                "created_by": None,
                "token": "t",
                "include_transcript": False,
                "include_highlights": True,
                "include_analytics": False,
                "revoked": False,
                "expires_at": None,
                "view_count": 0,
                "last_viewed_at": None,
                "created_at": None,
                "updated_at": None,
            }
        ]
    )
    repo = SharesRepo(db)
    row = await repo.upsert(
        meeting_id="m1",
        workspace_id="w1",
        created_by=None,
        token="t",
        include_transcript=False,
        include_highlights=True,
        include_analytics=False,
        expires_at=None,
    )
    assert isinstance(row["id"], str)
    assert isinstance(row["meeting_id"], str)


# ── create_share applies workspace default expiry ────────────────────────────

_WS_ID = "00000000-0000-0000-0000-000000000002"
_MEETING_ID = "00000000-0000-0000-0000-000000000009"


def _share_row(expires_at):
    return {
        "id": "00000000-0000-0000-0000-000000000001",
        "meeting_id": _MEETING_ID,
        "workspace_id": _WS_ID,
        "created_by": None,
        "token": "tok",
        "include_transcript": False,
        "include_highlights": True,
        "include_analytics": False,
        "revoked": False,
        "expires_at": expires_at,
        "view_count": 0,
        "last_viewed_at": None,
        "created_at": None,
    }


@pytest.fixture
def create_share_client():
    """TestClient with auth, the shares repo, share-settings repo, and the
    meetings repo overridden so no real DB is touched."""
    from fastapi.testclient import TestClient

    from src.api.product import routes_shares
    from src.api.product.deps import AuthContext, get_current_context
    from src.api.product.schemas import Workspace
    from src.main import app

    def _ctx():
        return AuthContext(
            user=None,
            workspace=Workspace(id=_WS_ID, name="W", slug="w", role="owner"),
            via_api_key=False,
        )

    shares_repo = AsyncMock()
    settings_repo = AsyncMock()
    meetings_repo = AsyncMock()
    meetings_repo.get_scoped.return_value = {"id": _MEETING_ID}

    app.dependency_overrides[get_current_context] = _ctx
    app.dependency_overrides[routes_shares._repo] = lambda: shares_repo
    app.dependency_overrides[routes_shares._settings_repo] = lambda: settings_repo
    app.dependency_overrides[routes_shares._meetings_repo] = lambda: meetings_repo
    try:
        yield TestClient(app), shares_repo, settings_repo
    finally:
        app.dependency_overrides.pop(get_current_context, None)
        app.dependency_overrides.pop(routes_shares._repo, None)
        app.dependency_overrides.pop(routes_shares._settings_repo, None)
        app.dependency_overrides.pop(routes_shares._meetings_repo, None)


def _upsert_expires_at(shares_repo):
    return shares_repo.upsert.await_args.kwargs["expires_at"]


def _upsert_passcode(shares_repo):
    return shares_repo.upsert.await_args.kwargs["passcode"]


def test_create_applies_default_expiry_when_caller_omits(create_share_client):
    client, shares_repo, settings_repo = create_share_client
    settings_repo.get.return_value = {"default_expiry_hours": 48}
    shares_repo.upsert.return_value = _share_row(
        datetime.now(timezone.utc) + timedelta(hours=48)
    )

    before = datetime.now(timezone.utc)
    res = client.post(f"/api/v1/meetings/{_MEETING_ID}/share", json={})
    assert res.status_code == 201, res.text

    expires_at = _upsert_expires_at(shares_repo)
    assert expires_at is not None
    delta = expires_at - before
    assert timedelta(hours=47) < delta < timedelta(hours=49)


def test_create_no_expiry_when_default_is_zero(create_share_client):
    client, shares_repo, settings_repo = create_share_client
    settings_repo.get.return_value = {"default_expiry_hours": 0}
    shares_repo.upsert.return_value = _share_row(None)

    res = client.post(f"/api/v1/meetings/{_MEETING_ID}/share", json={})
    assert res.status_code == 201, res.text
    assert _upsert_expires_at(shares_repo) is None


def test_create_explicit_expiry_overrides_default(create_share_client):
    client, shares_repo, settings_repo = create_share_client
    settings_repo.get.return_value = {"default_expiry_hours": 48}
    shares_repo.upsert.return_value = _share_row(
        datetime.now(timezone.utc) + timedelta(days=7)
    )

    before = datetime.now(timezone.utc)
    res = client.post(
        f"/api/v1/meetings/{_MEETING_ID}/share", json={"expiresInDays": 7}
    )
    assert res.status_code == 201, res.text

    expires_at = _upsert_expires_at(shares_repo)
    delta = expires_at - before
    # 7 days, not the 48h default.
    assert timedelta(days=6, hours=23) < delta < timedelta(days=7, hours=1)
    # Settings are consulted (for the passcode default), but the explicit expiry
    # still wins and, with no require_passcode, no passcode is applied.
    assert _upsert_passcode(shares_repo) is None


def test_create_survives_settings_lookup_failure(create_share_client):
    client, shares_repo, settings_repo = create_share_client
    settings_repo.get.side_effect = RuntimeError("settings unavailable")
    shares_repo.upsert.return_value = _share_row(None)

    res = client.post(f"/api/v1/meetings/{_MEETING_ID}/share", json={})
    assert res.status_code == 201, res.text
    assert _upsert_expires_at(shares_repo) is None
    # A settings failure must not force a passcode either.
    assert _upsert_passcode(shares_repo) is None


# ── create_share applies workspace passcode default ──────────────────────────


def test_create_applies_default_passcode_when_required_and_omitted(create_share_client):
    client, shares_repo, settings_repo = create_share_client
    settings_repo.get.return_value = {
        "default_expiry_hours": 0,
        "require_passcode": True,
        "default_passcode": "s3cret",
    }
    shares_repo.upsert.return_value = _share_row(None)

    res = client.post(f"/api/v1/meetings/{_MEETING_ID}/share", json={})
    assert res.status_code == 201, res.text
    assert _upsert_passcode(shares_repo) == "s3cret"


def test_create_explicit_passcode_wins_over_default(create_share_client):
    client, shares_repo, settings_repo = create_share_client
    settings_repo.get.return_value = {
        "require_passcode": True,
        "default_passcode": "s3cret",
    }
    shares_repo.upsert.return_value = _share_row(None)

    res = client.post(
        f"/api/v1/meetings/{_MEETING_ID}/share", json={"passcode": "mine"}
    )
    assert res.status_code == 201, res.text
    assert _upsert_passcode(shares_repo) == "mine"


def test_create_no_passcode_when_not_required(create_share_client):
    client, shares_repo, settings_repo = create_share_client
    settings_repo.get.return_value = {"require_passcode": False}
    shares_repo.upsert.return_value = _share_row(None)

    res = client.post(f"/api/v1/meetings/{_MEETING_ID}/share", json={})
    assert res.status_code == 201, res.text
    assert _upsert_passcode(shares_repo) is None


def test_create_explicit_empty_passcode_means_unprotected(create_share_client):
    client, shares_repo, settings_repo = create_share_client
    settings_repo.get.return_value = {
        "require_passcode": True,
        "default_passcode": "s3cret",
    }
    shares_repo.upsert.return_value = _share_row(None)

    res = client.post(
        f"/api/v1/meetings/{_MEETING_ID}/share", json={"passcode": ""}
    )
    assert res.status_code == 201, res.text
    assert _upsert_passcode(shares_repo) is None


# ── check_passcode (pure gate decision) ──────────────────────────────────────


def test_check_passcode_allows_when_none_required():
    assert check_passcode(None, None) is None
    assert check_passcode("", "anything") is None


def test_check_passcode_requires_when_missing():
    assert check_passcode("s3cret", None) == "passcode_required"
    assert check_passcode("s3cret", "") == "passcode_required"


def test_check_passcode_rejects_wrong():
    assert check_passcode("s3cret", "nope") == "invalid_passcode"


def test_check_passcode_allows_correct():
    assert check_passcode("s3cret", "s3cret") is None


# ── public read gate (mocked SharesRepo) ─────────────────────────────────────


def _protected_share_row(passcode):
    return {
        "id": "00000000-0000-0000-0000-000000000001",
        "meeting_id": _MEETING_ID,
        "workspace_id": _WS_ID,
        "created_by": None,
        "token": "tok",
        "include_transcript": False,
        "include_highlights": False,
        "include_analytics": False,
        "revoked": False,
        "expires_at": None,
        "passcode": passcode,
        "view_count": 0,
        "last_viewed_at": None,
        "created_at": None,
    }


@pytest.fixture
def public_client():
    from fastapi.testclient import TestClient

    from src.api.product import routes_public
    from src.main import app

    app.dependency_overrides[routes_public.get_db] = lambda: AsyncMock()
    try:
        yield TestClient(app, raise_server_exceptions=False)
    finally:
        app.dependency_overrides.pop(routes_public.get_db, None)


def test_public_read_blocked_without_passcode(public_client):
    from unittest.mock import patch

    with patch(
        "src.sharing.SharesRepo.get_by_token",
        new=AsyncMock(return_value=_protected_share_row("s3cret")),
    ):
        res = public_client.get("/api/v1/public/shares/tok")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "passcode_required"


def test_public_read_blocked_with_wrong_passcode(public_client):
    from unittest.mock import patch

    with patch(
        "src.sharing.SharesRepo.get_by_token",
        new=AsyncMock(return_value=_protected_share_row("s3cret")),
    ):
        res = public_client.get("/api/v1/public/shares/tok?passcode=nope")
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "invalid_passcode"


def test_public_read_passes_gate_with_correct_passcode(public_client):
    """Correct passcode clears the gate. The meeting is mocked absent, so the
    handler then 404s downstream — the point is it is NOT a 401/403."""
    from unittest.mock import patch

    with patch(
        "src.sharing.SharesRepo.get_by_token",
        new=AsyncMock(return_value=_protected_share_row("s3cret")),
    ), patch(
        "src.api.product.routes_public.ProductMeetingsRepo.get_scoped",
        new=AsyncMock(return_value=None),
    ):
        res = public_client.get("/api/v1/public/shares/tok?passcode=s3cret")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "not_found"


def test_public_read_via_header_passcode(public_client):
    from unittest.mock import patch

    with patch(
        "src.sharing.SharesRepo.get_by_token",
        new=AsyncMock(return_value=_protected_share_row("s3cret")),
    ), patch(
        "src.api.product.routes_public.ProductMeetingsRepo.get_scoped",
        new=AsyncMock(return_value=None),
    ):
        res = public_client.get(
            "/api/v1/public/shares/tok", headers={"X-Share-Passcode": "s3cret"}
        )
    assert res.status_code == 404


def test_public_read_unprotected_share_unaffected(public_client):
    """A NULL-passcode share must not be gated — reaches the meeting lookup."""
    from unittest.mock import patch

    with patch(
        "src.sharing.SharesRepo.get_by_token",
        new=AsyncMock(return_value=_protected_share_row(None)),
    ), patch(
        "src.api.product.routes_public.ProductMeetingsRepo.get_scoped",
        new=AsyncMock(return_value=None),
    ):
        res = public_client.get("/api/v1/public/shares/tok")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "not_found"
