-- Per-workspace NLP settings: PII redaction + custom vocabulary (Round 16).
--
-- Idempotent. Run AFTER db/bootstrap.sql and db/0002_product_auth.sql.
--
-- Redaction strips emails/phones/cards from transcripts before they reach the
-- AI service, embeddings, and public share pages. Custom vocabulary is threaded
-- into the summarizer so jargon/names are spelled correctly. One row/workspace.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS workspace_nlp_settings (
  workspace_id      UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  redaction_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  redact_emails     BOOLEAN NOT NULL DEFAULT TRUE,
  redact_phones     BOOLEAN NOT NULL DEFAULT TRUE,
  redact_cards      BOOLEAN NOT NULL DEFAULT TRUE,
  custom_vocab      TEXT[] NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
