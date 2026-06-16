"""Repository for the `meeting_sessions` table.

One row per bot attempt for a meeting. Each rejoin creates a new session
with incremented session_number. Transcript segments carry `session_number`
in their JSON envelope so consumers can stitch them back together by
wall-clock ordering.

This module is the only place that should touch `meeting_sessions`
directly. Other services depend on this interface.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from src.api.database.connection import get_db_connection
from src.db.python.schema import qualified_name
from src.observability import get_logger

logger = get_logger(__name__)


@dataclass(frozen=True)
class MeetingSession:
    """Read-only view of a meeting_sessions row."""

    id: str
    meeting_joiner_id: str
    session_number: int
    pod_name: Optional[str]
    cluster_name: Optional[str]
    started_at: datetime
    ended_at: Optional[datetime]
    admitted_at: Optional[datetime]
    exit_reason: Optional[str]
    exit_classification: Optional[str]
    last_segment_ts: Optional[datetime]


class SessionsRepository:
    """CRUD wrapper around the meeting_sessions table.

    Uses the same async DB connection pattern as MeetingService; lazy
    connect on first call.
    """

    async def _get_connection(self):
        db = await get_db_connection()
        if not db._connected:
            await db.connect()
        return db

    @staticmethod
    def _sessions_table(db) -> str:
        if getattr(db, "_driver", None) == "pg":
            return qualified_name("meeting_sessions")
        return "meeting_sessions"

    async def open_session(
        self,
        *,
        meeting_joiner_id: str,
        pod_name: Optional[str],
        cluster_name: Optional[str] = None,
    ) -> MeetingSession:
        """Open the next session for a meeting.

        Atomically computes `session_number = max(existing) + 1` so two
        concurrent rejoin orchestrators don't allocate the same number.
        The unique index `(meeting_joiner_id, session_number)` is the
        backstop — on conflict we retry once.
        """
        db = await self._get_connection()
        now = datetime.now(timezone.utc)
        sessions_table = self._sessions_table(db)

        # Use raw SQL for the atomic next-number computation. Prisma's
        # generated client doesn't expose a clean way to do this in one
        # round-trip, and the unique index protects against a race anyway.
        row = await db.execute_one(
            f"""
            INSERT INTO {sessions_table} (
                meeting_joiner_id, session_number, pod_name, cluster_name,
                started_at
            )
            SELECT $1::uuid,
                   COALESCE(MAX(session_number), 0) + 1,
                   $2, $3, $4
            FROM {sessions_table}
            WHERE meeting_joiner_id = $1::uuid
            RETURNING id, meeting_joiner_id, session_number, pod_name,
                      cluster_name, started_at, ended_at, admitted_at,
                      exit_reason, exit_classification, last_segment_ts
            """,
            meeting_joiner_id,
            pod_name,
            cluster_name,
            now,
        )
        if row is None:
            raise RuntimeError(
                f"Failed to open session for meeting {meeting_joiner_id}"
            )
        session = _row_to_session(row)
        logger.info(
            "session.opened",
            meeting_id=meeting_joiner_id,
            session_number=session.session_number,
            pod_name=pod_name,
        )
        return session

    async def mark_admitted(self, session_id: str) -> None:
        """Record that the bot was admitted into the meeting.

        `admitted_at` is the wall-clock anchor used by transcript
        consumers to align bot-relative timestamps to meeting-wall-clock.
        """
        db = await self._get_connection()
        now = datetime.now(timezone.utc)
        sessions_table = self._sessions_table(db)
        await db.execute(
            f"UPDATE {sessions_table} SET admitted_at = $1 "
            "WHERE id = $2::uuid AND admitted_at IS NULL",
            now,
            session_id,
        )

    async def update_pod_name_for_session(
        self,
        *,
        meeting_joiner_id: str,
        session_number: int,
        pod_name: str,
    ) -> None:
        """Attach the claimed pod name to an already-opened session row.

        Used by the warm-pool dispatcher after a successful claim. The
        session row is created earlier (by DatabaseConnection.create_meeting
        for session 1, by RejoinOrchestrator.attempt for sessions 2+) with
        pod_name=NULL; this fills it in.
        """
        db = await self._get_connection()
        sessions_table = self._sessions_table(db)
        await db.execute(
            f"UPDATE {sessions_table} SET pod_name = $1 "
            "WHERE meeting_joiner_id = $2::uuid AND session_number = $3",
            pod_name,
            meeting_joiner_id,
            session_number,
        )

    async def update_last_segment(self, session_id: str, ts: datetime) -> None:
        """Stamp the latest transcript segment timestamp.

        Called from the segment-write hot path; debounced upstream (the
        warm-pool reaper polls last_segment_ts to detect stuck bots).
        """
        db = await self._get_connection()
        sessions_table = self._sessions_table(db)
        await db.execute(
            f"UPDATE {sessions_table} SET last_segment_ts = $1 " "WHERE id = $2::uuid",
            ts,
            session_id,
        )

    async def close_session(
        self,
        session_id: str,
        *,
        exit_reason: str,
        exit_classification: str,
    ) -> None:
        """Mark the session ended.

        `exit_classification` ∈ {"terminal", "recoverable", "unknown"} —
        the rejoin orchestrator reads this to decide whether to spawn a
        replacement session.
        """
        db = await self._get_connection()
        now = datetime.now(timezone.utc)
        sessions_table = self._sessions_table(db)
        await db.execute(
            f"""
            UPDATE {sessions_table}
            SET ended_at = $1,
                exit_reason = $2,
                exit_classification = $3
            WHERE id = $4::uuid AND ended_at IS NULL
            """,
            now,
            exit_reason,
            exit_classification,
            session_id,
        )
        logger.info(
            "session.closed",
            session_id=session_id,
            exit_reason=exit_reason,
            exit_classification=exit_classification,
        )

    async def get_latest_session(
        self, meeting_joiner_id: str
    ) -> Optional[MeetingSession]:
        """Return the most recent session for a meeting (or None)."""
        db = await self._get_connection()
        sessions_table = self._sessions_table(db)
        row = await db.execute_one(
            f"""
            SELECT id, meeting_joiner_id, session_number, pod_name,
                   cluster_name, started_at, ended_at, admitted_at,
                   exit_reason, exit_classification, last_segment_ts
            FROM {sessions_table}
            WHERE meeting_joiner_id = $1::uuid
            ORDER BY session_number DESC
            LIMIT 1
            """,
            meeting_joiner_id,
        )
        return _row_to_session(row) if row else None

    async def list_sessions(self, meeting_joiner_id: str) -> list[MeetingSession]:
        """All sessions for a meeting, oldest first."""
        db = await self._get_connection()
        sessions_table = self._sessions_table(db)
        rows = await db.execute_query(
            f"""
            SELECT id, meeting_joiner_id, session_number, pod_name,
                   cluster_name, started_at, ended_at, admitted_at,
                   exit_reason, exit_classification, last_segment_ts
            FROM {sessions_table}
            WHERE meeting_joiner_id = $1::uuid
            ORDER BY session_number ASC
            """,
            meeting_joiner_id,
        )
        return [_row_to_session(row) for row in rows]

    async def count_sessions(self, meeting_joiner_id: str) -> int:
        """Cheap count of sessions — used by rejoin cap enforcement."""
        db = await self._get_connection()
        sessions_table = self._sessions_table(db)
        row = await db.execute_one(
            f"SELECT COUNT(*) AS c FROM {sessions_table} "
            "WHERE meeting_joiner_id = $1::uuid",
            meeting_joiner_id,
        )
        return int(row["c"]) if row else 0


def _row_to_session(row: dict) -> MeetingSession:
    return MeetingSession(
        id=str(row["id"]),
        meeting_joiner_id=str(row["meeting_joiner_id"]),
        session_number=int(row["session_number"]),
        pod_name=row.get("pod_name"),
        cluster_name=row.get("cluster_name"),
        started_at=row["started_at"],
        ended_at=row.get("ended_at"),
        admitted_at=row.get("admitted_at"),
        exit_reason=row.get("exit_reason"),
        exit_classification=row.get("exit_classification"),
        last_segment_ts=row.get("last_segment_ts"),
    )


_repo_singleton: Optional[SessionsRepository] = None


def get_sessions_repo() -> SessionsRepository:
    """Process-wide singleton accessor."""
    global _repo_singleton
    if _repo_singleton is None:
        _repo_singleton = SessionsRepository()
    return _repo_singleton
