-- Scheduled digest preferences (Round 13).
--
-- Idempotent. Run AFTER db/bootstrap.sql and db/0002_product_auth.sql.
--
-- One row per workspace controlling automatic delivery of the activity digest
-- (the on-demand /reports/digest, now emittable on a cadence to email or
-- Slack). A background scheduler reads due rows and stamps last_sent_at.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS digest_preferences (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  frequency     VARCHAR(10) NOT NULL DEFAULT 'weekly',  -- daily | weekly
  hour_utc      INT NOT NULL DEFAULT 13,                 -- 0..23, send at/after this UTC hour
  day_of_week   INT NOT NULL DEFAULT 0,                  -- 0=Mon..6=Sun (weekly only)
  channel       VARCHAR(10) NOT NULL DEFAULT 'email',    -- email | slack
  target        TEXT,                                    -- email address(es) or Slack webhook URL
  last_sent_at  TIMESTAMPTZ(6),
  created_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
