"""Raw-SQL implementation of MeetingJoinerStore using asyncpg.

All queries are parameterised. JSON columns are serialised via
``json.dumps`` because asyncpg accepts JSON only as text — its native
``record`` -> Python conversion handles JSONB reads transparently.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Iterable, Optional

from .pg_pool import close_pool, get_pool
from .schema import qualified_name
from .status_enum import assert_status
from .types import MeetingRow

MEETING_JOINER_TABLE = qualified_name("meeting_joiner")
ORGANIZATIONS_TABLE = qualified_name("organizations")
MEETINGS_TABLE = qualified_name("meetings")

COLUMNS: tuple[str, ...] = (
    "id", "meeting_url", "normalized_meeting_url", "status", "video_link",
    "transcript", "participants", "org_id", "meeting_id",
    "bot_join_time", "bot_leave_time", "bot_name", "transcript_source",
    "exit_reason", "exit_details", "pod_name", "cluster_name",
    "last_heartbeat_at", "original_meeting_id",
    "is_duplicate", "scheduled_at", "created_at", "updated_at",
)
SELECT_ALL = ", ".join(COLUMNS)

WRITABLE_FIELDS: frozenset[str] = frozenset({
    "meeting_url", "normalized_meeting_url", "status", "video_link",
    "transcript", "participants", "org_id", "meeting_id",
    "bot_join_time", "bot_leave_time", "bot_name", "transcript_source",
    "exit_reason", "exit_details", "pod_name", "cluster_name",
    "last_heartbeat_at", "original_meeting_id",
    "is_duplicate", "scheduled_at",
})

JSON_FIELDS: frozenset[str] = frozenset({"transcript", "participants", "exit_details"})


def _serialise(field: str, value: Any) -> Any:
    if value is None:
        return None
    if field in JSON_FIELDS and not isinstance(value, str):
        return json.dumps(value)
    return value


def _row_to_dataclass(record: Optional[dict | Any]) -> Optional[MeetingRow]:
    if record is None:
        return None
    data = dict(record)
    # asyncpg returns JSON columns as text in transaction-mode pgbouncer
    # depending on settings. Normalise.
    for f in JSON_FIELDS:
        v = data.get(f)
        if isinstance(v, (str, bytes)):
            try:
                data[f] = json.loads(v)
            except (json.JSONDecodeError, TypeError, ValueError):
                pass
    return MeetingRow(
        id=str(data["id"]),
        meeting_url=data["meeting_url"],
        normalized_meeting_url=data.get("normalized_meeting_url"),
        status=data["status"],
        video_link=data.get("video_link"),
        transcript=data.get("transcript"),
        participants=data.get("participants"),
        org_id=str(data["org_id"]) if data.get("org_id") else None,
        meeting_id=str(data["meeting_id"]) if data.get("meeting_id") else None,
        bot_join_time=data.get("bot_join_time"),
        bot_leave_time=data.get("bot_leave_time"),
        bot_name=data.get("bot_name"),
        transcript_source=data.get("transcript_source"),
        exit_reason=data.get("exit_reason"),
        exit_details=data.get("exit_details"),
        pod_name=data.get("pod_name"),
        cluster_name=data.get("cluster_name"),
        last_heartbeat_at=data.get("last_heartbeat_at"),
        original_meeting_id=str(data["original_meeting_id"]) if data.get("original_meeting_id") else None,
        is_duplicate=bool(data.get("is_duplicate", False)),
        scheduled_at=data.get("scheduled_at"),
        created_at=data["created_at"],
        updated_at=data["updated_at"],
    )


async def _fetch_one(sql: str, *params: Any) -> Optional[MeetingRow]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        record = await conn.fetchrow(sql, *params)
    return _row_to_dataclass(record)


async def _fetch_many(sql: str, *params: Any) -> list[MeetingRow]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        records = await conn.fetch(sql, *params)
    return [r for r in (_row_to_dataclass(rec) for rec in records) if r is not None]


# ── public API ──────────────────────────────────────────────────────────

async def connect() -> None:
    # Pool is lazy; touching it here ensures DSN problems surface at startup.
    await get_pool()


async def disconnect() -> None:
    await close_pool()


async def find_existing_ongoing(
    normalized_url: str, org_id: Optional[str] = None
) -> Optional[MeetingRow]:
    where = ["normalized_meeting_url = $1", "status = 'ongoing'", "is_duplicate = false"]
    params: list[Any] = [normalized_url]
    if org_id:
        where.append(f"org_id = ${len(params) + 1}")
        params.append(org_id)
    sql = f"""
        SELECT {SELECT_ALL}
          FROM {MEETING_JOINER_TABLE}
         WHERE {' AND '.join(where)}
         ORDER BY bot_join_time DESC NULLS LAST
         LIMIT 1
    """
    return await _fetch_one(sql, *params)


async def create_meeting(**fields: Any) -> MeetingRow:
    if "status" in fields and fields["status"] is not None:
        assert_status(fields["status"])
    cols: list[str] = []
    params: list[Any] = []
    placeholders: list[str] = []
    for key, value in fields.items():
        if key not in WRITABLE_FIELDS:
            continue
        cols.append(key)
        params.append(_serialise(key, value))
        placeholders.append(f"${len(params)}")
    if not cols:
        raise ValueError("create_meeting: no writable columns supplied")
    sql = f"""
        INSERT INTO {MEETING_JOINER_TABLE} ({', '.join(cols)})
        VALUES ({', '.join(placeholders)})
        RETURNING {SELECT_ALL}
    """
    row = await _fetch_one(sql, *params)
    if row is None:
        raise RuntimeError("create_meeting: insert returned no row")
    return row


async def get_meeting(meeting_id: str) -> Optional[MeetingRow]:
    return await _fetch_one(
        f"SELECT {SELECT_ALL} FROM {MEETING_JOINER_TABLE} WHERE id = $1",
        meeting_id,
    )


async def get_meetings_by_ids(meeting_ids: Iterable[str]) -> list[MeetingRow]:
    ids = list(meeting_ids)
    if not ids:
        return []
    return await _fetch_many(
        f"SELECT {SELECT_ALL} FROM {MEETING_JOINER_TABLE} WHERE id = ANY($1::uuid[])",
        ids,
    )


async def find_unique_with_relations(meeting_id: str) -> Optional[MeetingRow]:
    base = await get_meeting(meeting_id)
    if base is None:
        return None
    pool = await get_pool()
    async with pool.acquire() as conn:
        org = None
        meeting = None
        if base.org_id:
            try:
                org_rec = await conn.fetchrow(
                    f"SELECT * FROM {ORGANIZATIONS_TABLE} WHERE id = $1", base.org_id
                )
                org = dict(org_rec) if org_rec else None
            except Exception:  # noqa: BLE001 — table may not exist standalone
                org = None
        if base.meeting_id:
            try:
                m_rec = await conn.fetchrow(
                    f"SELECT * FROM {MEETINGS_TABLE} WHERE meeting_id = $1", base.meeting_id
                )
                meeting = dict(m_rec) if m_rec else None
            except Exception:  # noqa: BLE001
                meeting = None
        original = None
        if base.original_meeting_id:
            orig_rec = await conn.fetchrow(
                f"SELECT {SELECT_ALL} FROM {MEETING_JOINER_TABLE} WHERE id = $1",
                base.original_meeting_id,
            )
            original = _row_to_dataclass(orig_rec)
        dup_recs = await conn.fetch(
            f"SELECT {SELECT_ALL} FROM {MEETING_JOINER_TABLE} WHERE original_meeting_id = $1",
            meeting_id,
        )
        duplicates = tuple(d for d in (_row_to_dataclass(rec) for rec in dup_recs) if d is not None)
    # frozen dataclass — replace doesn't work on field(default=...) defaults
    # carrying through. Recreate.
    return MeetingRow(
        **{**base.__dict__, "org": org, "meeting": meeting, "original_meeting": original, "duplicates": duplicates}
    )


async def update_status(
    meeting_id: str, status: str, **extras: Any
) -> MeetingRow:
    assert_status(status)
    fields: dict[str, Any] = {"status": status, **extras}
    if status == "ongoing" and "bot_join_time" not in extras:
        # Set-once via COALESCE so a rejoin doesn't overwrite the first-join time.
        fields["bot_join_time"] = {"__coalesce": datetime.now(timezone.utc)}
    elif status in ("completed", "failed") and "bot_leave_time" not in extras:
        # Stamp leave time on BOTH terminal states (failed previously got none).
        fields["bot_leave_time"] = datetime.now(timezone.utc)
    row = await update_fields(meeting_id, fields)
    if row is None:
        raise RuntimeError(f"update_status: no row for id={meeting_id}")
    return row


async def update_fields(meeting_id: str, fields: dict[str, Any]) -> Optional[MeetingRow]:
    sets: list[str] = []
    params: list[Any] = []
    for key, value in fields.items():
        if key not in WRITABLE_FIELDS:
            continue
        if key == "status":
            assert_status(value)
        # `{"__coalesce": v}` → write only if the column is currently NULL
        # (atomic set-once). Used for bot_join_time so a rejoin doesn't clobber
        # the original first-join timestamp (parity with the JS pg store).
        if isinstance(value, dict) and "__coalesce" in value:
            params.append(_serialise(key, value["__coalesce"]))
            sets.append(f"{key} = COALESCE({key}, ${len(params)})")
            continue
        params.append(_serialise(key, value))
        sets.append(f"{key} = ${len(params)}")
    if not sets:
        return await get_meeting(meeting_id)
    sets.append("updated_at = NOW()")
    params.append(meeting_id)
    sql = f"""
        UPDATE {MEETING_JOINER_TABLE}
           SET {', '.join(sets)}
         WHERE id = ${len(params)}
         RETURNING {SELECT_ALL}
    """
    return await _fetch_one(sql, *params)


async def update_transcript(meeting_id: str, transcript: Any) -> Optional[MeetingRow]:
    return await _fetch_one(
        f"""
        UPDATE {MEETING_JOINER_TABLE}
           SET transcript = $1::json, updated_at = NOW()
         WHERE id = $2
         RETURNING {SELECT_ALL}
        """,
        json.dumps(transcript) if not isinstance(transcript, str) else transcript,
        meeting_id,
    )


async def update_participants(meeting_id: str, participants: Any) -> Optional[MeetingRow]:
    return await _fetch_one(
        f"""
        UPDATE {MEETING_JOINER_TABLE}
           SET participants = $1::json, updated_at = NOW()
         WHERE id = $2
         RETURNING {SELECT_ALL}
        """,
        json.dumps(participants) if not isinstance(participants, str) else participants,
        meeting_id,
    )


async def get_active_meetings(org_id: Optional[str] = None) -> list[MeetingRow]:
    if org_id:
        return await _fetch_many(
            f"SELECT {SELECT_ALL} FROM {MEETING_JOINER_TABLE} WHERE status='ongoing' AND org_id=$1",
            org_id,
        )
    return await _fetch_many(
        f"SELECT {SELECT_ALL} FROM {MEETING_JOINER_TABLE} WHERE status='ongoing'"
    )


async def get_meetings_by_org(
    org_id: str, status: Optional[str] = None
) -> list[MeetingRow]:
    params: list[Any] = [org_id]
    sql = f"SELECT {SELECT_ALL} FROM {MEETING_JOINER_TABLE} WHERE org_id = $1"
    if status:
        assert_status(status)
        params.append(status)
        sql += f" AND status = $2"
    sql += " ORDER BY created_at DESC"
    return await _fetch_many(sql, *params)


_LIST_MEETINGS_ORDER_BY_WHITELIST = frozenset(
    {"created_at DESC", "created_at ASC", "bot_join_time DESC", "bot_join_time ASC"}
)


async def list_meetings(
    where: Optional[dict[str, Any]] = None,
    order_by: str = "created_at DESC",
    limit: Optional[int] = None,
) -> list[MeetingRow]:
    if order_by not in _LIST_MEETINGS_ORDER_BY_WHITELIST:
        raise ValueError(f"Unsupported order_by value: {order_by!r}")
    where = where or {}
    clauses: list[str] = []
    params: list[Any] = []
    for key, value in where.items():
        if key == "status_in" and isinstance(value, (list, tuple)) and value:
            placeholders = ", ".join(f"${len(params) + i + 1}" for i in range(len(value)))
            clauses.append(f"status IN ({placeholders})")
            params.extend(value)
        elif key in {
            "status",
            "org_id",
            "is_duplicate",
            "pod_name",
            "cluster_name",
            "original_meeting_id",
        }:
            params.append(value)
            clauses.append(f"{key} = ${len(params)}")
    sql = f"SELECT {SELECT_ALL} FROM {MEETING_JOINER_TABLE}"
    if clauses:
        sql += " WHERE " + " AND ".join(clauses)
    sql += f" ORDER BY {order_by}"
    if limit:
        sql += f" LIMIT {int(limit)}"
    return await _fetch_many(sql, *params)


async def count_meetings(where: Optional[dict[str, Any]] = None) -> int:
    where = where or {}
    clauses: list[str] = []
    params: list[Any] = []
    for key, value in where.items():
        if key in {"status", "org_id", "is_duplicate", "pod_name", "cluster_name"}:
            params.append(value)
            clauses.append(f"{key} = ${len(params)}")
    sql = f"SELECT COUNT(*) AS n FROM {MEETING_JOINER_TABLE}"
    if clauses:
        sql += " WHERE " + " AND ".join(clauses)
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(sql, *params)
    return int(row["n"]) if row else 0


async def set_video_link(meeting_id: str, link: str) -> Optional[MeetingRow]:
    return await update_fields(meeting_id, {"video_link": link})


async def claim_next_join_job() -> Optional[MeetingRow]:
    """Atomically claim the next not_joined meeting using SKIP LOCKED.

    Replaces the raw `query_raw` SQL the existing Python queue services
    were already using. Reusable across the two simple_queue_service
    files at src/services/ and src/api/services/.
    """
    sql = f"""
        UPDATE {MEETING_JOINER_TABLE}
           SET status = 'ongoing',
               bot_join_time = NOW(),
               updated_at = NOW()
         WHERE id IN (
           SELECT id
             FROM {MEETING_JOINER_TABLE}
            WHERE status = 'not_joined'
            ORDER BY created_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
         )
         RETURNING {SELECT_ALL}
    """
    return await _fetch_one(sql)


async def query_raw(sql: str, *params: Any) -> list[dict]:
    """Escape hatch for any query the typed API doesn't cover.

    Mirrors Prisma's ``query_raw``. Returned shape is a list of dicts.
    Use sparingly — every call here is a candidate for a typed method.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        records = await conn.fetch(sql, *params)
    return [dict(r) for r in records]
