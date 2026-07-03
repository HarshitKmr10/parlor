-- Calendar accounts + outbound workspace integrations (Round 2).
--
-- Idempotent. Run AFTER db/bootstrap.sql and db/0002_product_auth.sql against
-- the same database. Re-running is safe — every statement is guarded with
-- IF NOT EXISTS or wrapped in a DO block.
--
-- Adds:
--   - calendar_accounts:    connected Google/Microsoft calendars per workspace.
--                           OAuth tokens are stored encrypted at rest (Fernet);
--                           the app encrypts before INSERT and decrypts on read.
--   - workspace_integrations: outbound recap destinations (slack, email,
--                           notion, hubspot) per workspace, config in JSONB.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── calendar_accounts ─────────────────────────────────────────────────────
-- provider: google | microsoft
-- access_token / refresh_token: Fernet-encrypted ciphertext (TEXT), never
-- plaintext. expires_at is the access-token expiry (clear timestamp, not
-- sensitive). auto_join drives the calendar poller.
CREATE TABLE IF NOT EXISTS calendar_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  provider      VARCHAR(20) NOT NULL,
  email         VARCHAR(320) NOT NULL,
  access_token  TEXT,
  refresh_token TEXT,
  expires_at    TIMESTAMPTZ(6),
  auto_join     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS calendar_accounts_workspace_id_idx
  ON calendar_accounts (workspace_id);
-- One connected account per (workspace, provider, email).
CREATE UNIQUE INDEX IF NOT EXISTS calendar_accounts_ws_provider_email_uk
  ON calendar_accounts (workspace_id, provider, LOWER(email));

-- ── workspace_integrations ────────────────────────────────────────────────
-- kind: slack | email | notion | hubspot
-- config: provider-specific JSON (e.g. {"webhookUrl": "..."} for slack,
-- {"to": ["a@b.com"]} for email). enabled gates delivery.
CREATE TABLE IF NOT EXISTS workspace_integrations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind          VARCHAR(40) NOT NULL,
  config        JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- One config row per (workspace, kind) — PUT upserts on this key.
CREATE UNIQUE INDEX IF NOT EXISTS workspace_integrations_ws_kind_uk
  ON workspace_integrations (workspace_id, kind);

-- ── calendar dedupe marker on meeting_joiner ──────────────────────────────
-- The calendar poller writes the source calendar event id so re-scans don't
-- double-book the same event. Nullable; only set for calendar-originated rows.
ALTER TABLE meeting_joiner
  ADD COLUMN IF NOT EXISTS calendar_event_id VARCHAR(512);
CREATE INDEX IF NOT EXISTS meeting_joiner_calendar_event_id_idx
  ON meeting_joiner (calendar_event_id);

COMMIT;
