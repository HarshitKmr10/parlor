-- Developer webhooks: outbound event delivery (Round 6).
--
-- Idempotent. Run AFTER db/bootstrap.sql and db/0002_product_auth.sql.
-- Re-running is safe.
--
-- Adds:
--   - webhook_endpoints: a workspace's registered HTTPS receivers. Each has a
--     signing secret (HMAC-SHA256, Stripe-style t=…,v1=… header) and an
--     optional event_types allow-list (empty = all events).
--   - webhook_deliveries: the delivery queue. One row per (endpoint, event).
--     The background dispatcher claims due rows (FOR UPDATE SKIP LOCKED) and
--     retries with exponential backoff until delivered or attempts exhausted.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  url                  TEXT NOT NULL,
  secret               TEXT NOT NULL,
  description          TEXT,
  event_types          TEXT[] NOT NULL DEFAULT '{}',
  enabled              BOOLEAN NOT NULL DEFAULT TRUE,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  disabled_at          TIMESTAMPTZ(6),
  created_at           TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS webhook_endpoints_workspace_idx
  ON webhook_endpoints (workspace_id);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id     UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL,
  event_type      TEXT NOT NULL,
  payload         JSONB NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending|delivered|failed
  attempts        INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 6,
  response_status INTEGER,
  error           TEXT,
  next_attempt_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  delivered_at    TIMESTAMPTZ(6),
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- The dispatcher's hot query: due, not-yet-terminal deliveries oldest-first.
CREATE INDEX IF NOT EXISTS webhook_deliveries_due_idx
  ON webhook_deliveries (next_attempt_at)
  WHERE status = 'pending';
-- Per-endpoint delivery log (newest first).
CREATE INDEX IF NOT EXISTS webhook_deliveries_endpoint_idx
  ON webhook_deliveries (endpoint_id, created_at DESC);

COMMIT;
