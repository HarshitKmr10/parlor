"""Map Stripe webhook events to (plan, status). Pure + unit-testable.

Stripe price IDs map to plan tiers via env (STRIPE_PRICE_PRO / _BUSINESS); the
event's subscription status maps to our status. Unknown -> ('free','canceled').
"""

from __future__ import annotations

import os
from typing import Mapping, Optional, Tuple

_STATUS_MAP = {
    "active": "active",
    "trialing": "active",
    "past_due": "past_due",
    "unpaid": "past_due",
    "canceled": "canceled",
    "incomplete_expired": "canceled",
}


def plan_from_stripe_event(
    event: Mapping, env: Optional[Mapping[str, str]] = None
) -> Optional[Tuple[str, str]]:
    """Return (plan, status) for a subscription event, or None if irrelevant."""
    e = env if env is not None else os.environ
    etype = event.get("type", "")
    if not etype.startswith("customer.subscription."):
        return None
    obj = (event.get("data") or {}).get("object") or {}
    status = _STATUS_MAP.get(str(obj.get("status", "")), "active")
    if etype == "customer.subscription.deleted":
        return ("free", "canceled")

    # Resolve plan from the subscription's first price id.
    price_id = ""
    items = (obj.get("items") or {}).get("data") or []
    if items:
        price_id = str((items[0].get("price") or {}).get("id", ""))
    pro = e.get("STRIPE_PRICE_PRO", "")
    business = e.get("STRIPE_PRICE_BUSINESS", "")
    if price_id and price_id == business:
        return ("business", status)
    if price_id and price_id == pro:
        return ("pro", status)
    # Fallback: keep them on free if price isn't recognized.
    return ("free", status)
