-- First-class action items / tasks (Round 8).
--
-- Idempotent. Run AFTER db/bootstrap.sql and db/0002_product_auth.sql.
-- Re-running is safe.
--
-- Adds:
--   - action_items: AI-extracted or manually-added tasks promoted out of the
--     insights JSON into trackable rows — assignee, due date, done/undone, and a
--     cross-meeting "my tasks" view. The flagship tasks feature in Fireflies /
--     Fathom. AI items are deduped per meeting by a hash of their normalized
--     text so re-summarizing never duplicates them or clobbers user edits.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS action_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  meeting_id    UUID NOT NULL,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  text          TEXT NOT NULL,
  dedupe_key    TEXT NOT NULL,          -- md5(lower(trim(text))), for AI upsert
  assignee      TEXT,
  due_date      TEXT,
  done          BOOLEAN NOT NULL DEFAULT FALSE,
  source        VARCHAR(12) NOT NULL DEFAULT 'manual',  -- ai | manual
  created_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- AI items upsert on (meeting, dedupe_key) so re-summarizing is idempotent and
-- preserves user toggles. Manual items can repeat text, so this only constrains
-- ai-sourced rows.
CREATE UNIQUE INDEX IF NOT EXISTS action_items_meeting_dedupe_uk
  ON action_items (meeting_id, dedupe_key)
  WHERE source = 'ai';

-- Per-meeting list.
CREATE INDEX IF NOT EXISTS action_items_meeting_idx
  ON action_items (meeting_id, created_at ASC);

-- Cross-meeting "my open tasks" view (open first, then by assignee).
CREATE INDEX IF NOT EXISTS action_items_workspace_idx
  ON action_items (workspace_id, done, assignee);

COMMIT;
