-- Auto-tag rules (workspace-scoped).
--
-- Idempotent. Run AFTER db/0031_meeting_tags.sql (references tags(id)).
--
-- Rules that automatically apply a meeting tag when a meeting's title matches
-- a pattern. `match_type` is one of 'title_contains' (literal, case-insensitive
-- substring) or 'title_regex' (a Python regular expression). Composes with the
-- Meeting Tags feature: a match adds `tag_id` to the meeting alongside any tags
-- already assigned. Cascades on workspace or tag deletion.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS auto_tag_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  pattern       TEXT NOT NULL,
  match_type    TEXT NOT NULL DEFAULT 'title_contains'
                  CHECK (match_type IN ('title_contains', 'title_regex')),
  tag_id        UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS auto_tag_rules_workspace_idx
  ON auto_tag_rules (workspace_id);

COMMIT;
