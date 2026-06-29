-- Audit log (Round 17).
--
-- Idempotent. Run AFTER db/bootstrap.sql and db/0002_product_auth.sql.
--
-- An append-only record of sensitive actions (shares created/revoked, meetings
-- deleted, API keys minted/revoked, integrations changed) for security review.
-- Written best-effort via record_audit(); never blocks the action it records.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS audit_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  action        VARCHAR(80) NOT NULL,       -- e.g. share.created, meeting.deleted
  resource_type VARCHAR(40) NOT NULL,       -- meeting | share | api_key | integration
  resource_id   TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS audit_events_workspace_idx
  ON audit_events (workspace_id, created_at DESC);

COMMIT;
