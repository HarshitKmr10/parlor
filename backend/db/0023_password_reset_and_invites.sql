-- Password reset + workspace invites (pre-launch auth gaps).
--
-- Idempotent. Adds a self-serve password reset flow (so a solo admin isn't
-- permanently locked out) and a workspace invite flow (so a second person can
-- join an existing workspace instead of every signup auto-provisioning its
-- own brand-new workspace).

BEGIN;

-- ── password_reset_tokens ────────────────────────────────────────────────
-- One row per issued reset token. token_hash is a SHA-256 of the opaque
-- token so a DB leak does not expose usable tokens, mirroring refresh_tokens.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ(6) NOT NULL,
  used_at    TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS password_reset_tokens_token_hash_uk
  ON password_reset_tokens (token_hash);
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx
  ON password_reset_tokens (user_id);

-- ── workspace_invites ────────────────────────────────────────────────────
-- status: pending | accepted | expired | revoked
CREATE TABLE IF NOT EXISTS workspace_invites (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email            VARCHAR(320) NOT NULL,
  role             VARCHAR(20) NOT NULL DEFAULT 'member',
  invited_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash       VARCHAR(64) NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'pending',
  expires_at       TIMESTAMPTZ(6) NOT NULL,
  created_at       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS workspace_invites_token_hash_uk
  ON workspace_invites (token_hash);
CREATE INDEX IF NOT EXISTS workspace_invites_workspace_id_idx
  ON workspace_invites (workspace_id);
CREATE INDEX IF NOT EXISTS workspace_invites_email_lower_idx
  ON workspace_invites (LOWER(email));

COMMIT;
