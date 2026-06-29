"""Best-effort SSRF guard for user-supplied webhook URLs.

Outbound webhooks POST to caller-controlled URLs from inside our network, so an
attacker could aim one at cloud metadata (169.254.169.254), localhost, or an
internal service. We reject obvious offenders at registration time: non-HTTPS
schemes, localhost names, and private/reserved IP literals.

This is registration-time validation only. A hostname can still resolve to a
private IP (or be rebound later), so production should ALSO enforce egress
filtering at the network layer. :func:`validate_webhook_url` documents that
boundary rather than pretending to be complete.
"""

from __future__ import annotations

import ipaddress
from urllib.parse import urlparse

_BLOCKED_HOSTNAMES = {
    "localhost",
    "ip6-localhost",
    "metadata",
    "metadata.google.internal",
}


class InvalidWebhookUrl(ValueError):
    """Raised when a webhook URL is unsafe or malformed."""


def validate_webhook_url(url: str) -> str:
    """Return the URL if it is a safe HTTPS target, else raise InvalidWebhookUrl."""
    parsed = urlparse((url or "").strip())

    if parsed.scheme != "https":
        raise InvalidWebhookUrl("Webhook URL must use https")
    host = parsed.hostname
    if not host:
        raise InvalidWebhookUrl("Webhook URL must include a host")

    lowered = host.lower()
    if (
        lowered in _BLOCKED_HOSTNAMES
        or lowered.endswith(".internal")
        or lowered.endswith(".local")
    ):
        raise InvalidWebhookUrl("Webhook URL host is not allowed")

    # If the host is an IP literal, reject private/reserved/loopback ranges.
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        ip = None
    if ip is not None and (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    ):
        raise InvalidWebhookUrl("Webhook URL must not point to a private/reserved IP")

    return url.strip()
