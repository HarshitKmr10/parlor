"""Billing API (workspace-scoped).

  GET  /api/v1/billing            -> plan, status, usage vs quota, plan catalog
  POST /api/v1/billing/checkout   -> Stripe Checkout URL (or mock upgrade in dev)
  POST /api/v1/billing/webhook    -> Stripe subscription events (unauthenticated)

When STRIPE_SECRET_KEY is unset, checkout performs a dev "mock upgrade" so the
flow is exercisable without a Stripe account.
"""

from __future__ import annotations

import os

import httpx
from fastapi import APIRouter, Depends, Request

from ...billing import BillingRepo, PLANS, plan_from_stripe_event, plan_quota
from ..database.connection import DatabaseConnection
from .deps import AuthContext, get_current_context, get_db
from .errors import ApiError
from .rbac import require_role
from .schemas import BillingStatus, CheckoutRequest, PlanInfo

router = APIRouter(prefix="/api/v1/billing", tags=["billing"])

_TIMEOUT = httpx.Timeout(15.0, connect=5.0)


async def _repo(db: DatabaseConnection = Depends(get_db)) -> BillingRepo:
    return BillingRepo(db)


def _plan_catalog() -> list[PlanInfo]:
    return [
        PlanInfo(
            key=k,
            name=v["name"],
            meetings_per_month=v["meetings_per_month"],
            seats=v["seats"],
            price_usd=v["price_usd"],
        )
        for k, v in PLANS.items()
    ]


@router.get("", response_model=BillingStatus)
async def get_billing(
    ctx: AuthContext = Depends(get_current_context),
    repo: BillingRepo = Depends(_repo),
) -> BillingStatus:
    row = await repo.get(ctx.workspace.id)
    used = await repo.meetings_this_month(ctx.workspace.id)
    return BillingStatus(
        plan=row["plan"],
        status=row["status"],
        meetings_this_month=used,
        meeting_quota=plan_quota(row["plan"])["meetings_per_month"],
        plans=_plan_catalog(),
    )


@router.post("/checkout", response_model=BillingStatus)
async def checkout(
    body: CheckoutRequest,
    ctx: AuthContext = Depends(require_role("admin")),
    repo: BillingRepo = Depends(_repo),
) -> BillingStatus:
    secret = os.environ.get("STRIPE_SECRET_KEY")
    if not secret:
        # Dev path: upgrade immediately so the flow works without Stripe.
        await repo.set_plan(workspace_id=ctx.workspace.id, plan=body.plan, status="active")
        return await get_billing(ctx, repo)  # type: ignore[arg-type]

    price = os.environ.get(
        "STRIPE_PRICE_PRO" if body.plan == "pro" else "STRIPE_PRICE_BUSINESS", ""
    )
    success_url = os.environ.get("STRIPE_SUCCESS_URL", "https://app.example.com/settings/billing")
    cancel_url = os.environ.get("STRIPE_CANCEL_URL", success_url)
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                "https://api.stripe.com/v1/checkout/sessions",
                auth=(secret, ""),
                data={
                    "mode": "subscription",
                    "line_items[0][price]": price,
                    "line_items[0][quantity]": "1",
                    "success_url": success_url,
                    "cancel_url": cancel_url,
                    "client_reference_id": ctx.workspace.id,
                },
            )
        if resp.status_code >= 400:
            raise ApiError(502, "stripe_error", "Stripe checkout failed")
        # The client should redirect to resp.json()["url"]; we surface it via
        # the dedicated header so the slim BillingStatus model stays stable.
        raise ApiError(
            303, "stripe_redirect", resp.json().get("url", ""),
        )
    except ApiError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise ApiError(502, "stripe_error", str(exc))


@router.post("/webhook", status_code=200)
async def stripe_webhook(
    request: Request, repo: BillingRepo = Depends(_repo)
) -> dict:
    # Signature verification (when STRIPE_WEBHOOK_SECRET set) would go here;
    # in dev we accept the JSON event directly.
    try:
        event = await request.json()
    except Exception:  # noqa: BLE001
        raise ApiError(400, "invalid_payload", "Invalid webhook payload")
    mapped = plan_from_stripe_event(event)
    if mapped is None:
        return {"handled": False}
    plan, status = mapped
    obj = (event.get("data") or {}).get("object") or {}
    sub_id = obj.get("id")
    if sub_id:
        await repo.set_plan_by_subscription(
            stripe_subscription_id=str(sub_id), plan=plan, status=status
        )
    return {"handled": True, "plan": plan, "status": status}
