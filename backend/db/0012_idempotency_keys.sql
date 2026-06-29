-- Idempotency keys for safe POST retries (Round 9).
--
-- Idempotent. Run AFTER db/bootstrap.sql. Re-running is safe.
--
-- Adds:
--   - idempotency_keys: caches the response of a mutating request keyed by the
--     client's Idempotency-Key (scoped per principal+method+path). A retry with
--     the same key replays the stored response instead of re-executing — so a
--     network blip never double-creates a meeting/webhook/etc. Stripe/Recall
--     semantics. DB-backed so it survives restarts and works across replicas.

BEGIN;

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key_hash        TEXT PRIMARY KEY,           -- sha256(principal+method+path+key)
  method          VARCHAR(10) NOT NULL,
  path            TEXT NOT NULL,
  state           VARCHAR(10) NOT NULL DEFAULT 'pending',  -- pending | done
  status_code     INTEGER,
  response_body   BYTEA,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at      TIMESTAMPTZ(6) NOT NULL
);

-- Sweep expired keys cheaply.
CREATE INDEX IF NOT EXISTS idempotency_keys_expires_idx
  ON idempotency_keys (expires_at);

COMMIT;
