"""Calendar poller — auto-join upcoming meetings for connected calendars.

Every ``CALENDAR_POLL_INTERVAL_S`` seconds it:

1. Loads connected calendar accounts with ``auto_join = TRUE`` (tokens
   decrypted via Fernet).
2. For each, queries the provider's calendar API for events starting within
   ``CALENDAR_JOIN_LEAD_MINUTES`` that carry a joinable meeting URL.
3. Dispatches a bot per event, recording the source ``calendar_event_id`` so a
   later scan never double-books the same event.

Degradation: if no calendar credentials are configured, the poller no-ops
quietly. Per-account and per-event errors are isolated so one bad calendar
can't sink the loop. Mirrors :class:`MeetingScheduler` in lifecycle shape.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx

from shared.config import settings

from ..api.database.connection import get_db_connection
from ..api.product import calendar_oauth
from ..api.product.calendar_repo import CalendarRepo
from ..db.python.schema import qualified_name
from ..observability import get_logger
from ..shared.platformDetector import PlatformDetector
from .meeting_service import MeetingService

logger = get_logger(__name__)

UTC = timezone.utc
_HTTP_TIMEOUT = httpx.Timeout(15.0, connect=5.0)


def _table(db, name: str) -> str:
    return qualified_name(name) if getattr(db, "_driver", None) == "pg" else name


class CalendarPoller:
    """Background loop that auto-dispatches bots for upcoming calendar events."""

    def __init__(self) -> None:
        self._task: Optional[asyncio.Task[None]] = None
        self._running = False

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop(), name="calendar-poller")
        logger.info(
            "calendar_poller.started",
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
        logger.info("calendar_poller.stopped")

    async def _loop(self) -> None:
        while self._running:
            try:
                await self.scan_once()
            except asyncio.CancelledError:
                break
            except Exception as exc:  # noqa: BLE001
                logger.warning("calendar_poller.loop_error", error=str(exc))
            await asyncio.sleep(settings.CALENDAR_POLL_INTERVAL_S)

    @staticmethod
    def _any_provider_configured() -> bool:
        for name in ("google", "microsoft"):
            cfg = calendar_oauth.get_provider(name)
            if cfg is not None and cfg.configured:
                return True
        return False

    async def scan_once(self) -> int:
        """One pass. Returns number of bots dispatched. No-op if unconfigured."""
        if not self._any_provider_configured():
            # No OAuth creds → there can be no usable connected accounts.
            return 0

        db = await get_db_connection()
        repo = CalendarRepo(db)
        accounts = await repo.list_auto_join_accounts()
        if not accounts:
            return 0

        dispatched = 0
        for account in accounts:
            try:
                dispatched += await self._scan_account(db, account)
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "calendar_poller.account_error",
                    account_id=str(account.get("id")),
                    error=str(exc),
                )
        return dispatched

    async def _scan_account(self, db, account: Dict[str, Any]) -> int:
        access_token = account.get("access_token")
        if not access_token:
            return 0
        provider = account.get("provider")
        workspace_id = str(account.get("workspace_id"))

        events = await self._fetch_upcoming_events(provider, access_token)
        count = 0
        for event in events:
            url = _extract_meeting_url(event)
            event_id = event.get("id")
            if not url or not event_id:
                continue
            platform = PlatformDetector.detect_platform(url)
            if platform == "unknown" or not PlatformDetector.is_supported(platform):
                continue
            if await self._already_booked(db, event_id):
                continue
            ok = await self._dispatch_event(
                db, workspace_id, url, platform, event_id
            )
            if ok:
                count += 1
        return count

    async def _fetch_upcoming_events(
        self, provider: Optional[str], access_token: str
    ) -> List[Dict[str, Any]]:
        now = datetime.now(UTC)
        window_end = now + timedelta(minutes=settings.CALENDAR_JOIN_LEAD_MINUTES)
        try:
            if provider == "google":
                return await self._fetch_google(access_token, now, window_end)
            if provider == "microsoft":
                return await self._fetch_microsoft(access_token, now, window_end)
        except httpx.HTTPError as exc:
            logger.warning(
                "calendar_poller.fetch_error", provider=provider, error=str(exc)
            )
        return []

    async def _fetch_google(
        self, access_token: str, start: datetime, end: datetime
    ) -> List[Dict[str, Any]]:
        params = {
            "timeMin": start.isoformat(),
            "timeMax": end.isoformat(),
            "singleEvents": "true",
            "orderBy": "startTime",
            "maxResults": "25",
        }
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
            resp = await client.get(
                "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                params=params,
                headers={"Authorization": f"Bearer {access_token}"},
            )
        resp.raise_for_status()
        return list(resp.json().get("items") or [])

    async def _fetch_microsoft(
        self, access_token: str, start: datetime, end: datetime
    ) -> List[Dict[str, Any]]:
        params = {
            "startDateTime": start.isoformat(),
            "endDateTime": end.isoformat(),
            "$top": "25",
        }
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
            resp = await client.get(
                "https://graph.microsoft.com/v1.0/me/calendarView",
                params=params,
                headers={"Authorization": f"Bearer {access_token}"},
            )
        resp.raise_for_status()
        return list(resp.json().get("value") or [])

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
        """Create + dispatch a bot for one calendar event (best effort)."""
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
            logger.warning("calendar_poller.create_failed", error=str(exc))
            return False

        # Duplicate (already in an ongoing meeting at this URL) → don't re-dispatch.
        if getattr(record, "is_duplicate", False):
            return False

        # Tag workspace + the source event id (dedupe marker).
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
            logger.warning("calendar_poller.tag_failed", error=str(exc))

        # Reuse the unified standalone dispatch path.
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
                "calendar_poller.dispatch_failed",
                meeting_id=str(record.id),
                error=str(exc),
            )
            return False

        logger.info(
            "calendar_poller.dispatched",
            meeting_id=str(record.id),
            platform=platform,
            calendar_event_id=event_id,
        )
        return True

    def get_status(self) -> dict:
        return {
            "running": self._running,
            "interval_s": settings.CALENDAR_POLL_INTERVAL_S,
            "lead_minutes": settings.CALENDAR_JOIN_LEAD_MINUTES,
        }


def _extract_meeting_url(event: Dict[str, Any]) -> Optional[str]:
    """Pull a joinable meeting URL out of a Google/Microsoft event."""
    # Google: hangoutLink, or conferenceData.entryPoints[].uri, or location.
    link = event.get("hangoutLink")
    if link:
        return link
    conf = event.get("conferenceData") or {}
    for ep in conf.get("entryPoints") or []:
        uri = ep.get("uri")
        if uri and PlatformDetector.detect_platform(uri) != "unknown":
            return uri
    # Microsoft Graph: onlineMeeting.joinUrl.
    online = event.get("onlineMeeting") or {}
    if online.get("joinUrl"):
        return online["joinUrl"]
    # Fallback: scan location / body for a known URL.
    for field in ("location", "body"):
        value = event.get(field)
        text = ""
        if isinstance(value, dict):
            text = str(value.get("displayName") or value.get("content") or "")
        elif isinstance(value, str):
            text = value
        for token in text.replace("<", " ").replace(">", " ").split():
            if token.startswith("http") and PlatformDetector.detect_platform(token) != "unknown":
                return token
    return None


_singleton: Optional[CalendarPoller] = None


def get_calendar_poller() -> CalendarPoller:
    global _singleton
    if _singleton is None:
        _singleton = CalendarPoller()
    return _singleton


async def close_calendar_poller() -> None:
    global _singleton
    if _singleton is not None:
        await _singleton.stop()
        _singleton = None
