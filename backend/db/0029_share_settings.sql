-- Per-workspace sharing defaults for public meeting share links (Round 29).
--
-- Idempotent. Run AFTER db/bootstrap.sql and db/0002_product_auth.sql.
--
-- Controls the defaults applied when a meeting is shared publicly: how long a
-- share link stays live (0 = never expire), whether a passcode is required, and
-- the default passcode to seed. One row/workspace.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS workspace_share_settings (
  workspace_id         UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  default_expiry_hours INTEGER NOT NULL DEFAULT 0,
  require_passcode     BOOLEAN NOT NULL DEFAULT FALSE,
  default_passcode     TEXT NOT NULL DEFAULT '',
  created_at           TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
