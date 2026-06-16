from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from src.services import ghost_pod_reaper as gpr
from src.services.ghost_pod_reaper import GhostPodReaper
from src.services.meeting_cleanup_service import MeetingCleanupService


def _mock_db(execute_query_return=None, driver="prisma"):
    db = AsyncMock()
    db._driver = driver
    db._connected = True
    db.execute_query = AsyncMock(return_value=execute_query_return or [])
    return db


@pytest.mark.asyncio
@pytest.mark.unit
async def test_cleanup_service_uses_configured_schema(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MEETING_JOINER_SCHEMA", "meeting_joiner")
    db = _mock_db(driver="pg")

    with patch(
        "src.services.meeting_cleanup_service.get_db_connection",
        new=AsyncMock(return_value=db),
    ):
        await MeetingCleanupService()._perform_cleanup()

    sql = db.execute_query.await_args.args[0]
    assert 'FROM "meeting_joiner"."meeting_joiner" m' in sql
    assert 'FROM "meeting_joiner"."meeting_sessions" s' in sql


@pytest.mark.asyncio
@pytest.mark.unit
async def test_cleanup_service_keeps_legacy_prisma_table_names(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MEETING_JOINER_SCHEMA", "meeting_joiner")
    db = _mock_db(driver="prisma")

    with patch(
        "src.services.meeting_cleanup_service.get_db_connection",
        new=AsyncMock(return_value=db),
    ):
        await MeetingCleanupService()._perform_cleanup()

    sql = db.execute_query.await_args.args[0]
    assert "FROM meeting_joiner m" in sql
    assert "FROM meeting_sessions s" in sql
    assert '"meeting_joiner"."meeting_joiner"' not in sql
    assert '"meeting_joiner"."meeting_sessions"' not in sql


@pytest.mark.asyncio
@pytest.mark.unit
async def test_ghost_pod_reaper_uses_configured_schema(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MEETING_JOINER_SCHEMA", "meeting_joiner")
    db = _mock_db(driver="pg")

    with patch(
        "src.services.ghost_pod_reaper.get_db_connection",
        new=AsyncMock(return_value=db),
    ):
        assert await GhostPodReaper()._candidate_meetings() == []

    sql = db.execute_query.await_args.args[0]
    assert 'FROM "meeting_joiner"."meeting_joiner"' in sql


@pytest.mark.asyncio
@pytest.mark.unit
async def test_ghost_pod_reaper_keeps_legacy_prisma_table_name(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MEETING_JOINER_SCHEMA", "meeting_joiner")
    db = _mock_db(driver="prisma")

    with patch(
        "src.services.ghost_pod_reaper.get_db_connection",
        new=AsyncMock(return_value=db),
    ):
        assert await GhostPodReaper()._candidate_meetings() == []

    sql = db.execute_query.await_args.args[0]
    assert "FROM meeting_joiner" in sql
    assert '"meeting_joiner"."meeting_joiner"' not in sql


@pytest.mark.unit
def test_ghost_pod_reaper_namespace_accepts_warm_pool_env(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("MEETING_JOINER_NAMESPACE", raising=False)
    monkeypatch.setenv("MEETING_NAMESPACE", "managed-pods")

    assert gpr._meeting_namespace_from_env() == "managed-pods"


@pytest.mark.unit
def test_ghost_pod_reaper_namespace_prefers_legacy_env(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MEETING_NAMESPACE", "managed-pods")
    monkeypatch.setenv("MEETING_JOINER_NAMESPACE", "legacy-reaper")

    assert gpr._meeting_namespace_from_env() == "legacy-reaper"
