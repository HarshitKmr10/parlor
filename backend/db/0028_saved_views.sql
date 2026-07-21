-- Saved views — named, reusable saved searches (workspace-scoped).
--
-- Idempotent. Run AFTER db/bootstrap.sql and db/0002_product_auth.sql.
--
-- Stores named searches (a query string plus optional structured filters) so
-- operators can re-run a common search with one click instead of retyping the
-- query and re-applying filters each time.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS saved_views (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  query         TEXT NOT NULL DEFAULT '',
  filters       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS saved_views_workspace_idx
  ON saved_views (workspace_id, created_at);

COMMIT;
