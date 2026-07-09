"""Per-workspace NLP settings API (PII redaction + custom vocabulary).

  GET /api/v1/nlp-settings
  PUT /api/v1/nlp-settings

Redaction strips emails/phones/cards from transcripts before they reach the AI
service, embeddings, and public share pages.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from ...redaction import NlpSettingsRepo
from ..database.connection import DatabaseConnection
from .deps import AuthContext, get_current_context, get_db
from .rbac import require_role
from .schemas import NlpSettings, NlpSettingsUpdate

router = APIRouter(prefix="/api/v1/nlp-settings", tags=["nlp"])


async def _repo(db: DatabaseConnection = Depends(get_db)) -> NlpSettingsRepo:
    return NlpSettingsRepo(db)


def _to_model(row: dict) -> NlpSettings:
    return NlpSettings(
        redaction_enabled=bool(row.get("redaction_enabled")),
        redact_emails=bool(row.get("redact_emails", True)),
        redact_phones=bool(row.get("redact_phones", True)),
        redact_cards=bool(row.get("redact_cards", True)),
        custom_vocab=list(row.get("custom_vocab") or []),
        summary_language=row.get("summary_language") or "en",
    )


@router.get(
    "",
    response_model=NlpSettings,
    summary="Get NLP/redaction settings",
    description=(
        "Returns the workspace's PII redaction configuration (emails/phones/"
        "cards), custom vocabulary, and summary language."
    ),
)
async def get_settings(
    ctx: AuthContext = Depends(get_current_context),
    repo: NlpSettingsRepo = Depends(_repo),
) -> NlpSettings:
    return _to_model(await repo.get(ctx.workspace.id))


@router.put(
    "",
    response_model=NlpSettings,
    summary="Update NLP/redaction settings",
    description=(
        "Updates PII redaction toggles, custom vocabulary, and summary "
        "language for the workspace. Redaction is applied before transcripts "
        "reach the AI service, embeddings, and public share pages. Requires "
        "the admin role."
    ),
)
async def put_settings(
    body: NlpSettingsUpdate,
    ctx: AuthContext = Depends(require_role("admin")),
    repo: NlpSettingsRepo = Depends(_repo),
) -> NlpSettings:
    row = await repo.upsert(
        workspace_id=ctx.workspace.id,
        redaction_enabled=body.redaction_enabled,
        redact_emails=body.redact_emails,
        redact_phones=body.redact_phones,
        redact_cards=body.redact_cards,
        custom_vocab=[v.strip() for v in body.custom_vocab if v.strip()],
        summary_language=body.summary_language or "en",
    )
    return _to_model(row)
