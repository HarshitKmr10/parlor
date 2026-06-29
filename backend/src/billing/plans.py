"""Plan tiers + quota math (pure)."""

from __future__ import annotations

from typing import Any, Dict, Optional

# meetings_per_month: None = unlimited.
PLANS: Dict[str, Dict[str, Any]] = {
    "free": {"name": "Free", "meetings_per_month": 10, "seats": 3, "price_usd": 0},
    "pro": {"name": "Pro", "meetings_per_month": 200, "seats": 15, "price_usd": 20},
    "business": {"name": "Business", "meetings_per_month": None, "seats": 100, "price_usd": 60},
}


def plan_quota(plan: str) -> Dict[str, Any]:
    return PLANS.get(plan, PLANS["free"])


def within_meeting_quota(plan: str, meetings_this_month: int) -> bool:
    """True if another meeting may be created under the plan's monthly cap."""
    cap: Optional[int] = plan_quota(plan)["meetings_per_month"]
    if cap is None:
        return True
    return meetings_this_month < cap
