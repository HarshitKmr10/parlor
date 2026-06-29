-- Topic / keyword trackers a.k.a. monitors (Round 15).
--
-- Idempotent. Run AFTER db/bootstrap.sql and db/0002_product_auth.sql.
--
-- User-defined trackers ("competitor", "pricing", "next steps") that flag
-- mentions across meetings. When a meeting is summarized, its transcript is
-- scanned for each enabled tracker's keywords; matches land in tracker_hits and
-- fan out to notifications + webhooks. Mirrors Fireflies Topic Trackers / Gong.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS trackers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  keywords      TEXT[] NOT NULL DEFAULT '{}',
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS trackers_workspace_idx ON trackers (workspace_id);

CREATE TABLE IF NOT EXISTS tracker_hits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id    UUID NOT NULL REFERENCES trackers(id) ON DELETE CASCADE,
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  meeting_id    UUID NOT NULL,
  matched_keyword TEXT NOT NULL,
  snippet       TEXT NOT NULL,
  segment_id    TEXT,
  t_start_sec   DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Re-summarizing a meeting must not duplicate hits.
  UNIQUE (tracker_id, meeting_id, segment_id, matched_keyword)
);

CREATE INDEX IF NOT EXISTS tracker_hits_tracker_idx
  ON tracker_hits (tracker_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tracker_hits_workspace_idx
  ON tracker_hits (workspace_id, created_at DESC);

COMMIT;
