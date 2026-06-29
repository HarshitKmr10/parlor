"""Unit tests for RBAC role checks + usage aggregation."""

from src.api.product.rbac import role_satisfies
from src.usage import summarize_usage


def test_role_hierarchy():
    assert role_satisfies("owner", "admin") is True
    assert role_satisfies("admin", "admin") is True
    assert role_satisfies("member", "admin") is False
    assert role_satisfies("owner", "member") is True
    assert role_satisfies(None, "member") is False
    assert role_satisfies("admin", "owner") is False


def test_usage_summary_aggregates():
    meetings = [
        {"id": "1", "status": "completed", "created_by": "u1", "duration_sec": 600},
        {"id": "2", "status": "completed", "created_by": "u1", "duration_sec": 1200},
        {"id": "3", "status": "failed", "created_by": "u2", "duration_sec": 0},
    ]
    out = summarize_usage(meetings)
    assert out["meeting_count"] == 3
    assert out["completed_count"] == 2
    assert out["total_minutes"] == 30.0
    assert out["active_members"] == 2
    top = out["per_creator"][0]
    assert top["creator"] == "u1" and top["meetings"] == 2


def test_usage_empty():
    out = summarize_usage([])
    assert out["meeting_count"] == 0
    assert out["per_creator"] == []
