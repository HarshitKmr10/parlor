"""Org-wide Google Workspace calendar sync.

For each ENABLED Google Workspace org:

1. Discover active org users via the Admin SDK Directory (delegated admin).
2. For each user, read upcoming Calendar events (per-user impersonation) that
   carry a Meet/conference link and start within ``CALENDAR_JOIN_LEAD_MINUTES``.
3. Dispatch a bot per event through the SAME unified path the per-user poller
   uses (``dispatch_meeting``), tagging the source ``calendar_event_id`` so a
   re-scan — or the per-user poller — never double-books the same event.

Dedupe coexistence with the per-user poller: both write the Google event id
into ``meeting_joiner.calendar_event_id`` and both skip an event that already
has a row, so a meeting visible to both an org admin's domain-wide read AND a
user who connected their own calendar is only joined once. We additionally
honour ``record.is_duplicate`` (an existing ongoing meeting at the same URL),
exactly like the poller.

Degradation: no enabled org → no-op. The google-api-python-client calls are
synchronous, so they run in ``asyncio.to_thread``. Per-org and per-user errors
are isolated so one bad calendar can't sink the loop. Mirrors
:class:`CalendarPoller` in lifecycle shape.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from shared.config import settings

from ..api.database.connection import get_db_connection
from ..db.python.schema import qualified_name
from ..integrations.google_workspace import (
    DirectoryClient,
    GoogleWorkspaceOrgRepo,
    get_workspace_auth,
)
from ..integrations.google_workspace.auth import (
    CALENDAR_READONLY_SCOPE,
    DIRECTORY_READONLY_SCOPE,
)
from ..observability import get_logger
from ..shared.platformDetector import PlatformDetector
from .calendar_poller import _extract_meeting_url
from .meeting_service import MeetingService

logger = get_logger(__name__)

UTC = timezone.utc
# Cap per-user fan-out so a huge org can't issue thousands of Calendar calls in
# one tick; the next tick picks up where this left off.
_MAX_EVENTS_PER_USER = 25


def _table(db, name: str) -> str:
    return qualified_name(name) if getattr(db, "_driver", None) == "pg" else name


class WorkspaceCalendarSync:
    """Background loop that auto-dispatches bots for org-wide calendar events."""

    def __init__(self) -> None:
        self._task: Optional[asyncio.Task[None]] = None
        self._running = False

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop(), name="workspace-calendar-sync")
        logger.info(
            "workspace_calendar_sync.started",
            interval_s=settings.CALENDAR_POLL_INTERVAL_S,
            lead_minutes=settings.CALENDAR_JOIN_LEAD_MINUTES,
        )

    async def stop(self) -> None:
        self._running = False
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        logger.info("workspace_calendar_sync.stopped")

    async def _loop(self) -> None:
        while self._running:
            try:
                await self.scan_once()
            except asyncio.CancelledError:
                break
            except Exception as exc:  # noqa: BLE001
                logger.warning("workspace_calendar_sync.loop_error", error=str(exc))
            await asyncio.sleep(settings.CALENDAR_POLL_INTERVAL_S)

    async def scan_once(self) -> int:
        """One pass over all enabled orgs. Returns bots dispatched. No-op when
        the feature is disabled or no org is configured."""
        if not settings.GOOGLE_WORKSPACE_ENABLED:
            return 0

        db = await get_db_connection()
        repo = GoogleWorkspaceOrgRepo(db)
        orgs = await repo.list_enabled()
        if not orgs:
            return 0

        dispatched = 0
        for org in orgs:
            try:
                dispatched += await self._scan_org(
                    db, org["workspace_id"], org["auth_config"]
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "workspace_calendar_sync.org_error",
                    workspace_id=org.get("workspace_id"),
                    error=str(exc),
                )
        return dispatched

    async def _scan_org(self, db, workspace_id: str, auth_config) -> int:
        auth = get_workspace_auth(auth_config)
        emails = await self.discover_users(auth_config, auth=auth)
        if not emails:
            return 0

        count = 0
        for email in emails:
            try:
                count += await self._scan_user(db, workspace_id, auth, email)
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "workspace_calendar_sync.user_error",
                    user_email=email,
                    error=str(exc),
                )
        return count

    async def discover_users(self, auth_config, *, auth=None) -> List[str]:
        """List active org users via the Directory client (runs in a thread)."""
        auth = auth or get_workspace_auth(auth_config)
        client = DirectoryClient(auth, scopes=(DIRECTORY_READONLY_SCOPE,))
        return await asyncio.to_thread(
            client.list_active_user_emails,
            domain=auth_config.domain,
            customer_id=auth_config.customer_id,
        )

    async def _scan_user(self, db, workspace_id: str, auth, user_email: str) -> int:
        events = await self._fetch_user_events(auth, user_email)
        count = 0
        for event in events:
            url = _extract_meeting_url(event)
            event_id = event.get("id")
            if not url or not event_id:
                continue
            platform = PlatformDetector.detect_platform(url)
            if platform == "unknown" or not PlatformDetector.is_supported(platform):
                continue
            # Shared dedupe with the per-user poller.
            if await self._already_booked(db, event_id):
                continue
            if await self._dispatch_event(db, workspace_id, url, platform, event_id):
                count += 1
        return count

    async def _fetch_user_events(self, auth, user_email: str) -> List[Dict[str, Any]]:
        """Read a single user's upcoming Calendar events (impersonated)."""
        now = datetime.now(UTC)
        window_end = now + timedelta(minutes=settings.CALENDAR_JOIN_LEAD_MINUTES)

        def _call() -> List[Dict[str, Any]]:
            from googleapiclient.discovery import build  # noqa: PLC0415

            creds = auth.get_user_credentials(user_email, (CALENDAR_READONLY_SCOPE,))
            service = build("calendar", "v3", credentials=creds, cache_discovery=False)
            response = (
                service.events()
                .list(
                    calendarId="primary",
                    timeMin=now.isoformat(),
                    timeMax=window_end.isoformat(),
                    singleEvents=True,
                    orderBy="startTime",
                    maxResults=_MAX_EVENTS_PER_USER,
                )
                .execute()
            ) or {}
            return list(response.get("items") or [])

        return await asyncio.to_thread(_call)

    async def _already_booked(self, db, event_id: str) -> bool:
        table = _table(db, "meeting_joiner")
        rows = await db.store.query_raw(
            f"SELECT 1 FROM {table} WHERE calendar_event_id = $1 LIMIT 1",
            event_id,
        )
        return bool(rows)

    async def _dispatch_event(
        self, db, workspace_id: str, url: str, platform: str, event_id: str
    ) -> bool:
        """Create + dispatch a bot for one calendar event (best effort).

        Identical contract to ``CalendarPoller._dispatch_event``: dedupe on
        ``is_duplicate``, tag the source event id, dispatch via the unified
        ``dispatch_meeting`` path.
        """
        service = MeetingService(db)
        try:
            record = await service.create_meeting(
                meeting_url=url,
                org_id=None,
                bot_name=None,
                transcript_source=None,
                scheduled_at=None,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("workspace_calendar_sync.create_failed", error=str(exc))
            return False

        if getattr(record, "is_duplicate", False):
            return False

        table = _table(db, "meeting_joiner")
        try:
            await db.store.query_raw(
                f"UPDATE {table} SET workspace_id = $1::uuid, "
                f"calendar_event_id = $2, updated_at = NOW() WHERE id = $3::uuid",
                workspace_id,
                event_id,
                str(record.id),
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("workspace_calendar_sync.tag_failed", error=str(exc))

        from ..main import dispatch_meeting, get_queue_service  # noqa: PLC0415

        try:
            queue_service = await get_queue_service()
            await dispatch_meeting(
                meeting_id=str(record.id),
                meeting_url=url,
                platform=platform,
                transcript_source=None,
                bot_name=None,
                org_id=None,
                meeting_service=service,
                queue_service=queue_service,
                allow_on_demand=True,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "workspace_calendar_sync.dispatch_failed",
                meeting_id=str(record.id),
                error=str(exc),
            )
            return False

        logger.info(
            "workspace_calendar_sync.dispatched",
            meeting_id=str(record.id),
            platform=platform,
            calendar_event_id=event_id,
            workspace_id=workspace_id,
        )
        return True

    def get_status(self) -> dict:
        return {
            "running": self._running,
            "enabled": settings.GOOGLE_WORKSPACE_ENABLED,
            "interval_s": settings.CALENDAR_POLL_INTERVAL_S,
            "lead_minutes": settings.CALENDAR_JOIN_LEAD_MINUTES,
        }


_singleton: Optional[WorkspaceCalendarSync] = None


def get_workspace_calendar_sync() -> WorkspaceCalendarSync:
    global _singleton
    if _singleton is None:
        _singleton = WorkspaceCalendarSync()
    return _singleton


async def close_workspace_calendar_sync() -> None:
    global _singleton
    if _singleton is not None:
        await _singleton.stop()
        _singleton = None
