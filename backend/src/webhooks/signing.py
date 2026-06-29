"""HMAC-SHA256 request signing (Stripe/Svix-style ``t=…,v1=…`` header).

The signed string is ``"{timestamp}.{body}"``; receivers recompute it with the
shared secret and compare in constant time, also checking the timestamp is
recent to defeat replay. Pure functions — no I/O.
"""

from __future__ import annotations

import hashlib
import hmac

_SIG_HEADER = "X-Verdant-Signature"
_DEFAULT_TOLERANCE_SEC = 300


def sign_payload(secret: str, body: str, timestamp: int) -> str:
    """Return the hex HMAC-SHA256 of ``"{timestamp}.{body}"``."""
    msg = f"{timestamp}.{body}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()


def build_signature_header(secret: str, body: str, timestamp: int) -> str:
    """Build the ``t=<ts>,v1=<sig>`` header value."""
    return f"t={timestamp},v1={sign_payload(secret, body, timestamp)}"


def _parse_header(header: str) -> tuple[int | None, str | None]:
    ts: int | None = None
    sig: str | None = None
    for part in (header or "").split(","):
        key, _, value = part.strip().partition("=")
        if key == "t":
            try:
                ts = int(value)
            except ValueError:
                ts = None
        elif key == "v1":
            sig = value
    return ts, sig


def verify_signature(
    secret: str,
    body: str,
    header: str,
    *,
    now: int,
    tolerance_sec: int = _DEFAULT_TOLERANCE_SEC,
) -> bool:
    """Verify a ``t=…,v1=…`` header: constant-time match + freshness window.

    Provided for receiver-side parity and tested both ways.
    """
    ts, sig = _parse_header(header)
    if ts is None or sig is None:
        return False
    if abs(now - ts) > tolerance_sec:
        return False
    expected = sign_payload(secret, body, ts)
    return hmac.compare_digest(expected, sig)
