"""Google -> us: Cloud Pub/Sub push webhook for ad-hoc Meet capture.

``POST /api/v1/google/pubsub/push`` receives Pub/Sub push deliveries carrying
Google Workspace Events CloudEvents about Meet conference lifecycle. On a
*conference started* event we resolve the Meet space ``meetingUri`` and dispatch
the notetaker bot — catching instant meetings that never touched a calendar.

This endpoint has NO product auth (it's Google calling, not a user). It instead
verifies the *sender* via an OIDC bearer token or a shared-secret query token
(:mod:`pubsub_verify`). Contract:

* Sender verification FAILS (a configured check rejects it) -> 401.
* Verification UNCONFIGURED (no org / no Pub/Sub) -> 202 ack-and-ignore, so the
  app boots with NO Google creds and Google's retries don't pile up.
* Unknown / non-conference events -> 202 ack-and-ignore.
* A *started* event -> 202 ack immediately; the resolve + dispatch run in a
  FastAPI background task so the ack is fast and Google doesn't redeliver on
  slow processing. Dedupe makes redelivery harmless anyway.
"""

from __future__ import annotations

import base64
import binascii
import json
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, Header, Request, Response

from shared.config import settings

from ...observability import get_logger
from ...services.meet_events_service import (
    MeetEventsService,
    parse_conference_event,
)
from .pubsub_verify import (
    is_pubsub_verification_configured,
    verify_pubsub_request,
)

logger = get_logger(__name__)

router = APIRouter(prefix="/api/v1/google/pubsub", tags=["google-pubsub"])


def _decode_envelope(body: dict[str, Any]) -> Optional[dict[str, Any]]:
    """Decode the Pub/Sub push envelope into the CloudEvent payload.

    The envelope is ``{ "message": { "data": <base64>, "attributes": {...} },
    "subscription": "..." }``. ``data`` is base64-encoded JSON (the CloudEvent).
    Returns ``None`` when the envelope is malformed.
    """
    message = body.get("message")
    if not isinstance(message, dict):
        return None
    data_b64 = message.get("data")
    if not data_b64:
        # An empty/attribute-only message — nothing to parse.
        return None
    try:
        raw = base64.b64decode(data_b64)
        decoded = json.loads(raw.decode("utf-8"))
    except (binascii.Error, ValueError, TypeError, UnicodeDecodeError):
        return None
    if not isinstance(decoded, dict):
        return None
    # CloudEvent attributes may also live on message.attributes (e.g. ce-type);
    # merge them in so parse_conference_event can read the type either way.
    attributes = message.get("attributes")
    if isinstance(attributes, dict):
        if "type" not in decoded and "ce-type" in attributes:
            decoded["type"] = attributes["ce-type"]
        if "subject" not in decoded and "ce-subject" in attributes:
            decoded["subject"] = attributes["ce-subject"]
    return decoded


async def _process_event(parsed: dict[str, Any]) -> None:
    """Background worker: resolve + dispatch. Errors are logged, never raised."""
    try:
        await MeetEventsService().handle_conference_event(parsed)
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "pubsub.process_failed",
            conference_id=parsed.get("conference_id"),
            error=str(exc),
        )


@router.post("/push")
async def pubsub_push(
    request: Request,
    background_tasks: BackgroundTasks,
    token: Optional[str] = None,
    authorization: Optional[str] = Header(None),
) -> Response:
    """Receive a Pub/Sub push delivery. Always acks fast (202) on success."""
    # 1) If verification is configured, ENFORCE it; reject bad senders (401).
    #    If nothing is configured (no creds yet), ack-and-ignore so Google's
    #    retries don't accumulate against an un-provisioned deployment.
    if is_pubsub_verification_configured():
        result = verify_pubsub_request(
            authorization=authorization, query_token=token
        )
        if not result.ok:
            logger.warning("pubsub.verify_failed", reason=result.reason)
            return Response(status_code=401)
    else:
        logger.info("pubsub.unconfigured_ack")
        return Response(status_code=202)

    # 2) If the master gate is off / no topic configured, ack-and-ignore too.
    if not settings.GOOGLE_WORKSPACE_ENABLED:
        return Response(status_code=202)

    # 3) Parse the envelope. Malformed -> ack (don't make Google retry junk).
    try:
        body = await request.json()
    except Exception:  # noqa: BLE001
        return Response(status_code=202)

    cloud_event = _decode_envelope(body if isinstance(body, dict) else {})
    if cloud_event is None:
        return Response(status_code=202)

    parsed = parse_conference_event(cloud_event)
    if parsed is None:
        # Non-conference / unknown event type -> ack and ignore.
        return Response(status_code=202)

    # Only act on conference-started (or participant-joined fallback). Both are
    # accepted by parse_conference_event; the dedupe + meeting-URL duplicate
    # check downstream means a participant.joined after a started won't double.
    background_tasks.add_task(_process_event, parsed)
    return Response(status_code=202)
