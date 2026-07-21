-- Personal meeting notes (Round 33).
--
-- Idempotent. Run AFTER db/bootstrap.sql and db/0002_product_auth.sql.
--
-- A private, per-user free-text note attached to a meeting. Only the author
-- ever sees their own note — the primary key is (user_id, meeting_id), so each
-- user keeps an independent note per meeting. Cascades on workspace deletion.

BEGIN;

CREATE TABLE IF NOT EXISTS meeting_notes (
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL,
  meeting_id    UUID NOT NULL,
  body          TEXT NOT NULL DEFAULT '',
  updated_at    TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, meeting_id)
);

CREATE INDEX IF NOT EXISTS meeting_notes_workspace_meeting_idx
  ON meeting_notes (workspace_id, meeting_id);

COMMIT;
