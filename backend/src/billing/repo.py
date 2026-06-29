"""Persistence for workspace billing + monthly meeting count."""

from __future__ import annotations

from typing import Any, Dict, Optional

_COLS = (
    "workspace_id, plan, status, seats, stripe_customer_id, "
    "stripe_subscription_id, current_period_end, created_at, updated_at"
)

DEFAULTS = {"plan": "free", "status": "active", "seats": 1}


class BillingRepo:
    def __init__(self, db) -> None:
        self._db = db

    async def get(self, workspace_id: str) -> Dict[str, Any]:
        rows = await self._db.store.query_raw(
            f"SELECT {_COLS} FROM workspace_billing WHERE workspace_id = $1::uuid",
            workspace_id,
        )
        return rows[0] if rows else {**DEFAULTS, "workspace_id": workspace_id}

    async def set_plan(
        self,
        *,
        workspace_id: str,
        plan: str,
        status: str = "active",
        stripe_customer_id: Optional[str] = None,
        stripe_subscription_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        rows = await self._db.store.query_raw(
            f"""
            INSERT INTO workspace_billing
              (workspace_id, plan, status, stripe_customer_id, stripe_subscription_id)
            VALUES ($1::uuid, $2, $3, $4, $5)
            ON CONFLICT (workspace_id) DO UPDATE SET
              plan = EXCLUDED.plan,
              status = EXCLUDED.status,
              stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, workspace_billing.stripe_customer_id),
              stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, workspace_billing.stripe_subscription_id),
              updated_at = now()
            RETURNING {_COLS}
            """,
            workspace_id,
            plan,
            status,
            stripe_customer_id,
            stripe_subscription_id,
        )
        return rows[0]

    async def meetings_this_month(self, workspace_id: str) -> int:
        rows = await self._db.store.query_raw(
            "SELECT count(*) AS n FROM meeting_joiner "
            "WHERE workspace_id = $1::uuid "
            "AND created_at >= date_trunc('month', now())",
            workspace_id,
        )
        return int(rows[0]["n"]) if rows else 0

    async def set_plan_by_subscription(
        self, *, stripe_subscription_id: str, plan: str, status: str
    ) -> Optional[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            f"UPDATE workspace_billing SET plan = $2, status = $3, updated_at = now() "
            f"WHERE stripe_subscription_id = $1 RETURNING {_COLS}",
            stripe_subscription_id,
            plan,
            status,
        )
        return rows[0] if rows else None
