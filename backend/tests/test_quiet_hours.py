"""Route + helper tests for the per-user quiet-hours API (single-row settings)."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest


def _override_context(*, user=True):
    from src.api.product.deps import AuthContext
    from src.api.product.schemas import User, Workspace

    def _dep():
        return AuthContext(
            user=(
                User(
                    id="00000000-0000-0000-0000-000000000009",
                    email="u@example.com",
                    name="U",
                    created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
                )
                if user
                else None
            ),
            workspace=Workspace(
                id="00000000-0000-0000-0000-000000000002",
                name="W",
                slug="w",
                role="owner",
            ),
            via_api_key=not user,
        )

    return _dep


def _row(enabled=True, start_hour=22, end_hour=7):
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return {
        "workspace_id": "00000000-0000-0000-0000-000000000002",
        "user_id": "00000000-0000-0000-0000-000000000009",
        "enabled": enabled,
        "start_hour": start_hour,
        "end_hour": end_hour,
        "updated_at": now,
    }


@pytest.fixture
def quiet_client():
    """TestClient with get_current_context + the route's repo dependency
    overridden so no real DB is touched."""
    from fastapi.testclient import TestClient

    from src.api.product import routes_quiet_hours
    from src.api.product.deps import get_current_context
    from src.main import app

    fake_repo = AsyncMock()
    app.dependency_overrides[get_current_context] = _override_context()
    app.dependency_overrides[routes_quiet_hours._repo] = lambda: fake_repo
    try:
        yield TestClient(app), fake_repo
    finally:
        app.dependency_overrides.pop(get_current_context, None)
        app.dependency_overrides.pop(routes_quiet_hours._repo, None)


def test_get_returns_defaults(quiet_client):
    from src.quiet_hours import DEFAULTS

    client, fake_repo = quiet_client
    fake_repo.get.return_value = {
        **DEFAULTS,
        "workspace_id": "00000000-0000-0000-0000-000000000002",
        "user_id": "00000000-0000-0000-0000-000000000009",
    }
    res = client.get("/api/v1/quiet-hours")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["enabled"] is False
    assert body["startHour"] == 20
    assert body["endHour"] == 8
    fake_repo.get.assert_awaited_once()


def test_put_round_trips(quiet_client):
    client, fake_repo = quiet_client
    fake_repo.upsert.return_value = _row(enabled=True, start_hour=22, end_hour=7)
    res = client.put(
        "/api/v1/quiet-hours",
        json={"enabled": True, "startHour": 22, "endHour": 7},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["enabled"] is True
    assert body["startHour"] == 22
    assert body["endHour"] == 7
    fake_repo.upsert.assert_awaited_once()


def test_put_rejects_out_of_range_hour(quiet_client):
    client, _ = quiet_client
    res = client.put(
        "/api/v1/quiet-hours",
        json={"enabled": True, "startHour": 24, "endHour": 7},
    )
    assert res.status_code == 422, res.text


def test_api_key_principal_is_forbidden():
    from fastapi.testclient import TestClient

    from src.api.product import routes_quiet_hours
    from src.api.product.deps import get_current_context
    from src.main import app

    fake_repo = AsyncMock()
    app.dependency_overrides[get_current_context] = _override_context(user=False)
    app.dependency_overrides[routes_quiet_hours._repo] = lambda: fake_repo
    try:
        client = TestClient(app)
        res = client.get("/api/v1/quiet-hours")
        assert res.status_code == 403, res.text
        assert res.json()["error"]["code"] == "user_required"
    finally:
        app.dependency_overrides.pop(get_current_context, None)
        app.dependency_overrides.pop(routes_quiet_hours._repo, None)


@pytest.mark.parametrize(
    "hour,expected",
    [
        (23, True),   # inside a wrapping 20->8 window
        (3, True),    # after midnight, still inside
        (8, False),   # end is exclusive
        (12, False),  # midday, outside
        (20, True),   # start is inclusive
    ],
)
def test_is_quiet_midnight_wrap(hour, expected):
    from src.quiet_hours import is_quiet

    prefs = {"enabled": True, "start_hour": 20, "end_hour": 8}
    assert is_quiet(hour, prefs) is expected


def test_is_quiet_disabled_is_never_quiet():
    from src.quiet_hours import is_quiet

    assert is_quiet(23, {"enabled": False, "start_hour": 20, "end_hour": 8}) is False


def test_is_quiet_same_hour_window_is_never_quiet():
    from src.quiet_hours import is_quiet

    assert is_quiet(10, {"enabled": True, "start_hour": 9, "end_hour": 9}) is False


# ── is_quiet_now (decision helper used at the send point) ────────────────────


def test_is_quiet_now_uses_utc_hour():
    from src.quiet_hours import is_quiet_now

    prefs = {"enabled": True, "start_hour": 20, "end_hour": 8}
    assert is_quiet_now(prefs, now=datetime(2026, 1, 1, 23, tzinfo=timezone.utc)) is True
    assert is_quiet_now(prefs, now=datetime(2026, 1, 1, 12, tzinfo=timezone.utc)) is False


def test_is_quiet_now_disabled_is_never_quiet():
    from src.quiet_hours import is_quiet_now

    prefs = {"enabled": False, "start_hour": 0, "end_hour": 23}
    assert is_quiet_now(prefs, now=datetime(2026, 1, 1, 5, tzinfo=timezone.utc)) is False


# ── notify() quiet-hours enforcement at the per-user send point ──────────────


@pytest.mark.asyncio
async def test_notify_skips_quiet_users_when_respected():
    from unittest.mock import MagicMock, patch

    from src.notifications import notify

    db = MagicMock()
    db.store = MagicMock()
    db.store.query_raw = AsyncMock(return_value=[{"id": "n1"}])

    async def fake_quiet(_db, _ws, uid):
        return uid == "sleepy"

    with patch(
        "src.notifications.service._is_user_quiet",
        new=AsyncMock(side_effect=fake_quiet),
    ):
        written = await notify(
            db,
            workspace_id="ws",
            user_ids=["sleepy", "awake"],
            type="mention",
            title="hi",
            respect_quiet_hours=True,
        )
    # Only the awake user gets a row; the quiet one is suppressed.
    assert written == 1
    assert db.store.query_raw.await_count == 1


@pytest.mark.asyncio
async def test_notify_ignores_quiet_hours_by_default():
    from unittest.mock import MagicMock, patch

    from src.notifications import notify

    db = MagicMock()
    db.store = MagicMock()
    db.store.query_raw = AsyncMock(return_value=[{"id": "n1"}])

    with patch("src.notifications.service._is_user_quiet") as guard:
        written = await notify(
            db,
            workspace_id="ws",
            user_ids=["a", "b"],
            type="mention",
            title="hi",
        )
    assert written == 2
    guard.assert_not_called()  # no quiet-hours lookup when not opted in


@pytest.mark.asyncio
async def test_is_user_quiet_fails_open_on_error():
    from unittest.mock import MagicMock, patch

    from src.notifications.service import _is_user_quiet

    with patch(
        "src.quiet_hours.QuietHoursRepo.get",
        new=AsyncMock(side_effect=RuntimeError("prefs unavailable")),
    ):
        # Any lookup failure must resolve to "send" (fail-open), never suppress.
        assert await _is_user_quiet(MagicMock(), "ws", "u1") is False


@pytest.mark.asyncio
async def test_is_user_quiet_delegates_to_prefs():
    from unittest.mock import MagicMock, patch

    from src.notifications.service import _is_user_quiet

    with patch(
        "src.quiet_hours.QuietHoursRepo.get",
        new=AsyncMock(return_value={"enabled": True, "start_hour": 0, "end_hour": 23}),
    ), patch("src.quiet_hours.is_quiet_now", return_value=True):
        assert await _is_user_quiet(MagicMock(), "ws", "u1") is True
