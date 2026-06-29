-- Speaker identity profiles (Round 14).
--
-- Idempotent. Run AFTER db/bootstrap.sql and db/0002_product_auth.sql.
--
-- Maps the per-meeting diarized speaker labels ("Speaker 1", "Bob") to a
-- persistent named person in the workspace, so analytics and transcripts can
-- show real names + per-person rollups across meetings (Fireflies/Otter-style).
-- `aliases` holds the lowercased labels that resolve to this profile.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS speaker_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL,
  email         TEXT,
  aliases       TEXT[] NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS speaker_profiles_workspace_idx
  ON speaker_profiles (workspace_id);

COMMIT;
