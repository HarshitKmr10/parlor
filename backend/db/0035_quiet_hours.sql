-- Per-user notification quiet hours: a daily do-not-notify window (Round 35).
--
-- Idempotent. Run AFTER db/bootstrap.sql and db/0002_product_auth.sql.
--
-- A personal setting (one row per workspace member) controlling a daily window
-- during which digest/notification emails are suppressed. Hours are 0..23; the
-- window may wrap midnight (e.g. start 20, end 8), which is stored as-is.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS notification_quiet_hours (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL,
  enabled      BOOLEAN NOT NULL DEFAULT FALSE,
  start_hour   INTEGER NOT NULL DEFAULT 20,
  end_hour     INTEGER NOT NULL DEFAULT 8,
  updated_at   TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (workspace_id, user_id)
);

COMMIT;
