"""Developer webhooks: HMAC-signed outbound event delivery with retries.

The Recall-class developer feature and the foundation for Zapier/n8n/CRM
integrations. A workspace registers HTTPS endpoints; product events
(meeting.completed, transcript.ready, summary.ready, …) fan out to subscribed
endpoints as signed POSTs, with an exponential-backoff retry queue.

Public surface:
* :data:`EVENT_TYPES` / :func:`event_matches` — the event catalog + subscription test.
* :func:`sign_payload` / :func:`build_signature_header` — HMAC-SHA256 signing.
* :func:`backoff_seconds` — retry schedule.
* :func:`generate_secret` — endpoint signing secret.
* :class:`WebhooksRepo`, :class:`WebhookService`, :func:`emit_event`.
"""

from __future__ import annotations

from .events import EVENT_TYPES, backoff_seconds, event_matches, generate_secret
from .repo import WebhooksRepo
from .service import WebhookService, emit_event
from .signing import build_signature_header, sign_payload, verify_signature

__all__ = [
    "EVENT_TYPES",
    "event_matches",
    "backoff_seconds",
    "generate_secret",
    "sign_payload",
    "build_signature_header",
    "verify_signature",
    "WebhooksRepo",
    "WebhookService",
    "emit_event",
]
