-- Custom summary templates (Round 7).
--
-- Idempotent. Run AFTER db/bootstrap.sql and db/0002_product_auth.sql.
-- Re-running is safe.
--
-- Adds:
--   - summary_templates: per-workspace named summary formats (a prompt +
--     ordered section list) chosen per meeting type — sales call, standup, 1:1,
--     interview, etc. The selected (or workspace-default) template's
--     instructions are passed to the summarizer. Mirrors the custom-summary
--     feature in Fathom / tl;dv / Fireflies.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS summary_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  name          VARCHAR(120) NOT NULL,
  instructions  TEXT NOT NULL DEFAULT '',
  sections      TEXT[] NOT NULL DEFAULT '{}',
  is_default    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- One template per (workspace, name) — case-insensitive.
CREATE UNIQUE INDEX IF NOT EXISTS summary_templates_ws_name_uk
  ON summary_templates (workspace_id, LOWER(name));

-- At most one default template per workspace.
CREATE UNIQUE INDEX IF NOT EXISTS summary_templates_one_default_uk
  ON summary_templates (workspace_id)
  WHERE is_default;

CREATE INDEX IF NOT EXISTS summary_templates_workspace_idx
  ON summary_templates (workspace_id, created_at DESC);

COMMIT;
