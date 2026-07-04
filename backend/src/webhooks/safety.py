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
import socket
from urllib.parse import urlparse

_BLOCKED_HOSTNAMES = {
    "localhost",
    "ip6-localhost",
    "metadata",
    "metadata.google.internal",
}


class InvalidWebhookUrl(ValueError):
    """Raised when a webhook URL is unsafe or malformed."""


def _as_ip_literal(host: str) -> ipaddress.IPv4Address | ipaddress.IPv6Address | None:
    """Parse `host` as an IP address, including legacy IPv4 notations
    `ipaddress.ip_address` does NOT recognize (decimal: "2130706433",
    octal: "0177.0.0.1", hex: "0x7f.0.0.1" — all resolve to 127.0.0.1 at the
    OS resolver level via `socket.inet_aton`'s historical BSD behavior).

    Security-review-caught bypass: the private/loopback/reserved check below
    only ever ran on the dotted-decimal form `ipaddress.ip_address` accepts —
    a host string in one of these alternate notations parsed as `ip=None`
    and silently skipped the check entirely, then still resolved to the
    real (blocked-in-intent) IP when something actually connected to it.
    """
    try:
        return ipaddress.ip_address(host)
    except ValueError:
        pass
    try:
        return ipaddress.ip_address(socket.inet_ntoa(socket.inet_aton(host)))
    except (OSError, ValueError):
        return None


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

    # If the host is an IP literal (in any notation), reject
    # private/reserved/loopback ranges.
    ip = _as_ip_literal(host)
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
