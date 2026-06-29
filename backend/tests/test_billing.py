"""Unit tests for billing plans/quota + Stripe event mapping (pure)."""

from src.billing import plan_quota, within_meeting_quota
from src.billing.stripe_map import plan_from_stripe_event


def test_free_plan_quota():
    assert plan_quota("free")["meetings_per_month"] == 10
    assert within_meeting_quota("free", 9) is True
    assert within_meeting_quota("free", 10) is False


def test_business_is_unlimited():
    assert plan_quota("business")["meetings_per_month"] is None
    assert within_meeting_quota("business", 100000) is True


def test_unknown_plan_falls_back_to_free():
    assert plan_quota("enterprise-typo")["meetings_per_month"] == 10


ENV = {"STRIPE_PRICE_PRO": "price_pro", "STRIPE_PRICE_BUSINESS": "price_biz"}


def _sub_event(etype, status="active", price=None):
    obj = {"id": "sub_1", "status": status}
    if price:
        obj["items"] = {"data": [{"price": {"id": price}}]}
    return {"type": etype, "data": {"object": obj}}


def test_stripe_map_pro_active():
    assert plan_from_stripe_event(
        _sub_event("customer.subscription.created", price="price_pro"), ENV
    ) == ("pro", "active")


def test_stripe_map_business_past_due():
    assert plan_from_stripe_event(
        _sub_event("customer.subscription.updated", status="past_due", price="price_biz"),
        ENV,
    ) == ("business", "past_due")


def test_stripe_map_deleted_downgrades_to_free():
    assert plan_from_stripe_event(
        _sub_event("customer.subscription.deleted"), ENV
    ) == ("free", "canceled")


def test_stripe_map_ignores_unrelated_events():
    assert plan_from_stripe_event({"type": "invoice.paid"}, ENV) is None
