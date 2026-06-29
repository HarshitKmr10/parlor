-- Retention & compliance settings (Round 18).
--
-- Idempotent. Run AFTER db/bootstrap.sql and db/0002_product_auth.sql.
--
-- Per-workspace data-retention policy. A background sweeper deletes meetings
-- (and their embeddings) older than retention_days, UNLESS legal_hold is set.
-- retention_days NULL = keep forever. Pairs with the data-export endpoint for
-- GDPR/portability.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS workspace_retention_settings (
  workspace_id    UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  retention_days  INT,                              -- NULL = keep forever
  legal_hold      BOOLEAN NOT NULL DEFAULT FALSE,   -- pause all deletion
  last_swept_at   TIMESTAMPTZ(6),
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
