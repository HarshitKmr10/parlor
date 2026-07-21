"""Auto-tag rules API (workspace-scoped).

  GET/POST       /api/v1/auto-tag-rules
  PATCH/DELETE   /api/v1/auto-tag-rules/{rule_id}

Rules that automatically apply a meeting tag when a meeting's title matches a
pattern. They compose with the Meeting Tags feature: when a rule matches, its
tag is added to the meeting alongside any tags already assigned (see the
summarize pipeline in routes_meetings.py). `match_type` is one of
'title_contains' (literal, case-insensitive substring) or 'title_regex' (a
Python regular expression), validated up front.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from ...auto_tag import AutoTagRulesRepo, InvalidAutoTagError, validate_rule
from ..database.connection import DatabaseConnection
from .deps import AuthContext, get_current_context, get_db
from .errors import ApiError
from .schemas import AutoTagRule, AutoTagRuleCreate, AutoTagRuleUpdate

router = APIRouter(prefix="/api/v1/auto-tag-rules", tags=["auto-tag-rules"])


async def _repo(db: DatabaseConnection = Depends(get_db)) -> AutoTagRulesRepo:
    return AutoTagRulesRepo(db)


def _to_rule(row: dict) -> AutoTagRule:
    return AutoTagRule(
        id=str(row["id"]),
        pattern=row["pattern"],
        match_type=row["match_type"],
        tag_id=str(row["tag_id"]),
        enabled=bool(row["enabled"]),
    )


@router.get(
    "",
    response_model=list[AutoTagRule],
    summary="List auto-tag rules",
    description="Returns all auto-tag rules configured for the workspace.",
)
async def list_rules(
    ctx: AuthContext = Depends(get_current_context),
    repo: AutoTagRulesRepo = Depends(_repo),
) -> list[AutoTagRule]:
    return [_to_rule(r) for r in await repo.list(ctx.workspace.id)]


@router.post(
    "",
    response_model=AutoTagRule,
    status_code=201,
    summary="Create an auto-tag rule",
    description=(
        "Creates an auto-tag rule. The pattern is validated up front — an empty "
        "pattern or an uncompilable regex returns 422."
    ),
)
async def create_rule(
    body: AutoTagRuleCreate,
    ctx: AuthContext = Depends(get_current_context),
    repo: AutoTagRulesRepo = Depends(_repo),
) -> AutoTagRule:
    try:
        validate_rule(body.match_type, body.pattern)
    except InvalidAutoTagError as exc:
        raise ApiError(422, "invalid_auto_tag", str(exc)) from exc
    row = await repo.create(
        workspace_id=ctx.workspace.id,
        pattern=body.pattern,
        match_type=body.match_type,
        tag_id=body.tag_id,
    )
    return _to_rule(row)


@router.patch(
    "/{rule_id}",
    response_model=AutoTagRule,
    summary="Update an auto-tag rule",
    description="Updates a rule's fields. 404 if not found in this workspace, 422 for an invalid pattern.",
)
async def update_rule(
    rule_id: str,
    body: AutoTagRuleUpdate,
    ctx: AuthContext = Depends(get_current_context),
    repo: AutoTagRulesRepo = Depends(_repo),
) -> AutoTagRule:
    if body.pattern is not None or body.match_type is not None:
        existing = await repo.list(ctx.workspace.id)
        current = next((r for r in existing if str(r["id"]) == rule_id), None)
        if current is None:
            raise ApiError(404, "not_found", "Auto-tag rule not found")
        match_type = body.match_type or current["match_type"]
        pattern = body.pattern if body.pattern is not None else current["pattern"]
        try:
            validate_rule(match_type, pattern)
        except InvalidAutoTagError as exc:
            raise ApiError(422, "invalid_auto_tag", str(exc)) from exc
    row = await repo.update(
        rule_id=rule_id,
        workspace_id=ctx.workspace.id,
        pattern=body.pattern,
        match_type=body.match_type,
        tag_id=body.tag_id,
        enabled=body.enabled,
    )
    if row is None:
        raise ApiError(404, "not_found", "Auto-tag rule not found")
    return _to_rule(row)


@router.delete(
    "/{rule_id}",
    status_code=204,
    summary="Delete an auto-tag rule",
    description="Deletes a rule. 404 if not found in this workspace.",
)
async def delete_rule(
    rule_id: str,
    ctx: AuthContext = Depends(get_current_context),
    repo: AutoTagRulesRepo = Depends(_repo),
) -> None:
    ok = await repo.delete(rule_id=rule_id, workspace_id=ctx.workspace.id)
    if not ok:
        raise ApiError(404, "not_found", "Auto-tag rule not found")
