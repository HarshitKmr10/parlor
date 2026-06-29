-- Meeting comments + @mentions (Round 5).
--
-- Idempotent. Run AFTER db/bootstrap.sql, db/0002_product_auth.sql and
-- db/0003_calendar_integrations.sql. Re-running is safe.
--
-- Adds:
--   - meeting_comments: threaded comments on a meeting, optionally anchored to a
--     timestamp or transcript segment (collaboration on specific moments — the
--     review layer in tl;dv/Fathom/Fireflies). @mentions reference workspace
--     members; the validated set is denormalized into mentioned_user_ids so a
--     notification fan-out can read it without re-parsing the body.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS meeting_comments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id          UUID NOT NULL,
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  author_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  parent_id           UUID REFERENCES meeting_comments(id) ON DELETE CASCADE,
  body                TEXT NOT NULL,
  anchor_t_sec        DOUBLE PRECISION,
  anchor_segment_id   TEXT,
  mentioned_user_ids  UUID[] NOT NULL DEFAULT '{}',
  resolved            BOOLEAN NOT NULL DEFAULT FALSE,
  edited              BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- List a meeting's comments chronologically (thread tree built client-side).
CREATE INDEX IF NOT EXISTS meeting_comments_meeting_idx
  ON meeting_comments (meeting_id, created_at ASC);

CREATE INDEX IF NOT EXISTS meeting_comments_workspace_idx
  ON meeting_comments (workspace_id);

-- "Comments that mention me" inbox across a workspace.
CREATE INDEX IF NOT EXISTS meeting_comments_mentions_gin
  ON meeting_comments USING GIN (mentioned_user_ids);

COMMIT;
