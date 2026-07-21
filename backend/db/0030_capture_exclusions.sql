-- Capture exclusions — do-not-record rules (workspace-scoped).
--
-- Idempotent. Run AFTER db/bootstrap.sql and db/0002_product_auth.sql.
--
-- Patterns that match a meeting's title or URL so Parlor never auto-joins or
-- records those meetings. `match_type` is one of 'title_contains' (pattern = a
-- literal, case-insensitive substring of the title), 'url_contains' (literal
-- substring of the URL), or 'title_regex' (pattern = a Python regular
-- expression matched against the title). Fully local — no rule ever leaves the
-- machine.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS capture_exclusions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  pattern       TEXT NOT NULL,
  match_type    TEXT NOT NULL DEFAULT 'title_contains'
                  CHECK (match_type IN ('title_contains', 'url_contains', 'title_regex')),
  note          TEXT,
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS capture_exclusions_workspace_idx
  ON capture_exclusions (workspace_id);

COMMIT;
