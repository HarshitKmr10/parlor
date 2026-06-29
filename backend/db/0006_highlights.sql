-- Meeting highlights / clips / bookmarks (Round 3).
--
-- Idempotent. Run AFTER db/bootstrap.sql, db/0002_product_auth.sql and
-- db/0003_calendar_integrations.sql against the same database. Re-running is
-- safe — every statement is guarded with IF NOT EXISTS.
--
-- Adds:
--   - meeting_highlights: timestamped moments a user marks on a meeting
--     (the flagship "clip / soundbite / bookmark" feature of tl;dv & Fathom).
--     A highlight is a [t_start_sec, t_end_sec] range on the recording with an
--     optional label/note and a snapshot of the transcript text in that range
--     so the reel still reads even if the transcript is later edited.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS meeting_highlights (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id    UUID NOT NULL,
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  t_start_sec   DOUBLE PRECISION NOT NULL,
  t_end_sec     DOUBLE PRECISION NOT NULL,
  label         TEXT,
  note          TEXT,
  color         VARCHAR(20),
  excerpt       TEXT,
  created_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- List a meeting's highlights in chronological order.
CREATE INDEX IF NOT EXISTS meeting_highlights_meeting_idx
  ON meeting_highlights (meeting_id, t_start_sec);

-- Power the cross-meeting "highlights reel" for a workspace (most recent first).
CREATE INDEX IF NOT EXISTS meeting_highlights_workspace_idx
  ON meeting_highlights (workspace_id, created_at DESC);

COMMIT;
