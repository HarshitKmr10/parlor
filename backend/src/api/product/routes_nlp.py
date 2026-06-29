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
    )


@router.get("", response_model=NlpSettings)
async def get_settings(
    ctx: AuthContext = Depends(get_current_context),
    repo: NlpSettingsRepo = Depends(_repo),
) -> NlpSettings:
    return _to_model(await repo.get(ctx.workspace.id))


@router.put("", response_model=NlpSettings)
async def put_settings(
    body: NlpSettingsUpdate,
    ctx: AuthContext = Depends(get_current_context),
    repo: NlpSettingsRepo = Depends(_repo),
) -> NlpSettings:
    row = await repo.upsert(
        workspace_id=ctx.workspace.id,
        redaction_enabled=body.redaction_enabled,
        redact_emails=body.redact_emails,
        redact_phones=body.redact_phones,
        redact_cards=body.redact_cards,
        custom_vocab=[v.strip() for v in body.custom_vocab if v.strip()],
    )
    return _to_model(row)
