-- Billing / plans / metering (Round 19).
--
-- Idempotent. Run AFTER db/bootstrap.sql and db/0002_product_auth.sql.
--
-- One billing row per workspace: plan tier, subscription status, Stripe ids,
-- and seat count. Plan quotas (meetings/month, seats) live in code
-- (src/billing/plans.py). Quota enforcement gates meeting creation.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS workspace_billing (
  workspace_id           UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  plan                   VARCHAR(20) NOT NULL DEFAULT 'free',   -- free | pro | business
  status                 VARCHAR(20) NOT NULL DEFAULT 'active', -- active | past_due | canceled
  seats                  INT NOT NULL DEFAULT 1,
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  current_period_end     TIMESTAMPTZ(6),
  created_at             TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
