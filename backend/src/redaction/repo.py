"""Persistence for per-workspace NLP settings (redaction + custom vocab)."""

from __future__ import annotations

from typing import Any, Dict, Optional, Sequence

_COLS = (
    "workspace_id, redaction_enabled, redact_emails, redact_phones, "
    "redact_cards, custom_vocab, summary_language, created_at, updated_at"
)

DEFAULTS: Dict[str, Any] = {
    "redaction_enabled": False,
    "redact_emails": True,
    "redact_phones": True,
    "redact_cards": True,
    "custom_vocab": [],
    "summary_language": "en",
}


class NlpSettingsRepo:
    def __init__(self, db) -> None:
        self._db = db

    async def get(self, workspace_id: str) -> Dict[str, Any]:
        rows = await self._db.store.query_raw(
            f"SELECT {_COLS} FROM workspace_nlp_settings WHERE workspace_id = $1::uuid",
            workspace_id,
        )
        return rows[0] if rows else {**DEFAULTS, "workspace_id": workspace_id}

    async def upsert(
        self,
        *,
        workspace_id: str,
        redaction_enabled: bool,
        redact_emails: bool,
        redact_phones: bool,
        redact_cards: bool,
        custom_vocab: Sequence[str],
        summary_language: str = "en",
    ) -> Dict[str, Any]:
        rows = await self._db.store.query_raw(
            f"""
            INSERT INTO workspace_nlp_settings
              (workspace_id, redaction_enabled, redact_emails, redact_phones,
               redact_cards, custom_vocab, summary_language)
            VALUES ($1::uuid, $2, $3, $4, $5, $6::text[], $7)
            ON CONFLICT (workspace_id) DO UPDATE SET
              redaction_enabled = EXCLUDED.redaction_enabled,
              redact_emails = EXCLUDED.redact_emails,
              redact_phones = EXCLUDED.redact_phones,
              redact_cards = EXCLUDED.redact_cards,
              custom_vocab = EXCLUDED.custom_vocab,
              summary_language = EXCLUDED.summary_language,
              updated_at = now()
            RETURNING {_COLS}
            """,
            workspace_id,
            redaction_enabled,
            redact_emails,
            redact_phones,
            redact_cards,
            list(custom_vocab),
            summary_language,
        )
        return rows[0]
