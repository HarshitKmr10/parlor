"""Tests for the opt-in hosted-instance meeting quota (`src/quota`).

This guardrail is for the small public hosted deployment only; self-hosters
never set `HOSTED_QUOTA_ENABLED` and must see zero behavior change. Covers:
  (a) disabled by default -> route-level create always succeeds regardless
      of existing meeting count, and no DB count query is even issued
  (b) enabled, under the cap -> succeeds
  (c) enabled, at/over the cap -> 429 quota_exceeded via the API-CONTRACT
      error envelope
  (d) per-workspace scoping -> workspace A at its cap doesn't block workspace B
  (e) config parsing -> enabling without an explicit cap fails fast
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

from src.api.models.schemas import MeetingRecord, MeetingStatus
from src.api.product import routes_meetings
from src.api.product.errors import ApiError
from src.api.product.schemas import BotlessCreateRequest, MeetingCreateRequest, Workspace
from src.quota.config import HostedQuotaMisconfigured, get_hosted_quota_config
from src.quota.guard import enforce_meeting_quota

UTC = timezone.utc


def _workspace(ws_id: str = "ws-1") -> Workspace:
    return Workspace(id=ws_id, name="Acme", slug="acme", role="owner")


def _record() -> MeetingRecord:
    base = datetime(2026, 7, 9, 10, 0, 0, tzinfo=UTC)
    return MeetingRecord(
        id="m-1",
        meeting_url="https://teams.microsoft.com/meet/m-1",
        status=MeetingStatus.NOT_JOINED,
        platform="msteams",
        org_id=None,
        bot_name="Meeting Bot",
        is_duplicate=False,
        original_meeting_id=None,
        created_at=base,
        updated_at=base,
    )


def _service_and_repo():
    service = AsyncMock()
    service.get_meeting_by_id.return_value = _record()
    service.create_meeting.return_value = _record()
    repo = AsyncMock()
    repo.get_scoped.return_value = {"id": "m-1", "title": "Standup"}
    return service, repo


@pytest.fixture(autouse=True)
def _clean_env():
    keys = ["HOSTED_QUOTA_ENABLED", "HOSTED_QUOTA_MAX_TOTAL_MEETINGS"]
    saved = {k: os.environ.get(k) for k in keys}
    for k in keys:
        os.environ.pop(k, None)
    yield
    for k, v in saved.items():
        if v is None:
            os.environ.pop(k, None)
        else:
            os.environ[k] = v


# ── config parsing ──────────────────────────────────────────────────────────


def test_disabled_by_default_when_env_unset():
    config = get_hosted_quota_config()
    assert config.enabled is False
    assert config.max_total_meetings is None


def test_enabled_without_explicit_cap_fails_fast():
    os.environ["HOSTED_QUOTA_ENABLED"] = "true"
    with pytest.raises(HostedQuotaMisconfigured):
        get_hosted_quota_config()


def test_enabled_with_non_integer_cap_fails_fast():
    os.environ["HOSTED_QUOTA_ENABLED"] = "true"
    os.environ["HOSTED_QUOTA_MAX_TOTAL_MEETINGS"] = "not-a-number"
    with pytest.raises(HostedQuotaMisconfigured):
        get_hosted_quota_config()


def test_enabled_with_explicit_cap_parses():
    os.environ["HOSTED_QUOTA_ENABLED"] = "true"
    os.environ["HOSTED_QUOTA_MAX_TOTAL_MEETINGS"] = "20"
    config = get_hosted_quota_config()
    assert config.enabled is True
    assert config.max_total_meetings == 20


# ── enforce_meeting_quota (guard) ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_guard_is_noop_and_issues_no_query_when_disabled():
    with patch("src.quota.guard.count_workspace_meetings") as count_fn:
        await enforce_meeting_quota(db=object(), workspace_id="ws-1")
    count_fn.assert_not_called()


@pytest.mark.asyncio
async def test_guard_allows_when_under_cap():
    os.environ["HOSTED_QUOTA_ENABLED"] = "true"
    os.environ["HOSTED_QUOTA_MAX_TOTAL_MEETINGS"] = "20"
    with patch(
        "src.quota.guard.count_workspace_meetings", new=AsyncMock(return_value=19)
    ):
        await enforce_meeting_quota(db=object(), workspace_id="ws-1")  # no raise


@pytest.mark.asyncio
async def test_guard_blocks_at_cap_with_429_and_clear_message():
    os.environ["HOSTED_QUOTA_ENABLED"] = "true"
    os.environ["HOSTED_QUOTA_MAX_TOTAL_MEETINGS"] = "20"
    with patch(
        "src.quota.guard.count_workspace_meetings", new=AsyncMock(return_value=20)
    ):
        with pytest.raises(ApiError) as exc_info:
            await enforce_meeting_quota(db=object(), workspace_id="ws-1")
    err = exc_info.value
    assert err.status_code == 429
    assert err.code == "quota_exceeded"
    assert "self-host" in err.message.lower()
    envelope = err.envelope()
    assert envelope["error"]["code"] == "quota_exceeded"
    assert envelope["error"]["details"]["limit"] == 20


@pytest.mark.asyncio
async def test_guard_blocks_over_cap():
    os.environ["HOSTED_QUOTA_ENABLED"] = "true"
    os.environ["HOSTED_QUOTA_MAX_TOTAL_MEETINGS"] = "20"
    with patch(
        "src.quota.guard.count_workspace_meetings", new=AsyncMock(return_value=21)
    ):
        with pytest.raises(ApiError):
            await enforce_meeting_quota(db=object(), workspace_id="ws-1")


@pytest.mark.asyncio
async def test_guard_scopes_cap_per_workspace():
    os.environ["HOSTED_QUOTA_ENABLED"] = "true"
    os.environ["HOSTED_QUOTA_MAX_TOTAL_MEETINGS"] = "5"

    async def fake_count(_db, workspace_id):
        return {"ws-a": 5, "ws-b": 0}[workspace_id]

    with patch("src.quota.guard.count_workspace_meetings", new=fake_count):
        with pytest.raises(ApiError):
            await enforce_meeting_quota(db=object(), workspace_id="ws-a")
        await enforce_meeting_quota(db=object(), workspace_id="ws-b")  # no raise


# ── route wiring: create_meeting / create_botless_meeting ──────────────────


class TestCreateMeetingRouteQuota:
    @pytest.mark.asyncio
    async def test_disabled_by_default_create_always_succeeds(self):
        service, repo = _service_and_repo()
        with patch.object(
            routes_meetings, "enforce_meeting_quota", wraps=enforce_meeting_quota
        ) as guard, patch(
            "src.quota.guard.count_workspace_meetings"
        ) as count_fn, patch.object(
            routes_meetings.PlatformDetector, "detect_platform", return_value="msteams"
        ), patch.object(
            routes_meetings.PlatformDetector, "is_supported", return_value=True
        ):
            body = MeetingCreateRequest(meetingUrl="https://teams.microsoft.com/meet/x")
            result = await routes_meetings.create_meeting(
                body, _workspace(), service, repo, db=object()
            )
        guard.assert_awaited_once()
        count_fn.assert_not_called()
        assert result.id == "m-1"

    @pytest.mark.asyncio
    async def test_enabled_over_cap_blocks_before_meeting_service_is_called(self):
        os.environ["HOSTED_QUOTA_ENABLED"] = "true"
        os.environ["HOSTED_QUOTA_MAX_TOTAL_MEETINGS"] = "3"
        service, repo = _service_and_repo()
        with patch(
            "src.quota.guard.count_workspace_meetings", new=AsyncMock(return_value=3)
        ):
            body = MeetingCreateRequest(meetingUrl="https://teams.microsoft.com/meet/x")
            with pytest.raises(ApiError) as exc_info:
                await routes_meetings.create_meeting(
                    body, _workspace(), service, repo, db=object()
                )
        assert exc_info.value.status_code == 429
        service.create_meeting.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_enabled_under_cap_succeeds(self):
        os.environ["HOSTED_QUOTA_ENABLED"] = "true"
        os.environ["HOSTED_QUOTA_MAX_TOTAL_MEETINGS"] = "3"
        service, repo = _service_and_repo()
        with patch(
            "src.quota.guard.count_workspace_meetings", new=AsyncMock(return_value=2)
        ), patch.object(
            routes_meetings.PlatformDetector, "detect_platform", return_value="msteams"
        ), patch.object(
            routes_meetings.PlatformDetector, "is_supported", return_value=True
        ):
            body = MeetingCreateRequest(meetingUrl="https://teams.microsoft.com/meet/x")
            result = await routes_meetings.create_meeting(
                body, _workspace(), service, repo, db=object()
            )
        service.create_meeting.assert_awaited_once()
        assert result.id == "m-1"


class TestCreateBotlessMeetingRouteQuota:
    @pytest.mark.asyncio
    async def test_disabled_by_default_botless_create_always_succeeds(self):
        service, repo = _service_and_repo()
        with patch("src.quota.guard.count_workspace_meetings") as count_fn:
            body = BotlessCreateRequest(title="Standup")
            result = await routes_meetings.create_botless_meeting(
                body, _workspace(), service, repo, db=object()
            )
        count_fn.assert_not_called()
        assert result.id == "m-1"

    @pytest.mark.asyncio
    async def test_enabled_over_cap_blocks_botless_create(self):
        os.environ["HOSTED_QUOTA_ENABLED"] = "true"
        os.environ["HOSTED_QUOTA_MAX_TOTAL_MEETINGS"] = "1"
        service, repo = _service_and_repo()
        with patch(
            "src.quota.guard.count_workspace_meetings", new=AsyncMock(return_value=1)
        ):
            body = BotlessCreateRequest(title="Standup")
            with pytest.raises(ApiError) as exc_info:
                await routes_meetings.create_botless_meeting(
                    body, _workspace(), service, repo, db=object()
                )
        assert exc_info.value.status_code == 429
        service.create_meeting.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_botless_create_scoped_per_workspace(self):
        os.environ["HOSTED_QUOTA_ENABLED"] = "true"
        os.environ["HOSTED_QUOTA_MAX_TOTAL_MEETINGS"] = "1"
        service_a, repo_a = _service_and_repo()
        service_b, repo_b = _service_and_repo()

        async def fake_count(_db, workspace_id):
            return {"ws-a": 1, "ws-b": 0}[workspace_id]

        with patch("src.quota.guard.count_workspace_meetings", new=fake_count):
            with pytest.raises(ApiError):
                await routes_meetings.create_botless_meeting(
                    BotlessCreateRequest(title="A"),
                    _workspace("ws-a"),
                    service_a,
                    repo_a,
                    db=object(),
                )
            result_b = await routes_meetings.create_botless_meeting(
                BotlessCreateRequest(title="B"),
                _workspace("ws-b"),
                service_b,
                repo_b,
                db=object(),
            )
        assert result_b.id == "m-1"
        service_b.create_meeting.assert_awaited_once()
