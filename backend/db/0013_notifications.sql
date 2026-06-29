-- Notifications / activity inbox (Round 12).
--
-- Idempotent. Run AFTER db/bootstrap.sql and db/0002_product_auth.sql.
-- Re-running is safe.
--
-- Adds:
--   - notifications: per-user activity feed (mentions, assigned action items,
--     tracker hits, "your recap is ready"). A reusable notify() helper writes
--     rows here; the web inbox + bell read them. `type` is a short machine code,
--     `link` is the in-app path to open. Read state is per-row per-user.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          VARCHAR(40) NOT NULL,        -- mention | action_item | tracker | recap_ready | digest
  title         TEXT NOT NULL,
  body          TEXT,
  link          TEXT,                        -- in-app path, e.g. /meetings/{id}#comments
  meeting_id    UUID,                        -- optional source meeting
  actor_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  read          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- The hot query: a user's unread/recent feed, newest first.
CREATE INDEX IF NOT EXISTS notifications_user_idx
  ON notifications (user_id, read, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_workspace_idx
  ON notifications (workspace_id, created_at DESC);

COMMIT;
