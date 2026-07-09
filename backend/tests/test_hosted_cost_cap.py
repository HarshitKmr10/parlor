"""Tests for the opt-in hosted-instance LLM spend cap (`src/quota/cost_*`).

This guardrail is for the small public hosted deployment only, separate from
the existing meeting-count quota: a workspace under its meeting cap could
still make unlimited summarize/ask calls, and creating extra workspaces could
evade a per-workspace-only cap. Self-hosters never set
`HOSTED_COST_CAP_ENABLED` and must see zero behavior change. Covers:
  (a) disabled by default -> guard always succeeds, no DB query issued
  (b) config fail-fast: enabling with neither cap set raises; either cap
      alone is valid
  (c) per-workspace cap enforcement
  (d) global cap enforcement even when the calling workspace is itself under
      its own per-workspace cap (the multi-workspace evasion this closes)
  (e) route-level wiring at all three ai-service call sites: meeting
      summarize, meeting-scoped ask, workspace-wide ask
"""

from __future__ import annotations

import os
from contextlib import contextmanager
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.api.models.schemas import MeetingRecord, MeetingStatus
from src.api.product import routes_ask, routes_meetings
from src.api.product.errors import ApiError
from src.api.product.schemas import AskRequest, Workspace
from src.quota.cost_config import HostedCostCapMisconfigured, get_hosted_cost_cap_config
from src.quota.cost_guard import enforce_cost_cap

UTC = timezone.utc

ENV_KEYS = [
    "HOSTED_COST_CAP_ENABLED",
    "HOSTED_COST_CAP_MAX_USD_PER_WORKSPACE",
    "HOSTED_COST_CAP_MAX_USD_GLOBAL",
]


@pytest.fixture(autouse=True)
def _clean_env():
    saved = {k: os.environ.get(k) for k in ENV_KEYS}
    for k in ENV_KEYS:
        os.environ.pop(k, None)
    yield
    for k, v in saved.items():
        if v is None:
            os.environ.pop(k, None)
        else:
            os.environ[k] = v


def _totals(spent: float) -> dict:
    return {"total_tokens": 0, "estimated_cost_usd": spent, "call_count": 1}


@contextmanager
def _patched_repo(*, workspace_spent: float = 0.0, global_spent: float = 0.0):
    instance = MagicMock()
    instance.get_totals = AsyncMock(return_value=_totals(workspace_spent))
    instance.get_global_total = AsyncMock(return_value=_totals(global_spent))
    with patch(
        "src.quota.cost_guard.LlmUsageRepo", return_value=instance
    ) as repo_cls:
        yield repo_cls, instance


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
    repo = AsyncMock()
    repo.get_scoped.return_value = {"id": "m-1", "title": "Standup"}
    repo.store_insights.return_value = None
    return service, repo


# ── config parsing ──────────────────────────────────────────────────────────


def test_disabled_by_default_when_env_unset():
    config = get_hosted_cost_cap_config()
    assert config.enabled is False
    assert config.max_usd_per_workspace is None
    assert config.max_usd_global is None


def test_enabled_with_neither_cap_fails_fast():
    os.environ["HOSTED_COST_CAP_ENABLED"] = "true"
    with pytest.raises(HostedCostCapMisconfigured):
        get_hosted_cost_cap_config()


def test_enabled_with_only_per_workspace_cap_is_allowed():
    os.environ["HOSTED_COST_CAP_ENABLED"] = "true"
    os.environ["HOSTED_COST_CAP_MAX_USD_PER_WORKSPACE"] = "10"
    config = get_hosted_cost_cap_config()
    assert config.enabled is True
    assert config.max_usd_per_workspace == 10
    assert config.max_usd_global is None


def test_enabled_with_only_global_cap_is_allowed():
    os.environ["HOSTED_COST_CAP_ENABLED"] = "true"
    os.environ["HOSTED_COST_CAP_MAX_USD_GLOBAL"] = "500"
    config = get_hosted_cost_cap_config()
    assert config.enabled is True
    assert config.max_usd_per_workspace is None
    assert config.max_usd_global == 500


def test_enabled_with_non_numeric_cap_fails_fast():
    os.environ["HOSTED_COST_CAP_ENABLED"] = "true"
    os.environ["HOSTED_COST_CAP_MAX_USD_PER_WORKSPACE"] = "not-a-number"
    with pytest.raises(HostedCostCapMisconfigured):
        get_hosted_cost_cap_config()


def test_enabled_with_zero_cap_fails_fast():
    os.environ["HOSTED_COST_CAP_ENABLED"] = "true"
    os.environ["HOSTED_COST_CAP_MAX_USD_GLOBAL"] = "0"
    with pytest.raises(HostedCostCapMisconfigured):
        get_hosted_cost_cap_config()


# ── enforce_cost_cap (guard) ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_guard_is_noop_and_issues_no_query_when_disabled():
    with patch("src.quota.cost_guard.LlmUsageRepo") as repo_cls:
        await enforce_cost_cap(db=object(), workspace_id="ws-1")
    repo_cls.assert_not_called()


@pytest.mark.asyncio
async def test_guard_allows_when_under_both_caps():
    os.environ["HOSTED_COST_CAP_ENABLED"] = "true"
    os.environ["HOSTED_COST_CAP_MAX_USD_PER_WORKSPACE"] = "10"
    os.environ["HOSTED_COST_CAP_MAX_USD_GLOBAL"] = "500"
    with _patched_repo(workspace_spent=5.0, global_spent=100.0):
        await enforce_cost_cap(db=object(), workspace_id="ws-1")  # no raise


@pytest.mark.asyncio
async def test_guard_blocks_at_per_workspace_cap():
    os.environ["HOSTED_COST_CAP_ENABLED"] = "true"
    os.environ["HOSTED_COST_CAP_MAX_USD_PER_WORKSPACE"] = "10"
    with _patched_repo(workspace_spent=10.0):
        with pytest.raises(ApiError) as exc_info:
            await enforce_cost_cap(db=object(), workspace_id="ws-1")
    err = exc_info.value
    assert err.status_code == 429
    assert err.code == "cost_cap_exceeded"
    assert "self-host" in err.message.lower()
    envelope = err.envelope()
    assert envelope["error"]["code"] == "cost_cap_exceeded"
    assert envelope["error"]["details"]["scope"] == "workspace"
    assert envelope["error"]["details"]["limitUsd"] == 10


@pytest.mark.asyncio
async def test_guard_blocks_when_global_cap_exceeded_even_if_workspace_under_its_own_cap():
    os.environ["HOSTED_COST_CAP_ENABLED"] = "true"
    os.environ["HOSTED_COST_CAP_MAX_USD_PER_WORKSPACE"] = "1000"
    os.environ["HOSTED_COST_CAP_MAX_USD_GLOBAL"] = "50"
    with _patched_repo(workspace_spent=1.0, global_spent=50.0):
        with pytest.raises(ApiError) as exc_info:
            await enforce_cost_cap(db=object(), workspace_id="ws-1")
    err = exc_info.value
    assert err.status_code == 429
    assert err.code == "cost_cap_exceeded"
    assert err.details["scope"] == "global"


@pytest.mark.asyncio
async def test_guard_global_only_config_still_blocks_low_spend_workspace():
    os.environ["HOSTED_COST_CAP_ENABLED"] = "true"
    os.environ["HOSTED_COST_CAP_MAX_USD_GLOBAL"] = "50"
    with _patched_repo(workspace_spent=0.01, global_spent=50.0) as (repo_cls, instance):
        with pytest.raises(ApiError):
            await enforce_cost_cap(db=object(), workspace_id="ws-1")
    instance.get_totals.assert_not_called()  # only global cap configured
    instance.get_global_total.assert_called_once()


# ── route wiring: summarize_meeting / ask_meeting / ask_workspace ──────────


class TestSummarizeMeetingRouteCostCap:
    @pytest.mark.asyncio
    async def test_disabled_by_default_summarize_succeeds_with_no_cost_query(self):
        service, repo = _service_and_repo()
        with patch("src.quota.cost_guard.LlmUsageRepo") as repo_cls, patch.object(
            routes_meetings.ai_client, "summarize", new=AsyncMock(return_value={})
        ):
            insights = await routes_meetings.summarize_meeting(
                meeting_id="m-1",
                template_id=None,
                workspace=_workspace(),
                service=service,
                repo=repo,
                db=AsyncMock(),
            )
        repo_cls.assert_not_called()
        assert insights is not None

    @pytest.mark.asyncio
    async def test_enabled_over_workspace_cap_blocks_before_ai_service_call(self):
        os.environ["HOSTED_COST_CAP_ENABLED"] = "true"
        os.environ["HOSTED_COST_CAP_MAX_USD_PER_WORKSPACE"] = "5"
        service, repo = _service_and_repo()
        with _patched_repo(workspace_spent=5.0), patch.object(
            routes_meetings.ai_client, "summarize", new=AsyncMock(return_value={})
        ) as summarize_mock:
            with pytest.raises(ApiError) as exc_info:
                await routes_meetings.summarize_meeting(
                    meeting_id="m-1",
                    template_id=None,
                    workspace=_workspace(),
                    service=service,
                    repo=repo,
                    db=AsyncMock(),
                )
        assert exc_info.value.status_code == 429
        summarize_mock.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_over_global_cap_blocks_even_when_workspace_under_its_cap(self):
        os.environ["HOSTED_COST_CAP_ENABLED"] = "true"
        os.environ["HOSTED_COST_CAP_MAX_USD_PER_WORKSPACE"] = "1000"
        os.environ["HOSTED_COST_CAP_MAX_USD_GLOBAL"] = "50"
        service, repo = _service_and_repo()
        with _patched_repo(workspace_spent=0.5, global_spent=50.0), patch.object(
            routes_meetings.ai_client, "summarize", new=AsyncMock(return_value={})
        ) as summarize_mock:
            with pytest.raises(ApiError) as exc_info:
                await routes_meetings.summarize_meeting(
                    meeting_id="m-1",
                    template_id=None,
                    workspace=_workspace(),
                    service=service,
                    repo=repo,
                    db=AsyncMock(),
                )
        assert exc_info.value.status_code == 429
        assert exc_info.value.details["scope"] == "global"
        summarize_mock.assert_not_awaited()


class TestAskMeetingRouteCostCap:
    @pytest.mark.asyncio
    async def test_disabled_by_default_ask_meeting_succeeds_with_no_cost_query(self):
        service, repo = _service_and_repo()
        with patch("src.quota.cost_guard.LlmUsageRepo") as repo_cls, patch.object(
            routes_meetings.ai_client,
            "chat",
            new=AsyncMock(return_value={"answer": "ok", "citations": []}),
        ):
            resp = await routes_meetings.ask_meeting(
                meeting_id="m-1",
                body=AskRequest(question="What happened?"),
                workspace=_workspace(),
                service=service,
                repo=repo,
                db=AsyncMock(),
            )
        repo_cls.assert_not_called()
        assert resp.answer == "ok"

    @pytest.mark.asyncio
    async def test_enabled_over_workspace_cap_blocks_ask_meeting(self):
        os.environ["HOSTED_COST_CAP_ENABLED"] = "true"
        os.environ["HOSTED_COST_CAP_MAX_USD_PER_WORKSPACE"] = "5"
        service, repo = _service_and_repo()
        with _patched_repo(workspace_spent=5.0), patch.object(
            routes_meetings.ai_client, "chat", new=AsyncMock()
        ) as chat_mock:
            with pytest.raises(ApiError) as exc_info:
                await routes_meetings.ask_meeting(
                    meeting_id="m-1",
                    body=AskRequest(question="What happened?"),
                    workspace=_workspace(),
                    service=service,
                    repo=repo,
                    db=AsyncMock(),
                )
        assert exc_info.value.status_code == 429
        chat_mock.assert_not_awaited()


class TestAskWorkspaceRouteCostCap:
    @pytest.mark.asyncio
    async def test_disabled_by_default_ask_workspace_succeeds_with_no_cost_query(self):
        repo = AsyncMock()
        with patch("src.quota.cost_guard.LlmUsageRepo") as repo_cls, patch.object(
            routes_ask.ai_client,
            "chat",
            new=AsyncMock(return_value={"answer": "ok", "citations": []}),
        ):
            resp = await routes_ask.ask_workspace(
                body=AskRequest(question="Who owns billing?"),
                workspace=_workspace(),
                repo=repo,
                db=AsyncMock(),
            )
        repo_cls.assert_not_called()
        assert resp.answer == "ok"

    @pytest.mark.asyncio
    async def test_enabled_over_workspace_cap_blocks_ask_workspace(self):
        os.environ["HOSTED_COST_CAP_ENABLED"] = "true"
        os.environ["HOSTED_COST_CAP_MAX_USD_PER_WORKSPACE"] = "5"
        repo = AsyncMock()
        with _patched_repo(workspace_spent=5.0), patch.object(
            routes_ask.ai_client, "chat", new=AsyncMock()
        ) as chat_mock:
            with pytest.raises(ApiError) as exc_info:
                await routes_ask.ask_workspace(
                    body=AskRequest(question="Who owns billing?"),
                    workspace=_workspace(),
                    repo=repo,
                    db=AsyncMock(),
                )
        assert exc_info.value.status_code == 429
        chat_mock.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_over_global_cap_blocks_ask_workspace_even_when_workspace_under_its_cap(
        self,
    ):
        os.environ["HOSTED_COST_CAP_ENABLED"] = "true"
        os.environ["HOSTED_COST_CAP_MAX_USD_PER_WORKSPACE"] = "1000"
        os.environ["HOSTED_COST_CAP_MAX_USD_GLOBAL"] = "50"
        repo = AsyncMock()
        with _patched_repo(workspace_spent=0.5, global_spent=50.0), patch.object(
            routes_ask.ai_client, "chat", new=AsyncMock()
        ) as chat_mock:
            with pytest.raises(ApiError) as exc_info:
                await routes_ask.ask_workspace(
                    body=AskRequest(question="Who owns billing?"),
                    workspace=_workspace(),
                    repo=repo,
                    db=AsyncMock(),
                )
        assert exc_info.value.status_code == 429
        assert exc_info.value.details["scope"] == "global"
        chat_mock.assert_not_awaited()
