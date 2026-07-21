"""Custom redaction rules API (workspace-scoped).

  GET/POST            /api/v1/redaction/rules
  PATCH/DELETE        /api/v1/redaction/rules/{id}
  POST                /api/v1/redaction/preview

Rules layer on top of the fixed email/phone/card policy (see routes_nlp.py):
user-defined named patterns scrubbed from transcripts before they reach the AI
service, embeddings, or a public share page. The preview endpoint runs the full
rule set against sample text so an operator can see exactly what gets removed —
entirely local, nothing leaves the machine.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from ...redaction import (
    InvalidRuleError,
    RedactionRulesRepo,
    redact,
    rules_from_rows,
    validate_rule,
)
from ..database.connection import DatabaseConnection
from .deps import AuthContext, get_current_context, get_db
from .errors import ApiError
from .schemas import (
    RedactionPreviewRequest,
    RedactionPreviewResponse,
    RedactionRule,
    RedactionRuleCreate,
    RedactionRuleUpdate,
)

router = APIRouter(prefix="/api/v1/redaction", tags=["redaction"])


async def _repo(db: DatabaseConnection = Depends(get_db)) -> RedactionRulesRepo:
    return RedactionRulesRepo(db)


def _to_rule(row: dict) -> RedactionRule:
    return RedactionRule(
        id=str(row["id"]),
        name=row["name"],
        kind=row["kind"],
        pattern=row["pattern"],
        replacement=row.get("replacement") or "[REDACTED]",
        enabled=bool(row["enabled"]),
    )


@router.get(
    "/rules",
    response_model=list[RedactionRule],
    summary="List redaction rules",
    description="Returns all custom redaction rules configured for the workspace.",
)
async def list_rules(
    ctx: AuthContext = Depends(get_current_context),
    repo: RedactionRulesRepo = Depends(_repo),
) -> list[RedactionRule]:
    return [_to_rule(r) for r in await repo.list(ctx.workspace.id)]


@router.post(
    "/rules",
    response_model=RedactionRule,
    status_code=201,
    summary="Create a redaction rule",
    description=(
        "Creates a custom redaction rule. The pattern is validated up front — "
        "an unknown builtin detector or an uncompilable regex returns 422."
    ),
)
async def create_rule(
    body: RedactionRuleCreate,
    ctx: AuthContext = Depends(get_current_context),
    repo: RedactionRulesRepo = Depends(_repo),
) -> RedactionRule:
    try:
        validate_rule(body.kind, body.pattern)
    except InvalidRuleError as exc:
        raise ApiError(422, "invalid_rule", str(exc)) from exc
    row = await repo.create(
        workspace_id=ctx.workspace.id,
        name=body.name.strip(),
        kind=body.kind,
        pattern=body.pattern,
        replacement=body.replacement or "[REDACTED]",
    )
    return _to_rule(row)


@router.patch(
    "/rules/{rule_id}",
    response_model=RedactionRule,
    summary="Update a redaction rule",
    description="Updates a rule's fields. 404 if not found in this workspace, 422 for an invalid pattern.",
)
async def update_rule(
    rule_id: str,
    body: RedactionRuleUpdate,
    ctx: AuthContext = Depends(get_current_context),
    repo: RedactionRulesRepo = Depends(_repo),
) -> RedactionRule:
    if body.pattern is not None or body.kind is not None:
        existing = await repo.list(ctx.workspace.id)
        current = next((r for r in existing if str(r["id"]) == rule_id), None)
        if current is None:
            raise ApiError(404, "not_found", "Redaction rule not found")
        kind = body.kind or current["kind"]
        pattern = body.pattern if body.pattern is not None else current["pattern"]
        try:
            validate_rule(kind, pattern)
        except InvalidRuleError as exc:
            raise ApiError(422, "invalid_rule", str(exc)) from exc
    row = await repo.update(
        rule_id=rule_id,
        workspace_id=ctx.workspace.id,
        name=body.name.strip() if body.name else None,
        kind=body.kind,
        pattern=body.pattern,
        replacement=body.replacement,
        enabled=body.enabled,
    )
    if row is None:
        raise ApiError(404, "not_found", "Redaction rule not found")
    return _to_rule(row)


@router.delete(
    "/rules/{rule_id}",
    status_code=204,
    summary="Delete a redaction rule",
    description="Deletes a rule. 404 if not found in this workspace.",
)
async def delete_rule(
    rule_id: str,
    ctx: AuthContext = Depends(get_current_context),
    repo: RedactionRulesRepo = Depends(_repo),
) -> None:
    ok = await repo.delete(rule_id=rule_id, workspace_id=ctx.workspace.id)
    if not ok:
        raise ApiError(404, "not_found", "Redaction rule not found")


@router.post(
    "/preview",
    response_model=RedactionPreviewResponse,
    summary="Preview redaction",
    description=(
        "Applies every enabled custom rule for the workspace to the supplied "
        "sample text and returns the redacted result plus per-rule match counts. "
        "Runs fully locally; the sample text is not persisted."
    ),
)
async def preview(
    body: RedactionPreviewRequest,
    ctx: AuthContext = Depends(get_current_context),
    repo: RedactionRulesRepo = Depends(_repo),
) -> RedactionPreviewResponse:
    rows = await repo.list_enabled(ctx.workspace.id)
    result = redact(body.text, rules_from_rows(rows))
    return RedactionPreviewResponse(
        redacted=result.text,
        total_redactions=result.total_redactions,
        per_rule=result.per_rule,
    )
