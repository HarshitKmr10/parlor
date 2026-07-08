-- Per-workspace LLM usage/cost observability (Round 25).
--
-- Idempotent. Run AFTER db/0002_product_auth.sql.
--
-- One row per ai-service call (summarize/chat/embed) that returned token
-- usage. Purely additive observability -- this product has no billing, so
-- nothing ever reads this table to gate functionality.
--
-- Append-only, audit-log-shaped (see audit_events in 0018_audit_events.sql):
-- `meeting_id` intentionally has NO foreign key to meeting_joiner. Usage rows
-- must survive meeting soft/hard-delete unchanged so historical cost/token
-- accounting is never corrupted by retention sweeps; they carry no meeting
-- content, only ids/counts/costs, so there is no PII-retention concern in
-- keeping them around after the source meeting is gone.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS llm_usage_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  meeting_id          UUID,
  operation           VARCHAR(20) NOT NULL,  -- summarize | chat | embed
  provider            VARCHAR(40) NOT NULL,
  model               VARCHAR(80) NOT NULL,
  prompt_tokens       INTEGER NOT NULL DEFAULT 0,
  completion_tokens   INTEGER NOT NULL DEFAULT 0,
  total_tokens        INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd  NUMERIC(12, 6),
  created_at          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS llm_usage_events_workspace_created_idx
  ON llm_usage_events (workspace_id, created_at);

CREATE INDEX IF NOT EXISTS llm_usage_events_workspace_provider_model_idx
  ON llm_usage_events (workspace_id, provider, model);

COMMIT;
