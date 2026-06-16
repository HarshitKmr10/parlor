"""Google Workspace Events API subscription manager (ad-hoc Meet capture).

Pass 2 catches meetings that NEVER touch a calendar — someone just starts an
instant Meet. The Workspace Events API lets us subscribe to **Meet conference
lifecycle** events for a *user* target resource; Google publishes those events
as CloudEvents to a Cloud Pub/Sub topic, which pushes to our webhook.

This module owns three concerns:

1. :class:`WorkspaceEventsClient` — thin wrapper over the Workspace Events API
   discovery service to create / list / renew (patch ttl) / delete a
   subscription. Synchronous google-api-python-client calls; async callers wrap
   in ``asyncio.to_thread``.
2. :class:`MeetSpaceResolver` — resolves a Meet **space**'s ``meetingUri`` via
   the Meet REST API (``spaces.get`` / from a conferenceRecord), using
   impersonated user creds.
3. :class:`WorkspaceEventSubscriptionRepo` — persistence for
   ``workspace_event_subscriptions`` and the ``meet_capture_events`` dedupe log.

All Google libs are imported lazily so the app boots with NO Google creds.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence

from ...db.python.schema import qualified_name
from ...observability import get_logger
from .auth import MEET_EVENTS_SCOPES, GoogleWorkspaceAuth

logger = get_logger(__name__)

UTC = timezone.utc

# Meet conference lifecycle CloudEvent types. `started` is the primary signal;
# `participant.joined` is a fallback in case a `started` event is missed.
EVENT_CONFERENCE_STARTED = "google.workspace.meet.conference.v2.started"
EVENT_CONFERENCE_ENDED = "google.workspace.meet.conference.v2.ended"
EVENT_PARTICIPANT_JOINED = "google.workspace.meet.participant.v2.joined"

DEFAULT_MEET_EVENT_TYPES: tuple[str, ...] = (
    EVENT_CONFERENCE_STARTED,
    EVENT_PARTICIPANT_JOINED,
)

# Subscription TTL requested from Google (seconds). The API caps Meet
# subscriptions; we request the documented max (7 days) and renew before then.
_SUBSCRIPTION_TTL_SECONDS = 7 * 24 * 60 * 60


def _table(db, name: str) -> str:
    return qualified_name(name) if getattr(db, "_driver", None) == "pg" else name


def _user_target_resource(user_id_or_email: str) -> str:
    """Workspace Events target resource for a user.

    The Events API addresses a Meet subscription's target as a Cloud Identity
    user resource: ``//cloudidentity.googleapis.com/users/{id}``. We accept an
    email here and let ``{id}`` be the email/`me` form Google resolves under the
    impersonated subject (impersonation pins the user, so `users/me` is valid).
    """
    return "//cloudidentity.googleapis.com/users/me"


@dataclass(frozen=True)
class SubscriptionResult:
    """Outcome of a create/renew call against the Workspace Events API."""

    subscription_id: Optional[str]
    target_user_email: str
    event_types: List[str]
    expire_time: Optional[datetime]
    state: str


def _parse_expire_time(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


class WorkspaceEventsClient:
    """Create / list / renew / delete Workspace Events subscriptions.

    One instance per (auth, topic). The Pub/Sub topic is the notification
    endpoint; the target resource is a Meet user resource.
    """

    def __init__(
        self,
        auth: GoogleWorkspaceAuth,
        *,
        pubsub_topic: str,
        scopes: Sequence[str] = MEET_EVENTS_SCOPES,
        event_types: Sequence[str] = DEFAULT_MEET_EVENT_TYPES,
    ) -> None:
        if not pubsub_topic:
            raise ValueError("WorkspaceEventsClient requires a pubsub_topic")
        self._auth = auth
        self._topic = pubsub_topic
        self._scopes = tuple(scopes)
        self._event_types = list(event_types)

    def _service(self, user_email: str):
        # Lazy import keeps the app importable with no Google libs exercised.
        from googleapiclient.discovery import build  # noqa: PLC0415

        creds = self._auth.get_user_credentials(user_email, self._scopes)
        return build(
            "workspaceevents", "v1", credentials=creds, cache_discovery=False
        )

    def create_subscription(self, user_email: str) -> SubscriptionResult:
        """Create a Meet conference-lifecycle subscription for ``user_email``."""
        service = self._service(user_email)
        body = {
            "targetResource": _user_target_resource(user_email),
            "eventTypes": self._event_types,
            "notificationEndpoint": {"pubsubTopic": self._topic},
            "payloadOptions": {"includeResource": True},
            "ttl": f"{_SUBSCRIPTION_TTL_SECONDS}s",
        }
        resp = service.subscriptions().create(body=body).execute() or {}
        # Long-running ops return either the resource directly or wrapped in a
        # `response`. Handle both shapes.
        result = resp.get("response", resp)
        return SubscriptionResult(
            subscription_id=result.get("name"),
            target_user_email=user_email,
            event_types=list(result.get("eventTypes") or self._event_types),
            expire_time=_parse_expire_time(result.get("expireTime")),
            state="active",
        )

    def renew_subscription(
        self, user_email: str, subscription_id: str
    ) -> SubscriptionResult:
        """Extend a subscription's lifetime by patching its ttl."""
        service = self._service(user_email)
        resp = (
            service.subscriptions()
            .patch(
                name=subscription_id,
                updateMask="ttl",
                body={"ttl": f"{_SUBSCRIPTION_TTL_SECONDS}s"},
            )
            .execute()
        ) or {}
        result = resp.get("response", resp)
        return SubscriptionResult(
            subscription_id=result.get("name") or subscription_id,
            target_user_email=user_email,
            event_types=list(result.get("eventTypes") or self._event_types),
            expire_time=_parse_expire_time(result.get("expireTime")),
            state="active",
        )

    def list_subscriptions(self, user_email: str) -> List[Dict[str, Any]]:
        """List the impersonated user's Meet subscriptions for this topic."""
        service = self._service(user_email)
        out: List[Dict[str, Any]] = []
        page_token: Optional[str] = None
        while True:
            resp = (
                service.subscriptions()
                .list(filter='event_types:"%s"' % EVENT_CONFERENCE_STARTED,
                      pageToken=page_token)
                .execute()
            ) or {}
            out.extend(resp.get("subscriptions") or [])
            page_token = resp.get("nextPageToken")
            if not page_token:
                break
        return out

    def delete_subscription(self, user_email: str, subscription_id: str) -> bool:
        """Delete a subscription. Returns True on success."""
        service = self._service(user_email)
        service.subscriptions().delete(name=subscription_id).execute()
        return True


class MeetSpaceResolver:
    """Resolve a Meet space's ``meetingUri`` via the Meet REST API."""

    def __init__(
        self,
        auth: GoogleWorkspaceAuth,
        *,
        scopes: Sequence[str] = MEET_EVENTS_SCOPES,
    ) -> None:
        self._auth = auth
        self._scopes = tuple(scopes)

    def _service(self, user_email: str):
        from googleapiclient.discovery import build  # noqa: PLC0415

        creds = self._auth.get_user_credentials(user_email, self._scopes)
        return build("meet", "v2", credentials=creds, cache_discovery=False)

    def resolve_meeting_uri(
        self,
        *,
        user_email: str,
        space_name: Optional[str] = None,
        conference_record: Optional[str] = None,
    ) -> Optional[str]:
        """Return the ``meetingUri`` (https://meet.google.com/...) for a space.

        ``space_name`` is a ``spaces/{id}`` resource. If only a
        ``conferenceRecord`` (``conferenceRecords/{id}``) is known, fetch it to
        learn the space, then resolve the space.
        """
        service = self._service(user_email)

        if not space_name and conference_record:
            record = (
                service.conferenceRecords().get(name=conference_record).execute()
            ) or {}
            space_name = record.get("space")

        if not space_name:
            return None

        space = service.spaces().get(name=space_name).execute() or {}
        return space.get("meetingUri")


class WorkspaceEventSubscriptionRepo:
    """Persistence for subscriptions + the Meet capture dedupe log."""

    def __init__(self, db) -> None:
        self._db = db

    # ── subscriptions ──────────────────────────────────────────────────────
    async def upsert_subscription(
        self,
        *,
        workspace_id: str,
        result: SubscriptionResult,
    ) -> Dict[str, Any]:
        table = _table(self._db, "workspace_event_subscriptions")
        rows = await self._db.store.query_raw(
            f"""
            INSERT INTO {table}
              (workspace_id, google_subscription_id, target_user_email,
               event_types, expire_time, state)
            VALUES ($1::uuid, $2, $3, $4::jsonb, $5, $6)
            ON CONFLICT (workspace_id, target_user_email) DO UPDATE
              SET google_subscription_id = EXCLUDED.google_subscription_id,
                  event_types = EXCLUDED.event_types,
                  expire_time = EXCLUDED.expire_time,
                  state = EXCLUDED.state,
                  updated_at = NOW()
            RETURNING id, workspace_id, google_subscription_id, target_user_email,
                      event_types, expire_time, state, created_at, updated_at
            """,
            workspace_id,
            result.subscription_id,
            result.target_user_email,
            json.dumps(result.event_types),
            result.expire_time,
            result.state,
        )
        return dict(rows[0]) if rows else {}

    async def list_subscriptions(self, workspace_id: str) -> List[Dict[str, Any]]:
        table = _table(self._db, "workspace_event_subscriptions")
        rows = await self._db.store.query_raw(
            f"SELECT id, workspace_id, google_subscription_id, target_user_email, "
            f"event_types, expire_time, state, created_at, updated_at "
            f"FROM {table} WHERE workspace_id = $1::uuid ORDER BY target_user_email",
            workspace_id,
        )
        return [dict(r) for r in (rows or [])]

    async def list_renewable(self, *, before: datetime) -> List[Dict[str, Any]]:
        """Active subscriptions expiring before ``before`` (renewal candidates)."""
        table = _table(self._db, "workspace_event_subscriptions")
        rows = await self._db.store.query_raw(
            f"SELECT id, workspace_id, google_subscription_id, target_user_email, "
            f"event_types, expire_time, state "
            f"FROM {table} WHERE state = 'active' AND expire_time IS NOT NULL "
            f"AND expire_time <= $1",
            before,
        )
        return [dict(r) for r in (rows or [])]

    async def mark_state(self, subscription_row_id: str, state: str) -> None:
        table = _table(self._db, "workspace_event_subscriptions")
        await self._db.store.query_raw(
            f"UPDATE {table} SET state = $1, updated_at = NOW() WHERE id = $2::uuid",
            state,
            subscription_row_id,
        )

    async def delete_for_workspace(self, workspace_id: str) -> List[Dict[str, Any]]:
        """Delete all subscription rows for a workspace, returning them (so the
        caller can best-effort delete the remote Google subscriptions)."""
        table = _table(self._db, "workspace_event_subscriptions")
        rows = await self._db.store.query_raw(
            f"DELETE FROM {table} WHERE workspace_id = $1::uuid "
            f"RETURNING target_user_email, google_subscription_id",
            workspace_id,
        )
        return [dict(r) for r in (rows or [])]

    # ── meet_capture_events (dedupe) ─────────────────────────────────────────
    async def claim_conference(
        self,
        *,
        conference_id: str,
        workspace_id: Optional[str],
        event_type: Optional[str],
        organizer_email: Optional[str],
    ) -> bool:
        """Atomically claim a conference id for processing.

        Returns True if THIS call inserted the row (we own dispatch), False if
        the conference was already recorded (a duplicate Pub/Sub delivery). The
        unique index on ``conference_id`` makes this race-safe.
        """
        table = _table(self._db, "meet_capture_events")
        rows = await self._db.store.query_raw(
            f"""
            INSERT INTO {table}
              (conference_id, workspace_id, event_type, organizer_email)
            VALUES ($1, $2::uuid, $3, $4)
            ON CONFLICT (conference_id) DO NOTHING
            RETURNING id
            """,
            conference_id,
            workspace_id,
            event_type,
            organizer_email,
        )
        return bool(rows)

    async def mark_dispatched(
        self,
        *,
        conference_id: str,
        meeting_id: Optional[str],
        meeting_uri: Optional[str],
    ) -> None:
        table = _table(self._db, "meet_capture_events")
        await self._db.store.query_raw(
            f"UPDATE {table} SET dispatched = TRUE, meeting_id = $1, "
            f"meeting_uri = $2 WHERE conference_id = $3",
            meeting_id,
            meeting_uri,
            conference_id,
        )
