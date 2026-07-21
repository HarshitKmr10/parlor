-- Custom redaction rules (workspace-scoped).
--
-- Idempotent. Run AFTER db/bootstrap.sql and db/0002_product_auth.sql.
--
-- Complements workspace_nlp_settings (the fixed email/phone/card policy):
-- user-defined named rules that scrub additional patterns before a transcript
-- reaches the AI service, embeddings, or a public share page. `kind` is one of
-- 'builtin' (pattern = detector key: email|phone|credit_card|ssn|ipv4),
-- 'regex' (pattern = a Python regular expression), or 'keyword' (pattern = a
-- literal, case-insensitive substring). Fully local — no rule ever leaves the
-- machine.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS redaction_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'keyword'
                  CHECK (kind IN ('builtin', 'regex', 'keyword')),
  pattern       TEXT NOT NULL,
  replacement   TEXT NOT NULL DEFAULT '[REDACTED]',
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS redaction_rules_workspace_idx
  ON redaction_rules (workspace_id, created_at);

COMMIT;
