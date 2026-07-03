"""Database connection facade for meeting-joiner.

Originally a thick wrapper around the Prisma client. Now a thin shim
that delegates to the pluggable Store at ``src.db.python`` so the same
class signature works on both the Prisma adapter (monorepo default)
and the raw-asyncpg adapter (standalone).

External callers should prefer ``self.store`` for new code. The
``self.prisma`` attribute is preserved for backward compatibility when
``MEETING_JOINER_DB_DRIVER=prisma``; with the pg adapter it raises a
clear error pointing to ``self.store``.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from shared.exceptions import DatabaseError
from shared.url_normalizer import UrlNormalizer

from ...db.python.store import create_store, DEFAULT_DRIVER
from ...db.python.schema import qualified_name
from ..models.schemas import MeetingRecord, MeetingStatus

logger = logging.getLogger(__name__)

_STATUS_TO_DB = {
    MeetingStatus.NOT_JOINED: "not_joined",
    MeetingStatus.SCHEDULED: "scheduled",
    MeetingStatus.JOINING: "joining",
    MeetingStatus.ONGOING: "ongoing",
    MeetingStatus.INTERRUPTED: "interrupted",
    MeetingStatus.COMPLETED: "completed",
    MeetingStatus.FAILED: "failed",
}
_STATUS_FROM_DB = {v: k for k, v in _STATUS_TO_DB.items()}


class _PrismaUnavailable:
    """Stand-in for ``self.prisma`` in pg-driver mode.

    Any attribute access surfaces a clear error pointing the caller at
    ``self.store`` (the new gateway) instead of letting them get a None-
    attribute crash deep in execution.
    """

    def __getattr__(self, item: str) -> Any:
        raise AttributeError(
            "self.prisma is not available with MEETING_JOINER_DB_DRIVER=pg; "
            "use self.store.<method>() instead. "
            f"Attempted to access self.prisma.{item}."
        )


class DatabaseConnection:
    """Backward-compatible facade. Methods preserved for existing callers."""

    def __init__(self) -> None:
        import os

        self._driver = (
            os.environ.get("MEETING_JOINER_DB_DRIVER") or DEFAULT_DRIVER
        ).lower()
        self.store = create_store(self._driver)
        self._connected = False
        # self.prisma is populated lazily on connect() when driver=prisma.
        # In pg mode it's a stand-in that fails informatively.
        self.prisma: Any = _PrismaUnavailable() if self._driver != "prisma" else None

    async def connect(self) -> None:
        try:
            await self.store.connect()
            self._connected = True
            if self._driver == "prisma":
                # Expose the underlying Prisma client so legacy call sites
                # that reach for self.prisma.* keep working until they're
                # migrated to self.store.
                self.prisma = getattr(self.store, "_prisma", None) or self.store
            logger.info("Database connection established (driver=%s)", self._driver)
        except Exception as e:
            logger.error("Failed to connect to database: %s", e)
            raise DatabaseError(f"Database connection failed: {e}")

    async def disconnect(self) -> None:
        try:
            await self.store.disconnect()
            self._connected = False
            logger.info("Database connection closed")
        except Exception as e:  # noqa: BLE001
            logger.error("Error disconnecting from database: %s", e)

    async def _ensure_connected(self) -> None:
        if not self._connected:
            await self.connect()

    async def execute_query(self, query: str, *params: Any) -> Any:
        await self._ensure_connected()
        try:
            return await self.store.query_raw(query, *params)
        except Exception as e:
            logger.error("Query execution failed: %s", e)
            raise DatabaseError(f"Query failed: {e}")

    async def execute_one(self, query: str, *params: Any) -> Optional[dict]:
        """Return first row or None. Used by sessions_repo (PR #3592)."""
        rows = await self.execute_query(query, *params)
        if not rows:
            return None
        return rows[0]

    async def execute(self, query: str, *params: Any) -> None:
        """Fire-and-forget write. Used by sessions_repo for UPDATEs that
        don't need a returned row."""
        await self._ensure_connected()
        try:
            await self.store.query_raw(query, *params)
        except Exception as e:
            logger.error("Query execution failed: %s", e)
            raise DatabaseError(f"Query failed: {e}")

    async def find_existing_ongoing_meeting(
        self, normalized_url: str, org_id: Optional[str] = None
    ) -> Optional[Any]:
        await self._ensure_connected()
        try:
            return await self.store.find_existing_ongoing(normalized_url, org_id)
        except Exception as e:
            logger.error("Failed to find existing ongoing meeting: %s", e)
            raise DatabaseError(f"Find existing meeting failed: {e}")

    async def claim_for_rejoin(self, meeting_id: str) -> bool:
        """Atomic single-flight guard for rejoin.

        Flips the meeting to ``interrupted`` ONLY if it isn't already
        ``interrupted`` or terminal, in one row-locked UPDATE. Returns ``True``
        if THIS caller won the claim (and should proceed with the rejoin),
        ``False`` if another trigger already claimed it or the meeting is
        terminal. This serialises the three independent rejoin triggers
        (session-ended callback, ghost-pod reaper, warm-pool manager) so only
        ONE pod is ever spawned per drop — without it each trigger passed the
        session-count check and dispatched its own bot, stacking multiple bots
        in the same meeting lobby. Cluster-safe (works across API replicas)
        because the conditional UPDATE serialises on the row lock.
        """
        await self._ensure_connected()
        try:
            meeting_table = (
                qualified_name("meeting_joiner")
                if self._driver == "pg"
                else "meeting_joiner"
            )
            row = await self.execute_one(
                f"""
                UPDATE {meeting_table}
                   SET status = 'interrupted', updated_at = NOW()
                 WHERE id = $1::uuid
                   AND status NOT IN ('interrupted', 'completed', 'failed')
                RETURNING id
                """,
                meeting_id,
            )
            return row is not None
        except Exception as e:
            # On error, do NOT claim — skipping a rejoin is safer than
            # risking a double-fire we can't detect.
            logger.error("claim_for_rejoin failed for %s: %s", meeting_id, e)
            return False

    async def complete_if_active(self, meeting_id: str) -> bool:
        """Atomic guard for the user-initiated stop path (``DELETE /meetings/{id}``).

        Flips the meeting to ``completed`` ONLY if it isn't already terminal,
        in one row-locked UPDATE — mirrors :meth:`claim_for_rejoin`. Returns
        ``True`` if this caller's write took effect, ``False`` if the meeting
        was already ``completed``/``failed``. Without this guard, a
        reaper-triggered rejoin that has already claimed the meeting (flipping
        it to ``interrupted``/``joining``/``ongoing`` for a replacement bot)
        can lose a race with a stale stop request: the unconditional write
        would stamp ``completed`` over the replacement's in-flight state,
        orphaning the new pod (nothing ever marks it done).
        """
        await self._ensure_connected()
        try:
            meeting_table = (
                qualified_name("meeting_joiner")
                if self._driver == "pg"
                else "meeting_joiner"
            )
            row = await self.execute_one(
                f"""
                UPDATE {meeting_table}
                   SET status = 'completed', updated_at = NOW()
                 WHERE id = $1::uuid
                   AND status NOT IN ('completed', 'failed')
                RETURNING id
                """,
                meeting_id,
            )
            return row is not None
        except Exception as e:
            logger.error("complete_if_active failed for %s: %s", meeting_id, e)
            return False

    async def create_meeting(
        self,
        meeting_url: str,
        org_id: Optional[str] = None,
        bot_name: Optional[str] = None,
        transcript_source: Optional[str] = None,
        scheduled_at: Optional[datetime] = None,
    ) -> MeetingRecord:
        await self._ensure_connected()
        try:
            validated_org_id = await self._validate_org_id(org_id) if org_id else None
            normalized_url = UrlNormalizer.normalize_meeting_url(meeting_url)

            # Scheduled meetings are for a future time, so we don't dedup
            # against currently-ongoing meetings here — duplicate detection
            # runs at real dispatch time (in the scheduler), not now.
            existing = (
                None
                if scheduled_at is not None
                else await self.find_existing_ongoing_meeting(
                    normalized_url, validated_org_id
                )
            )
            if existing:
                logger.info(
                    "Found existing ongoing meeting %s, creating linked duplicate record",
                    existing.id,
                )
                row = await self.store.create_meeting(
                    meeting_url=meeting_url,
                    normalized_meeting_url=normalized_url,
                    status="ongoing",
                    transcript={},
                    participants=existing.participants or [],
                    bot_name=bot_name or "Meeting Bot",
                    org_id=validated_org_id,
                    transcript_source=transcript_source,
                    original_meeting_id=existing.id,
                    is_duplicate=True,
                    # Inherit the ORIGINAL join time — a duplicate is a linked
                    # view of the same live meeting, not a fresh join. Stamping
                    # "now" made the duplicate's duration a fraction of the real.
                    bot_join_time=existing.bot_join_time or datetime.now(timezone.utc),
                )
                logger.info(
                    "Created duplicate meeting record: %s linked to original: %s",
                    row.id,
                    existing.id,
                )
                return self._row_to_record(row)

            row = await self.store.create_meeting(
                meeting_url=meeting_url,
                normalized_meeting_url=normalized_url,
                status="scheduled" if scheduled_at is not None else "not_joined",
                bot_name=bot_name or "Meeting Bot",
                org_id=validated_org_id,
                transcript_source=transcript_source,
                is_duplicate=False,
                scheduled_at=scheduled_at,
            )
            logger.info("Created meeting record: %s", row.id)

            # Scheduled meetings open session 1 at real dispatch time (in the
            # meeting-scheduler), not now — the audit trail should reflect the
            # actual join attempt, and MAX(session_number)+1 still composes.
            if scheduled_at is not None:
                return self._row_to_record(row)

            # Design #1 (PR #3592 RCA): open session 1 here so the audit
            # trail in `meeting_sessions` is populated whether the meeting
            # ends up on the warm-pool path or the PGQueuer fallback. The
            # warm-pool dispatcher and rejoin orchestrator both compute
            # `MAX(session_number)+1` so this initial row composes cleanly
            # with later rejoin attempts.
            try:
                from ...storage.sessions_repo import get_sessions_repo

                await get_sessions_repo().open_session(
                    meeting_joiner_id=row.id,
                    pod_name=None,
                    cluster_name=None,
                )
            except Exception as e:  # noqa: BLE001
                # Non-fatal — meeting creation should not fail if the audit
                # row can't be written. The orchestrator's MAX+1 logic
                # still works (it just sees 0 existing rows on first rejoin).
                logger.warning("Failed to open session 1 for meeting %s: %s", row.id, e)

            return self._row_to_record(row)
        except Exception as e:
            logger.error("Failed to create meeting: %s", e)
            raise DatabaseError(f"Meeting creation failed: {e}")

    async def _validate_org_id(self, org_id: str) -> Optional[str]:
        # We don't have a generic typed lookup for organizations on the
        # store (different driver shape per adapter). Use query_raw which
        # both adapters implement — fail soft so a missing org doesn't
        # break meeting creation.
        try:
            sql = "SELECT id FROM organizations WHERE id = $1"
            if self._driver == "pg":
                sql = f"SELECT id FROM {qualified_name('organizations')} WHERE id = $1"
            rows = await self.store.query_raw(sql, org_id)
            if rows:
                return org_id
            logger.warning(
                "Organization %s not found, creating meeting without org association",
                org_id,
            )
        except Exception as e:  # noqa: BLE001 — table may not exist standalone
            logger.warning("Failed to validate organization %s: %s", org_id, e)
        return None

    async def get_meeting(self, meeting_id: str) -> Optional[MeetingRecord]:
        await self._ensure_connected()
        try:
            row = await self.store.get_meeting(meeting_id)
            return self._row_to_record(row) if row else None
        except Exception as e:
            logger.error("Failed to get meeting %s: %s", meeting_id, e)
            raise DatabaseError(f"Meeting retrieval failed: {e}")

    async def update_meeting_status(
        self, meeting_id: str, status: MeetingStatus, **additional_data: Any
    ) -> MeetingRecord:
        await self._ensure_connected()
        try:
            try:
                status_db = _STATUS_TO_DB[status]
            except KeyError as ke:
                # RCA #16: re-raise with context so a missing mapping
                # surfaces as a clear configuration error, not a bare
                # `<MeetingStatus.X: 'x'>` KeyError.
                raise DatabaseError(
                    f"Unmapped MeetingStatus {status!r}; add to _STATUS_TO_DB"
                ) from ke
            row = await self.store.update_status(
                meeting_id, status_db, **additional_data
            )
            logger.info("Updated meeting %s status to %s", meeting_id, status)
            return self._row_to_record(row)
        except DatabaseError:
            raise
        except Exception as e:
            logger.error("Failed to update meeting %s: %s", meeting_id, e)
            raise DatabaseError(f"Meeting update failed: {e}")

    async def update_transcript(
        self, meeting_id: str, transcript_data: Dict[str, Any]
    ) -> Optional[MeetingRecord]:
        await self._ensure_connected()
        try:
            processed = self._normalise_transcript(transcript_data)
            row = await self.store.update_transcript(meeting_id, processed)
            return self._row_to_record(row) if row else None
        except Exception as e:
            logger.error(
                "Failed to update transcript for meeting %s: %s", meeting_id, e
            )
            # Defensive fallback: try to write an error structure
            try:
                fallback = {
                    "error": "Transcript update failed",
                    "error_message": str(e),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
                row = await self.store.update_transcript(meeting_id, fallback)
                return self._row_to_record(row) if row else None
            except Exception as fb:  # noqa: BLE001
                logger.error("Fallback transcript update also failed: %s", fb)
                return None

    @staticmethod
    def _normalise_transcript(transcript_data: Any) -> Any:
        if transcript_data is None:
            return None
        if isinstance(transcript_data, dict):
            try:
                json.dumps(transcript_data)
                return transcript_data
            except (TypeError, ValueError) as e:
                logger.warning("Transcript data not JSON serializable: %s", e)
                return {
                    "error": "Invalid transcript data format",
                    "original_type": str(type(transcript_data)),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
        if isinstance(transcript_data, str):
            return {
                "content": transcript_data,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "format": "string",
            }
        return {
            "error": "Unsupported transcript data type",
            "original_type": str(type(transcript_data)),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    async def update_participants(
        self, meeting_id: str, participants: List[Dict[str, Any]]
    ) -> Optional[MeetingRecord]:
        await self._ensure_connected()
        try:
            row = await self.store.update_participants(meeting_id, participants)
            return self._row_to_record(row) if row else None
        except Exception as e:
            logger.error(
                "Failed to update participants for meeting %s: %s", meeting_id, e
            )
            return None

    async def get_active_meetings(
        self, org_id: Optional[str] = None
    ) -> List[MeetingRecord]:
        await self._ensure_connected()
        try:
            rows = await self.store.get_active_meetings(org_id)
            return [self._row_to_record(r) for r in rows]
        except Exception as e:
            logger.error("Failed to get active meetings: %s", e)
            raise DatabaseError(f"Active meetings retrieval failed: {e}")

    async def get_meetings_by_org(
        self, org_id: str, status: Optional[MeetingStatus] = None
    ) -> List[MeetingRecord]:
        await self._ensure_connected()
        try:
            status_db = _STATUS_TO_DB[status] if status else None
            rows = await self.store.get_meetings_by_org(org_id, status_db)
            return [self._row_to_record(r) for r in rows]
        except Exception as e:
            logger.error("Failed to get meetings for org %s: %s", org_id, e)
            raise DatabaseError(f"Meetings retrieval failed: {e}")

    async def list_meetings(
        self,
        org_id: Optional[str] = None,
        statuses: Optional[List[MeetingStatus]] = None,
        since: Optional[datetime] = None,
        until: Optional[datetime] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[MeetingRecord]:
        # ``offset`` is preserved on the public API but is not yet supported
        # by the pluggable store interface — emit a warning if the caller
        # passes a non-zero offset so we surface this gap clearly during
        # rollout. Filtering still happens; pagination just starts at 0.
        await self._ensure_connected()
        if offset:
            logger.warning(
                "list_meetings offset=%d ignored: store interface does not support OFFSET yet",
                offset,
            )
        where: Dict[str, Any] = {}
        if org_id:
            where["org_id"] = org_id
        if statuses:
            mapped = [_STATUS_TO_DB[s] for s in statuses if s in _STATUS_TO_DB]
            if len(mapped) == 1:
                where["status"] = mapped[0]
            elif len(mapped) > 1:
                where["status_in"] = mapped
        try:
            rows = await self.store.list_meetings(
                where=where,
                order_by="created_at DESC",
                limit=max(1, min(limit, 200)),
            )
            # since/until are applied client-side because the store doesn't
            # carry temporal filters yet (rare path; deferred to a follow-up).
            if since or until:

                def _in_range(r: Any) -> bool:
                    if since and r.created_at < since:
                        return False
                    if until and r.created_at > until:
                        return False
                    return True

                rows = [r for r in rows if _in_range(r)]
            return [self._row_to_record(r) for r in rows]
        except Exception as e:
            logger.error("Failed to list meetings: %s", e)
            raise DatabaseError(f"Meetings list failed: {e}")

    async def count_meetings(
        self,
        org_id: Optional[str] = None,
        statuses: Optional[List[MeetingStatus]] = None,
        since: Optional[datetime] = None,
        until: Optional[datetime] = None,
    ) -> int:
        await self._ensure_connected()
        if since or until:
            # Same temporal-filter limitation as list_meetings — count via
            # client-side filter. OK for dashboard cardinality.
            rows = await self.list_meetings(
                org_id=org_id,
                statuses=statuses,
                since=since,
                until=until,
                limit=200,
            )
            return len(rows)
        where: Dict[str, Any] = {}
        if org_id:
            where["org_id"] = org_id
        if statuses:
            mapped = [_STATUS_TO_DB[s] for s in statuses if s in _STATUS_TO_DB]
            if len(mapped) == 1:
                where["status"] = mapped[0]
        try:
            return await self.store.count_meetings(where=where)
        except Exception as e:
            logger.error("Failed to count meetings: %s", e)
            raise DatabaseError(f"Meetings count failed: {e}")

    async def append_transcript_segment(
        self, meeting_id: str, new_segment: Dict[str, Any]
    ) -> Optional[MeetingRecord]:
        await self._ensure_connected()
        try:
            try:
                json.dumps(new_segment)
                serialised = new_segment
            except (TypeError, ValueError) as e:
                logger.warning("New segment not JSON serializable: %s", e)
                serialised = {
                    "error": "Invalid segment data format",
                    "original_type": str(type(new_segment)),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "chunk_data": str(new_segment)[:500],
                }
            row = await self.store.get_meeting(meeting_id)
            if not row:
                logger.error("Meeting %s not found for segment append", meeting_id)
                return None
            now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
            transcript = row.transcript or {
                "content": [],
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "lastUpdated": now_ms,
            }
            # Copy so we never mutate the row's reference.
            transcript = dict(transcript)
            if not isinstance(transcript.get("content"), list):
                transcript["content"] = []
            transcript["content"].append(serialised)
            transcript["lastUpdated"] = now_ms
            transcript["totalSegments"] = len(transcript["content"])
            transcript["lastSegmentTime"] = serialised.get(
                "timestamp", datetime.now(timezone.utc).isoformat()
            )
            json.dumps(transcript)  # surface non-serialisable nested values
            updated = await self.store.update_transcript(meeting_id, transcript)
            return self._row_to_record(updated) if updated else None
        except Exception as e:
            logger.error(
                "Failed to append transcript segment for meeting %s: %s", meeting_id, e
            )
            return None

    @staticmethod
    def _row_to_record(row: Any) -> Optional[MeetingRecord]:
        if row is None:
            return None
        return MeetingRecord(
            id=row.id,
            meeting_url=row.meeting_url,
            normalized_meeting_url=row.normalized_meeting_url,
            status=_STATUS_FROM_DB.get(row.status, MeetingStatus.NOT_JOINED),
            video_link=row.video_link,
            transcript=row.transcript,
            participants=row.participants,
            org_id=row.org_id,
            meeting_id=row.meeting_id,
            bot_join_time=row.bot_join_time,
            bot_leave_time=row.bot_leave_time,
            bot_name=row.bot_name,
            is_duplicate=row.is_duplicate,
            original_meeting_id=row.original_meeting_id,
            transcript_source=row.transcript_source,
            # Carry the claimed pod through — the Stop endpoint needs it to
            # abort the bot via the sidecar. Without this it's always None and
            # Stop can't eject the bot.
            pod_name=getattr(row, "pod_name", None),
            cluster_name=getattr(row, "cluster_name", None),
            scheduled_at=getattr(row, "scheduled_at", None),
            created_at=row.created_at,
            updated_at=row.updated_at,
        )


# Singleton accessor preserved for existing callers
_db_connection: Optional[DatabaseConnection] = None


async def get_db_connection() -> DatabaseConnection:
    global _db_connection
    if _db_connection is None:
        _db_connection = DatabaseConnection()
        await _db_connection.connect()
    return _db_connection


async def close_db_connection() -> None:
    global _db_connection
    if _db_connection:
        await _db_connection.disconnect()
        _db_connection = None
