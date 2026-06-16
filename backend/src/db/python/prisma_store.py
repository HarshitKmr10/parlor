"""Prisma-backed implementation of MeetingJoinerStore.

Loaded when ``MEETING_JOINER_DB_DRIVER=prisma`` (the default). Wraps the
Prisma client behind the same async surface ``pg_store`` exposes so call
sites are unaware of which driver is active.

When the Prisma client can't be loaded (standalone vendor repo with the
prisma adapter selected by accident), :func:`connect` raises a clear
error pointing the user at ``MEETING_JOINER_DB_DRIVER=pg``.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Optional

from .status_enum import assert_status
from .types import MeetingRow

_prisma: Optional[Any] = None
_connected = False


def _load_prisma_module():
    try:
        from prisma import Prisma  # type: ignore
        return Prisma
    except ImportError as err:
        raise RuntimeError(
            "MEETING_JOINER_DB_DRIVER=prisma but the prisma-client-py package "
            "is not installed. In a standalone deployment set "
            "MEETING_JOINER_DB_DRIVER=pg instead.\n"
            f"Underlying error: {err}"
        ) from err


def _model_to_dataclass(model: Optional[Any]) -> Optional[MeetingRow]:
    if model is None:
        return None
    d = model.dict() if hasattr(model, "dict") else dict(model)
    for f in ("transcript", "participants", "exit_details"):
        v = d.get(f)
        if isinstance(v, (str, bytes)):
            try:
                d[f] = json.loads(v)
            except (json.JSONDecodeError, TypeError, ValueError):
                pass
    return MeetingRow(
        id=str(d["id"]),
        meeting_url=d["meeting_url"],
        normalized_meeting_url=d.get("normalized_meeting_url"),
        status=d["status"],
        video_link=d.get("video_link"),
        transcript=d.get("transcript"),
        participants=d.get("participants"),
        org_id=str(d["org_id"]) if d.get("org_id") else None,
        meeting_id=str(d["meeting_id"]) if d.get("meeting_id") else None,
        bot_join_time=d.get("bot_join_time"),
        bot_leave_time=d.get("bot_leave_time"),
        bot_name=d.get("bot_name"),
        transcript_source=d.get("transcript_source"),
        exit_reason=d.get("exit_reason"),
        exit_details=d.get("exit_details"),
        pod_name=d.get("pod_name"),
        cluster_name=d.get("cluster_name"),
        last_heartbeat_at=d.get("last_heartbeat_at"),
        original_meeting_id=str(d["original_meeting_id"]) if d.get("original_meeting_id") else None,
        is_duplicate=bool(d.get("is_duplicate", False)),
        scheduled_at=d.get("scheduled_at"),
        created_at=d["created_at"],
        updated_at=d["updated_at"],
    )


async def _client() -> Any:
    global _prisma, _connected
    if _prisma is None:
        Prisma = _load_prisma_module()
        _prisma = Prisma()
    if not _connected:
        await _prisma.connect()
        _connected = True
    return _prisma


async def connect() -> None:
    await _client()


async def disconnect() -> None:
    global _prisma, _connected
    if _prisma is not None and _connected:
        await _prisma.disconnect()
        _connected = False
    _prisma = None


async def find_existing_ongoing(
    normalized_url: str, org_id: Optional[str] = None
) -> Optional[MeetingRow]:
    client = await _client()
    where: dict[str, Any] = {
        "normalized_meeting_url": normalized_url,
        "status": "ongoing",
        "is_duplicate": False,
    }
    if org_id:
        where["org_id"] = org_id
    model = await client.meeting_joiner.find_first(
        where=where, order={"bot_join_time": "desc"}
    )
    return _model_to_dataclass(model)


async def create_meeting(**fields: Any) -> MeetingRow:
    if "status" in fields and fields["status"] is not None:
        assert_status(fields["status"])
    client = await _client()
    model = await client.meeting_joiner.create(data=fields)
    row = _model_to_dataclass(model)
    if row is None:
        raise RuntimeError("create_meeting: insert returned no row")
    return row


async def get_meeting(meeting_id: str) -> Optional[MeetingRow]:
    client = await _client()
    model = await client.meeting_joiner.find_unique(where={"id": meeting_id})
    return _model_to_dataclass(model)


async def find_unique_with_relations(meeting_id: str) -> Optional[MeetingRow]:
    client = await _client()
    model = await client.meeting_joiner.find_unique(
        where={"id": meeting_id},
        include={"org": True, "meeting": True, "original_meeting": True, "duplicates": True},
    )
    return _model_to_dataclass(model)


async def update_status(meeting_id: str, status: str, **extras: Any) -> MeetingRow:
    assert_status(status)
    client = await _client()
    data: dict[str, Any] = {"status": status, "updated_at": datetime.now(timezone.utc), **extras}
    if status == "ongoing" and "bot_join_time" not in extras:
        # NOTE: the bot's join is stamped by the JS markMeetingJoined path
        # (COALESCE, set-once). This Python branch is a fallback; it must not
        # run on a rejoin or it would overwrite the original join time.
        data["bot_join_time"] = datetime.now(timezone.utc)
    elif status in ("completed", "failed") and "bot_leave_time" not in extras:
        # Stamp leave time on BOTH terminal states — `failed` previously got
        # none, leaving null duration on rejected/failed-join meetings.
        data["bot_leave_time"] = datetime.now(timezone.utc)
    model = await client.meeting_joiner.update(where={"id": meeting_id}, data=data)
    row = _model_to_dataclass(model)
    if row is None:
        raise RuntimeError(f"update_status: no row for id={meeting_id}")
    return row


async def update_fields(meeting_id: str, fields: dict[str, Any]) -> Optional[MeetingRow]:
    if "status" in fields and fields["status"] is not None:
        assert_status(fields["status"])
    client = await _client()
    data = {**fields, "updated_at": datetime.now(timezone.utc)}
    model = await client.meeting_joiner.update(where={"id": meeting_id}, data=data)
    return _model_to_dataclass(model)


async def update_transcript(meeting_id: str, transcript: Any) -> Optional[MeetingRow]:
    client = await _client()
    model = await client.meeting_joiner.update(
        where={"id": meeting_id},
        data={"transcript": transcript, "updated_at": datetime.now(timezone.utc)},
    )
    return _model_to_dataclass(model)


async def update_participants(meeting_id: str, participants: Any) -> Optional[MeetingRow]:
    client = await _client()
    model = await client.meeting_joiner.update(
        where={"id": meeting_id},
        data={"participants": participants, "updated_at": datetime.now(timezone.utc)},
    )
    return _model_to_dataclass(model)


async def get_active_meetings(org_id: Optional[str] = None) -> list[MeetingRow]:
    client = await _client()
    where: dict[str, Any] = {"status": "ongoing"}
    if org_id:
        where["org_id"] = org_id
    models = await client.meeting_joiner.find_many(where=where)
    return [r for r in (_model_to_dataclass(m) for m in models) if r is not None]


async def get_meetings_by_org(
    org_id: str, status: Optional[str] = None
) -> list[MeetingRow]:
    if status:
        assert_status(status)
    client = await _client()
    where: dict[str, Any] = {"org_id": org_id}
    if status:
        where["status"] = status
    models = await client.meeting_joiner.find_many(where=where, order={"created_at": "desc"})
    return [r for r in (_model_to_dataclass(m) for m in models) if r is not None]


async def list_meetings(
    where: Optional[dict[str, Any]] = None,
    order_by: str = "created_at DESC",
    limit: Optional[int] = None,
) -> list[MeetingRow]:
    client = await _client()
    where = dict(where or {})
    prisma_where: dict[str, Any] = {}
    if "status_in" in where:
        prisma_where["status"] = {"in": list(where.pop("status_in"))}
    for key, value in where.items():
        if key in {
            "status",
            "org_id",
            "is_duplicate",
            "pod_name",
            "cluster_name",
            "original_meeting_id",
        }:
            prisma_where[key] = value
    col, _, dir_ = order_by.partition(" ")
    order = {col: (dir_.lower() or "asc").rstrip().lower()}
    kwargs: dict[str, Any] = {"where": prisma_where, "order": order}
    if limit:
        kwargs["take"] = int(limit)
    models = await client.meeting_joiner.find_many(**kwargs)
    return [r for r in (_model_to_dataclass(m) for m in models) if r is not None]


async def count_meetings(where: Optional[dict[str, Any]] = None) -> int:
    client = await _client()
    where = where or {}
    prisma_where = {
        k: v for k, v in where.items()
        if k in {"status", "org_id", "is_duplicate", "pod_name", "cluster_name"}
    }
    return await client.meeting_joiner.count(where=prisma_where)


async def set_video_link(meeting_id: str, link: str) -> Optional[MeetingRow]:
    return await update_fields(meeting_id, {"video_link": link})


async def claim_next_join_job() -> Optional[MeetingRow]:
    # Prisma doesn't expose SKIP LOCKED. Fall back to query_raw_unsafe of
    # the same SQL the pg adapter uses.
    client = await _client()
    sql = """
        UPDATE meeting_joiner
           SET status = 'ongoing',
               bot_join_time = NOW(),
               updated_at = NOW()
         WHERE id IN (
           SELECT id
             FROM meeting_joiner
            WHERE status = 'not_joined'
            ORDER BY created_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
         )
         RETURNING id
    """
    rows = await client.query_raw(sql)
    if not rows:
        return None
    return await get_meeting(rows[0]["id"])


async def query_raw(sql: str, *params: Any) -> list[dict]:
    client = await _client()
    return await client.query_raw(sql, *params)
