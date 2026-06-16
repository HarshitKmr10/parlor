"""Authenticate Cloud Pub/Sub push requests to our webhook.

The push webhook carries NO product JWT — it is Google calling us, not a user.
Instead we verify the *sender* is our Pub/Sub push subscription using one of two
mechanisms, in priority order:

1. **OIDC bearer token** (preferred). The push subscription is configured with
   an OIDC token; Google signs a JWT whose ``aud`` is the push endpoint and
   ``iss`` is ``https://accounts.google.com``. We verify the signature against
   Google's public certs and check the audience (and optionally the
   service-account email). Requires ``GOOGLE_PUBSUB_OIDC_AUDIENCE``.

2. **Shared-secret query token** (fallback). The push URL is configured with
   ``?token=<secret>``; we compare it (constant-time) to
   ``GOOGLE_PUBSUB_VERIFICATION_TOKEN``.

When NEITHER is configured, verification cannot succeed — the caller treats an
unverifiable-but-unconfigured request per the ack-and-ignore degradation rule;
a request that *fails* a configured check is rejected (401).
"""

from __future__ import annotations

import hmac
from dataclasses import dataclass
from typing import Optional

from shared.config import settings


@dataclass(frozen=True)
class VerifyResult:
    ok: bool
    reason: str


def _bearer(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return None


def _verify_oidc(token: str) -> VerifyResult:
    """Verify a Google-signed OIDC token against the configured audience."""
    audience = settings.GOOGLE_PUBSUB_OIDC_AUDIENCE
    if not audience:
        return VerifyResult(False, "oidc_not_configured")
    try:
        # Lazy import: google-auth is only needed when OIDC is configured, and
        # this keeps the webhook importable on boxes without it.
        from google.auth.transport import requests as g_requests  # noqa: PLC0415
        from google.oauth2 import id_token as g_id_token  # noqa: PLC0415

        request = g_requests.Request()
        claims = g_id_token.verify_oauth2_token(
            token, request, audience=audience
        )
    except Exception as exc:  # noqa: BLE001
        return VerifyResult(False, f"oidc_invalid: {exc}")

    issuer = claims.get("iss")
    if issuer not in ("https://accounts.google.com", "accounts.google.com"):
        return VerifyResult(False, "oidc_bad_issuer")

    expected_sa = settings.GOOGLE_PUBSUB_OIDC_SERVICE_ACCOUNT
    if expected_sa and claims.get("email") != expected_sa:
        return VerifyResult(False, "oidc_bad_service_account")
    if expected_sa and not claims.get("email_verified", False):
        return VerifyResult(False, "oidc_email_unverified")

    return VerifyResult(True, "oidc_ok")


def _verify_shared_secret(query_token: Optional[str]) -> VerifyResult:
    secret = settings.GOOGLE_PUBSUB_VERIFICATION_TOKEN
    if not secret:
        return VerifyResult(False, "shared_secret_not_configured")
    if not query_token:
        return VerifyResult(False, "missing_token")
    # Constant-time compare to avoid timing leaks.
    if hmac.compare_digest(str(query_token), str(secret)):
        return VerifyResult(True, "shared_secret_ok")
    return VerifyResult(False, "bad_token")


def is_pubsub_verification_configured() -> bool:
    """True when at least one verification mechanism is configured."""
    return bool(
        settings.GOOGLE_PUBSUB_OIDC_AUDIENCE
        or settings.GOOGLE_PUBSUB_VERIFICATION_TOKEN
    )


def verify_pubsub_request(
    *,
    authorization: Optional[str],
    query_token: Optional[str],
) -> VerifyResult:
    """Verify a Pub/Sub push request.

    Tries OIDC first (when configured), then the shared-secret token. Returns
    the first successful result, else the most informative failure.
    """
    # OIDC path.
    if settings.GOOGLE_PUBSUB_OIDC_AUDIENCE:
        token = _bearer(authorization)
        if token:
            oidc = _verify_oidc(token)
            if oidc.ok:
                return oidc
            # If OIDC is configured AND a token was presented but failed, and
            # there's no shared-secret fallback, reject on the OIDC reason.
            if not settings.GOOGLE_PUBSUB_VERIFICATION_TOKEN:
                return oidc

    # Shared-secret path.
    if settings.GOOGLE_PUBSUB_VERIFICATION_TOKEN:
        return _verify_shared_secret(query_token)

    # OIDC configured but no bearer token presented.
    if settings.GOOGLE_PUBSUB_OIDC_AUDIENCE:
        return VerifyResult(False, "missing_oidc_token")

    return VerifyResult(False, "not_configured")
