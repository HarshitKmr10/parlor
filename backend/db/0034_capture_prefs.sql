-- Per-workspace auto-join preferences for calendar capture (Round 34).
--
-- Idempotent. Run AFTER db/bootstrap.sql and db/0002_product_auth.sql.
--
-- Controls how Parlor auto-joins meetings from connected calendars: a master
-- auto-join switch, how many minutes ahead to join, and per-platform toggles
-- (Zoom / Google Meet / Microsoft Teams). One row/workspace.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS workspace_capture_prefs (
  workspace_id      UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  auto_join_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  join_lead_minutes INTEGER NOT NULL DEFAULT 2,
  join_zoom         BOOLEAN NOT NULL DEFAULT TRUE,
  join_meet         BOOLEAN NOT NULL DEFAULT TRUE,
  join_teams        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
