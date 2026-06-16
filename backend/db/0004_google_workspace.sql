-- Org-wide Google Workspace meeting capture (Round 3).
--
-- Idempotent. Run AFTER db/bootstrap.sql, db/0002_product_auth.sql, and
-- db/0003_calendar_integrations.sql against the same database. Re-running is
-- safe — every statement is guarded with IF NOT EXISTS or wrapped in a guard.
--
-- Adds:
--   - google_workspace_orgs: one row per workspace that has authorized
--                            org-wide capture. The service-account JSON is
--                            stored Fernet-ENCRYPTED at rest (same key as
--                            calendar tokens); the app encrypts before INSERT
--                            and decrypts only when minting impersonated creds.
--                            It is NEVER returned by the API.
--
-- auth_mode:
--   'dwd'         — domain-wide delegation via a service account (implemented).
--   'marketplace' — Workspace Marketplace app (interface reserved; stub impl).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── google_workspace_orgs ─────────────────────────────────────────────────
-- service_account_json: Fernet-encrypted ciphertext (TEXT), never plaintext.
--   Only populated for auth_mode='dwd'.
-- delegated_admin_email: the Workspace admin the service account impersonates
--   for Directory + admin-scoped calls (DWD requires a real subject user).
-- marketplace_client_id / marketplace_project_number: reserved for the
--   Marketplace app auth path (pass 2); nullable today.
CREATE TABLE IF NOT EXISTS google_workspace_orgs (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  domain                      VARCHAR(320),
  customer_id                 VARCHAR(64),
  auth_mode                   VARCHAR(20) NOT NULL DEFAULT 'dwd',
  service_account_json        TEXT,
  delegated_admin_email       VARCHAR(320),
  marketplace_client_id       VARCHAR(255),
  marketplace_project_number  VARCHAR(64),
  enabled                     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- One Google Workspace org config per workspace — POST upserts on this key.
CREATE UNIQUE INDEX IF NOT EXISTS google_workspace_orgs_workspace_id_uk
  ON google_workspace_orgs (workspace_id);

-- The org-wide sync iterates enabled orgs.
CREATE INDEX IF NOT EXISTS google_workspace_orgs_enabled_idx
  ON google_workspace_orgs (enabled);

COMMIT;
