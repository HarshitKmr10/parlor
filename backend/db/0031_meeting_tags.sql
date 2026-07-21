-- Meeting tags (Round 31).
--
-- Idempotent. Run AFTER db/bootstrap.sql and db/0002_product_auth.sql.
--
-- Workspace-defined tags (name + color) that can be assigned to meetings for
-- organization. `tags` holds the definitions; `meeting_tags` is the join table
-- mapping meetings to tags. Both cascade on workspace deletion.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tags (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  color         TEXT NOT NULL DEFAULT '#6b7280',
  created_at    TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (workspace_id, name)
);

CREATE INDEX IF NOT EXISTS tags_workspace_idx ON tags (workspace_id);

CREATE TABLE IF NOT EXISTS meeting_tags (
  meeting_id    UUID NOT NULL,
  tag_id        UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (meeting_id, tag_id)
);

CREATE INDEX IF NOT EXISTS meeting_tags_workspace_idx ON meeting_tags (workspace_id);

COMMIT;
