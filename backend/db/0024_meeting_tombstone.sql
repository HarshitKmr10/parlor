-- Tombstone/recovery window for retention deletes (Round 24).
--
-- Idempotent. Run AFTER db/0019_retention.sql.
--
-- Replaces the retention sweeper's immediate hard-delete with a two-phase
-- delete: first sweep past retention_days soft-deletes (sets deleted_at) and
-- removes meeting_embeddings immediately; a later sweep hard-deletes rows
-- whose deleted_at is older than RETENTION_TOMBSTONE_DAYS (default 30). This
-- gives admins a recovery window if retention was misconfigured.

BEGIN;

ALTER TABLE meeting_joiner
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS meeting_joiner_deleted_at_idx
  ON meeting_joiner (workspace_id, deleted_at);

COMMIT;
