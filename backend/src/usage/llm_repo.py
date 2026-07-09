"""Persistence + aggregation for per-workspace LLM token usage/cost.

Purely additive observability -- see ``db/0025_llm_usage_events.sql``. This
product has no billing; nothing here ever gates functionality, it only
reports numbers back to the workspace admin usage dashboard.

Usage rows are append-only and intentionally independent of meeting
lifecycle: ``meeting_id`` carries no foreign key to ``meeting_joiner`` so
soft/hard-deleting a meeting (retention sweeps, user-initiated delete) never
touches historical cost/token accounting (see 0025's header comment and
``src/compliance/repo.py`` for the meeting tombstone pattern this mirrors).
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from ..observability import get_logger

logger = get_logger(__name__)

Operation = Literal["summarize", "chat", "embed"]


class LlmUsageRecord(BaseModel):
    """Internal (snake_case) shape validated before an insert.

    Mirrors ai-service's ``TokenUsageOut`` (see
    ``ai-service/app/schemas.py``) plus the workspace/meeting/operation
    context the backend adds.
    """

    workspace_id: str
    meeting_id: Optional[str] = None
    operation: Operation
    provider: str
    model: str
    prompt_tokens: int = Field(ge=0)
    completion_tokens: int = Field(ge=0)
    total_tokens: int = Field(ge=0)
    estimated_cost_usd: Optional[float] = None


class LlmUsageRepo:
    def __init__(self, db) -> None:
        self._db = db

    async def record(self, record: LlmUsageRecord) -> None:
        await self._db.store.query_raw(
            """
            INSERT INTO llm_usage_events
              (workspace_id, meeting_id, operation, provider, model,
               prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd)
            VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9)
            """,
            record.workspace_id,
            record.meeting_id,
            record.operation,
            record.provider,
            record.model,
            record.prompt_tokens,
            record.completion_tokens,
            record.total_tokens,
            record.estimated_cost_usd,
        )

    async def get_totals(self, workspace_id: str) -> Dict[str, Any]:
        rows = await self._db.store.query_raw(
            """
            SELECT
              COALESCE(SUM(total_tokens), 0) AS total_tokens,
              COALESCE(SUM(estimated_cost_usd), 0) AS estimated_cost_usd,
              COUNT(*) AS call_count
            FROM llm_usage_events
            WHERE workspace_id = $1::uuid
            """,
            workspace_id,
        )
        row = rows[0] if rows else {}
        return {
            "total_tokens": int(row.get("total_tokens") or 0),
            "estimated_cost_usd": float(row.get("estimated_cost_usd") or 0),
            "call_count": int(row.get("call_count") or 0),
        }

    async def get_global_total(self) -> Dict[str, Any]:
        rows = await self._db.store.query_raw(
            """
            SELECT
              COALESCE(SUM(total_tokens), 0) AS total_tokens,
              COALESCE(SUM(estimated_cost_usd), 0) AS estimated_cost_usd,
              COUNT(*) AS call_count
            FROM llm_usage_events
            """
        )
        row = rows[0] if rows else {}
        return {
            "total_tokens": int(row.get("total_tokens") or 0),
            "estimated_cost_usd": float(row.get("estimated_cost_usd") or 0),
            "call_count": int(row.get("call_count") or 0),
        }

    async def get_breakdown_by_provider_model(
        self, workspace_id: str
    ) -> List[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            """
            SELECT
              provider,
              model,
              COALESCE(SUM(total_tokens), 0) AS total_tokens,
              COALESCE(SUM(estimated_cost_usd), 0) AS estimated_cost_usd,
              COUNT(*) AS call_count
            FROM llm_usage_events
            WHERE workspace_id = $1::uuid
            GROUP BY provider, model
            ORDER BY total_tokens DESC
            """,
            workspace_id,
        )
        return [
            {
                "provider": r["provider"],
                "model": r["model"],
                "total_tokens": int(r.get("total_tokens") or 0),
                "estimated_cost_usd": float(r.get("estimated_cost_usd") or 0),
                "call_count": int(r.get("call_count") or 0),
            }
            for r in rows
        ]

    async def get_daily_trend(
        self, workspace_id: str, *, days: int = 30
    ) -> List[Dict[str, Any]]:
        rows = await self._db.store.query_raw(
            """
            SELECT
              date_trunc('day', created_at) AS day,
              COALESCE(SUM(total_tokens), 0) AS total_tokens,
              COALESCE(SUM(estimated_cost_usd), 0) AS estimated_cost_usd
            FROM llm_usage_events
            WHERE workspace_id = $1::uuid
              AND created_at >= now() - ($2 || ' days')::interval
            GROUP BY day
            ORDER BY day ASC
            """,
            workspace_id,
            str(days),
        )
        return [
            {
                "date": r["day"].date().isoformat()
                if hasattr(r["day"], "date")
                else str(r["day"]),
                "total_tokens": int(r.get("total_tokens") or 0),
                "estimated_cost_usd": float(r.get("estimated_cost_usd") or 0),
            }
            for r in rows
        ]


def usage_record_from_ai_response(
    *,
    workspace_id: str,
    meeting_id: Optional[str],
    operation: Operation,
    data: Optional[Dict[str, Any]],
) -> Optional[LlmUsageRecord]:
    """Build an ``LlmUsageRecord`` from an ai-service response body.

    Returns ``None`` when there's nothing to persist: ``data`` itself is
    missing/falsy, or its ``usage`` field is ``null`` (mock mode, or the
    ai-service call errored before usage was computed). Never raises on a
    malformed/partial ``usage`` payload -- observability must not be able to
    break the calling flow.
    """
    if not data:
        return None
    usage = data.get("usage")
    if not usage or not isinstance(usage, dict):
        return None
    try:
        return LlmUsageRecord(
            workspace_id=workspace_id,
            meeting_id=meeting_id,
            operation=operation,
            provider=str(usage.get("provider") or "unknown"),
            model=str(usage.get("model") or "unknown"),
            prompt_tokens=int(usage.get("promptTokens") or usage.get("prompt_tokens") or 0),
            completion_tokens=int(
                usage.get("completionTokens") or usage.get("completion_tokens") or 0
            ),
            total_tokens=int(usage.get("totalTokens") or usage.get("total_tokens") or 0),
            estimated_cost_usd=(
                usage.get("estimatedCostUsd")
                if usage.get("estimatedCostUsd") is not None
                else usage.get("estimated_cost_usd")
            ),
        )
    except Exception:  # noqa: BLE001 — malformed usage must never break the caller
        return None


async def capture_llm_usage(
    db,
    *,
    workspace_id: str,
    meeting_id: Optional[str],
    operation: Operation,
    data: Optional[Dict[str, Any]],
) -> None:
    """Best-effort: persist token usage from an ai-service response, if any.

    Never raises -- a usage-tracking failure must never fail (or even log
    loudly over) the calling request/pipeline.
    """
    try:
        record = usage_record_from_ai_response(
            workspace_id=workspace_id,
            meeting_id=meeting_id,
            operation=operation,
            data=data,
        )
        if record is None:
            return
        await LlmUsageRepo(db).record(record)
    except Exception as exc:  # noqa: BLE001 — observability must not break callers
        logger.warning("llm_usage.capture_failed", operation=operation, error=str(exc))
