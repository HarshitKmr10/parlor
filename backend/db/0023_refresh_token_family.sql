-- Refresh token family tracking for reuse/theft detection.
--
-- Idempotent, run after db/0002_product_auth.sql. Adds a family_id shared by
-- a refresh token and every token rotated from it, so replaying an
-- already-rotated (revoked) token can revoke the whole chain instead of just
-- 401-ing the one presented token.

BEGIN;

ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS family_id UUID NOT NULL DEFAULT gen_random_uuid();

CREATE INDEX IF NOT EXISTS refresh_tokens_family_id_idx
  ON refresh_tokens (family_id);

COMMIT;
