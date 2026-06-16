"""Ad-hoc / instant Meet capture orchestration (Workspace Events + Pub/Sub).

This service ties together the pass-2 pieces:

* **Provisioning** — fan a Workspace Events subscription out across org users
  (Directory) so Google emits a CloudEvent whenever any user starts an instant
  Meet. Subscriptions are persisted and renewed before expiry.
* **Webhook handling** — given a decoded Workspace Events CloudEvent for a
  *conference started* event, resolve the Meet space ``meetingUri`` and dispatch
  the bot through the unified ``dispatch_meeting`` path, with dedupe so the
  duplicate Pub/Sub deliveries Google sends don't double-join.
* **Renewal loop** — a background task that re-extends expiring subscriptions.

Everything no-ops cleanly when no org is configured / Pub/Sub topic is unset, so
the app boots with NO Google creds.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from shared.config import settings

from ..api.database.connection import get_db_connection
from ..integrations.google_workspace import (
    DirectoryClient,
    EVENT_CONFERENCE_STARTED,
    GoogleWorkspaceOrgRepo,
    MeetSpaceResolver,
    OrgMeetingPolicyRepo,
    WorkspaceEventsClient,
    WorkspaceEventSubscriptionRepo,
    get_workspace_auth,
)
from ..integrations.google_workspace.auth import (
    DIRECTORY_READONLY_SCOPE,
    MEET_EVENTS_SCOPES,
)
from ..observability import get_logger
from ..shared.platformDetector import PlatformDetector

logger = get_logger(__name__)

UTC = timezone.utc


class PubSubNotConfiguredError(Exception):
    """Raised when provisioning is attempted with no Pub/Sub topic set."""


class WorkspaceNotConfiguredError(Exception):
    """Raised when provisioning is attempted for an unconfigured workspace."""


# ── decoded CloudEvent shape ───────────────────────────────────────────────


def parse_conference_event(cloud_event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Extract the fields we need from a Workspace Events Meet CloudEvent.

    Returns ``None`` for events we don't act on (non-conference, unknown type).
    A *started* (or fallback *participant joined*) event yields a dict with the
    conference id, optional space / conferenceRecord resource names, the target
    user email (subject), the organizer email when present, and the event type.
    """
    if not isinstance(cloud_event, dict):
        return None

    event_type = cloud_event.get("type") or cloud_event.get("eventType")
    if not event_type or "meet.conference" not in event_type and (
        "meet.participant" not in event_type
    ):
        return None

    data = cloud_event.get("data") or {}
    if isinstance(data, str):
        # Some encodings wrap the resource under data as a JSON string.
        import json as _json  # noqa: PLC0415

        try:
            data = _json.loads(data)
        except (ValueError, TypeError):
            data = {}

    # The Meet conference resource may be nested under a few keys depending on
    # the event family. Be liberal in what we accept.
    conference = (
        data.get("conferenceRecord")
        or data.get("conference")
        or data.get("meetConference")
        or {}
    )
    if isinstance(conference, str):
        conference = {"name": conference}

    space = conference.get("space") or data.get("space")
    if isinstance(space, dict):
        space_name = space.get("name")
    else:
        space_name = space

    conference_record_name = conference.get("name")
    # Stable dedupe id: prefer the conferenceRecord name, fall back to space.
    conference_id = conference_record_name or space_name
    if not conference_id:
        return None

    organizer = (
        conference.get("organizer")
        or data.get("organizer")
        or {}
    )
    organizer_email = (
        organizer.get("email") if isinstance(organizer, dict) else None
    )

    # The subject of the subscription = the user whose Meet activity fired this.
    subject = (
        cloud_event.get("subject")
        or cloud_event.get("source")
        or data.get("user")
        or ""
    )

    return {
        "event_type": event_type,
        "conference_id": str(conference_id),
        "space_name": space_name,
        "conference_record": conference_record_name,
        "organizer_email": organizer_email,
        "subject": subject,
    }


class MeetEventsService:
    """Provision subscriptions + process push events for ad-hoc Meet capture."""

    # ── provisioning ─────────────────────────────────────────────────────────
    async def provision_workspace(self, workspace_id: str) -> Dict[str, Any]:
        """Create/refresh a Meet events subscription for every org user.

        Returns a summary ``{ created, failed, total }``. Raises
        :class:`PubSubNotConfiguredError` / :class:`WorkspaceNotConfiguredError`
        so the route can map them to clear 400s.
        """
        topic = settings.GOOGLE_PUBSUB_TOPIC
        if not topic:
            raise PubSubNotConfiguredError(
                "GOOGLE_PUBSUB_TOPIC is not configured; cannot subscribe to "
                "Meet events."
            )

        db = await get_db_connection()
        org_repo = GoogleWorkspaceOrgRepo(db)
        auth_config = await org_repo.get_auth_config(workspace_id)
        if auth_config is None:
            raise WorkspaceNotConfiguredError(
                "Org-wide Google Workspace capture is not configured for this "
                "workspace."
            )

        auth = get_workspace_auth(auth_config)
        directory = DirectoryClient(auth, scopes=(DIRECTORY_READONLY_SCOPE,))
        emails = await asyncio.to_thread(
            directory.list_active_user_emails,
            domain=auth_config.domain,
            customer_id=auth_config.customer_id,
        )

        events_client = WorkspaceEventsClient(auth, pubsub_topic=topic)
        sub_repo = WorkspaceEventSubscriptionRepo(db)

        created = 0
        failed = 0
        for email in emails:
            try:
                result = await asyncio.to_thread(
                    events_client.create_subscription, email
                )
                await sub_repo.upsert_subscription(
                    workspace_id=workspace_id, result=result
                )
                created += 1
            except Exception as exc:  # noqa: BLE001
                failed += 1
                logger.warning(
                    "meet_events.subscribe_failed",
                    workspace_id=workspace_id,
                    user_email=email,
                    error=str(exc),
                )
        logger.info(
            "meet_events.provisioned",
            workspace_id=workspace_id,
            created=created,
            failed=failed,
            total=len(emails),
        )
        return {"created": created, "failed": failed, "total": len(emails)}

    async def list_subscriptions(self, workspace_id: str) -> List[Dict[str, Any]]:
        db = await get_db_connection()
        return await WorkspaceEventSubscriptionRepo(db).list_subscriptions(
            workspace_id
        )

    async def teardown_workspace(self, workspace_id: str) -> Dict[str, Any]:
        """Delete all subscriptions for a workspace (DB + best-effort Google)."""
        db = await get_db_connection()
        org_repo = GoogleWorkspaceOrgRepo(db)
        sub_repo = WorkspaceEventSubscriptionRepo(db)

        deleted_rows = await sub_repo.delete_for_workspace(workspace_id)

        # Best-effort remote delete; the DB rows are already gone so a failure
        # just leaves an orphaned Google subscription that will expire on its
        # own. Only attempt when an org + topic still exist.
        auth_config = await org_repo.get_auth_config(workspace_id)
        if auth_config is not None and settings.GOOGLE_PUBSUB_TOPIC:
            try:
                auth = get_workspace_auth(auth_config)
                client = WorkspaceEventsClient(
                    auth, pubsub_topic=settings.GOOGLE_PUBSUB_TOPIC
                )
                for row in deleted_rows:
                    sub_id = row.get("google_subscription_id")
                    email = row.get("target_user_email")
                    if sub_id and email:
                        try:
                            await asyncio.to_thread(
                                client.delete_subscription, email, sub_id
                            )
                        except Exception as exc:  # noqa: BLE001
                            logger.warning(
                                "meet_events.remote_delete_failed",
                                subscription_id=sub_id,
                                error=str(exc),
                            )
            except Exception as exc:  # noqa: BLE001
                logger.warning("meet_events.teardown_auth_error", error=str(exc))

        return {"deleted": len(deleted_rows)}

    # ── push event handling ──────────────────────────────────────────────────
    async def handle_conference_event(
        self, parsed: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Process one parsed conference event: dedupe → resolve → dispatch.

        Returns a small status dict for logging. Idempotent: a duplicate
        delivery of the same conference id short-circuits at the dedupe claim.
        """
        conference_id = parsed["conference_id"]
        db = await get_db_connection()
        sub_repo = WorkspaceEventSubscriptionRepo(db)

        # Find the workspace this subscription belongs to via the subject user.
        workspace_id, notetaker_email = await self._resolve_workspace_for_subject(
            db, parsed.get("subject")
        )

        # Dedupe: atomically claim the conference id. A duplicate Pub/Sub
        # delivery (Google WILL resend) returns False here and we ack-and-ignore.
        claimed = await sub_repo.claim_conference(
            conference_id=conference_id,
            workspace_id=workspace_id,
            event_type=parsed.get("event_type"),
            organizer_email=parsed.get("organizer_email"),
        )
        if not claimed:
            logger.info("meet_events.duplicate_ignored", conference_id=conference_id)
            return {"status": "duplicate", "conference_id": conference_id}

        # Policy gate BEFORE any expensive resolve / dispatch.
        decision = await OrgMeetingPolicyRepo(db).evaluate(
            workspace_id, organizer_email=parsed.get("organizer_email")
        )
        if not decision.allowed:
            logger.info(
                "meet_events.policy_skip",
                conference_id=conference_id,
                reason=decision.reason,
            )
            return {"status": "policy_skip", "reason": decision.reason}

        # Resolve the meetingUri via the Meet REST API (impersonated).
        meeting_uri = await self._resolve_meeting_uri(db, workspace_id, parsed)
        if not meeting_uri:
            logger.warning(
                "meet_events.resolve_failed", conference_id=conference_id
            )
            return {"status": "resolve_failed", "conference_id": conference_id}

        platform = PlatformDetector.detect_platform(meeting_uri)
        if platform == "unknown" or not PlatformDetector.is_supported(platform):
            logger.info(
                "meet_events.unsupported_platform",
                conference_id=conference_id,
                platform=platform,
            )
            return {"status": "unsupported_platform", "platform": platform}

        meeting_id = await self._dispatch(
            db, workspace_id, meeting_uri, platform, notetaker_email
        )
        await sub_repo.mark_dispatched(
            conference_id=conference_id,
            meeting_id=meeting_id,
            meeting_uri=meeting_uri,
        )
        logger.info(
            "meet_events.dispatched",
            conference_id=conference_id,
            meeting_id=meeting_id,
            platform=platform,
            workspace_id=workspace_id,
        )
        return {
            "status": "dispatched",
            "conference_id": conference_id,
            "meeting_id": meeting_id,
        }

    async def _resolve_workspace_for_subject(
        self, db, subject: Optional[str]
    ) -> tuple[Optional[str], Optional[str]]:
        """Map the event subject (user) to its workspace + notetaker identity.

        We look the subject email up against subscription rows. When it can't be
        resolved (e.g. a single-org deployment), fall back to the only enabled
        org if there is exactly one.
        """
        sub_repo_table_email = self._extract_email(subject)
        if sub_repo_table_email:
            from ..integrations.google_workspace.events import _table  # noqa: PLC0415

            table = _table(db, "workspace_event_subscriptions")
            rows = await db.store.query_raw(
                f"SELECT workspace_id FROM {table} "
                f"WHERE target_user_email = $1 LIMIT 1",
                sub_repo_table_email,
            )
            if rows:
                ws = str(dict(rows[0]).get("workspace_id"))
                notetaker = await GoogleWorkspaceOrgRepo(db).get_notetaker_email(ws)
                return ws, notetaker

        # Fallback: a single enabled org.
        orgs = await GoogleWorkspaceOrgRepo(db).list_enabled()
        if len(orgs) == 1:
            return orgs[0]["workspace_id"], orgs[0].get("notetaker_email")
        return None, None

    @staticmethod
    def _extract_email(subject: Optional[str]) -> Optional[str]:
        if not subject:
            return None
        # subject may be a bare email or a resource path containing one.
        if "@" in subject:
            # take the token that looks like an email
            for token in subject.replace("/", " ").split():
                if "@" in token:
                    return token
        return None

    async def _resolve_meeting_uri(
        self, db, workspace_id: Optional[str], parsed: Dict[str, Any]
    ) -> Optional[str]:
        if not workspace_id:
            return None
        org_repo = GoogleWorkspaceOrgRepo(db)
        auth_config = await org_repo.get_auth_config(workspace_id)
        if auth_config is None:
            return None
        auth = get_workspace_auth(auth_config)
        resolver = MeetSpaceResolver(auth, scopes=MEET_EVENTS_SCOPES)
        # Impersonate the subject user (the meeting host/participant) so the
        # Meet REST API can read the space.
        impersonate = (
            self._extract_email(parsed.get("subject"))
            or auth_config.delegated_admin_email
        )
        if not impersonate:
            return None
        return await asyncio.to_thread(
            resolver.resolve_meeting_uri,
            user_email=impersonate,
            space_name=parsed.get("space_name"),
            conference_record=parsed.get("conference_record"),
        )

    async def _dispatch(
        self,
        db,
        workspace_id: Optional[str],
        meeting_uri: str,
        platform: str,
        notetaker_email: Optional[str],
    ) -> Optional[str]:
        from ..services.meeting_service import MeetingService  # noqa: PLC0415

        service = MeetingService(db)
        record = await service.create_meeting(
            meeting_url=meeting_uri,
            org_id=None,
            bot_name=None,
            transcript_source=None,
            scheduled_at=None,
        )
        if getattr(record, "is_duplicate", False):
            logger.info("meet_events.duplicate_meeting_url", meeting_id=str(record.id))
            return str(record.id)

        # Tag the meeting with its workspace for attribution.
        if workspace_id:
            from ..integrations.google_workspace.events import _table  # noqa: PLC0415

            try:
                table = _table(db, "meeting_joiner")
                await db.store.query_raw(
                    f"UPDATE {table} SET workspace_id = $1::uuid, updated_at = NOW() "
                    f"WHERE id = $2::uuid",
                    workspace_id,
                    str(record.id),
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("meet_events.tag_failed", error=str(exc))

        from ..main import dispatch_meeting, get_queue_service  # noqa: PLC0415

        queue_service = await get_queue_service()
        await dispatch_meeting(
            meeting_id=str(record.id),
            meeting_url=meeting_uri,
            platform=platform,
            transcript_source=None,
            bot_name=None,
            org_id=None,
            meeting_service=service,
            queue_service=queue_service,
            allow_on_demand=True,
            notetaker_email=notetaker_email,
        )
        return str(record.id)


# ── renewal background loop ─────────────────────────────────────────────────


class MeetEventsRenewer:
    """Background loop that renews Workspace Events subscriptions before expiry.

    No-ops when GOOGLE_WORKSPACE_ENABLED is false or no Pub/Sub topic is set, so
    it is safe to start unconditionally in the standalone lifespan.
    """

    def __init__(self) -> None:
        self._task: Optional[asyncio.Task[None]] = None
        self._running = False

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop(), name="meet-events-renewer")
        logger.info("meet_events_renewer.started")

    async def stop(self) -> None:
        self._running = False
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        logger.info("meet_events_renewer.stopped")

    async def _loop(self) -> None:
        while self._running:
            try:
                await self.renew_once()
            except asyncio.CancelledError:
                break
            except Exception as exc:  # noqa: BLE001
                logger.warning("meet_events_renewer.loop_error", error=str(exc))
            await asyncio.sleep(settings.MEET_EVENTS_RENEW_INTERVAL_S)

    async def renew_once(self) -> int:
        """Renew every subscription expiring within the lead window.

        Returns the count renewed. No-op when disabled / unconfigured.
        """
        if not settings.GOOGLE_WORKSPACE_ENABLED or not settings.GOOGLE_PUBSUB_TOPIC:
            return 0

        db = await get_db_connection()
        sub_repo = WorkspaceEventSubscriptionRepo(db)
        org_repo = GoogleWorkspaceOrgRepo(db)

        cutoff = datetime.now(UTC) + timedelta(
            minutes=settings.MEET_EVENTS_RENEW_LEAD_MINUTES
        )
        candidates = await sub_repo.list_renewable(before=cutoff)
        if not candidates:
            return 0

        # Group by workspace so we mint one auth per org.
        renewed = 0
        auth_cache: Dict[str, Any] = {}
        for row in candidates:
            ws = str(row.get("workspace_id"))
            email = row.get("target_user_email")
            sub_id = row.get("google_subscription_id")
            if not email or not sub_id:
                continue
            try:
                if ws not in auth_cache:
                    auth_config = await org_repo.get_auth_config(ws)
                    auth_cache[ws] = (
                        get_workspace_auth(auth_config) if auth_config else None
                    )
                auth = auth_cache[ws]
                if auth is None:
                    continue
                client = WorkspaceEventsClient(
                    auth, pubsub_topic=settings.GOOGLE_PUBSUB_TOPIC
                )
                result = await asyncio.to_thread(
                    client.renew_subscription, email, sub_id
                )
                await sub_repo.upsert_subscription(workspace_id=ws, result=result)
                renewed += 1
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "meet_events_renewer.renew_failed",
                    subscription_id=sub_id,
                    error=str(exc),
                )
                await sub_repo.mark_state(str(row.get("id")), "error")
        if renewed:
            logger.info("meet_events_renewer.renewed", count=renewed)
        return renewed


_renewer_singleton: Optional[MeetEventsRenewer] = None


def get_meet_events_renewer() -> MeetEventsRenewer:
    global _renewer_singleton
    if _renewer_singleton is None:
        _renewer_singleton = MeetEventsRenewer()
    return _renewer_singleton


async def close_meet_events_renewer() -> None:
    global _renewer_singleton
    if _renewer_singleton is not None:
        await _renewer_singleton.stop()
        _renewer_singleton = None
