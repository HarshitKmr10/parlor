-- Product API layer: auth, workspaces, API keys.
--
-- Idempotent. Run AFTER db/bootstrap.sql against the same database. Adds the
-- tenancy/auth tables the /api/v1 product layer needs on top of the existing
-- meeting_joiner internals. Re-running is safe — every statement is guarded
-- with IF NOT EXISTS or wrapped in a DO block.
--
-- Requires the pgcrypto extension for gen_random_uuid() (provided by the
-- pgvector/pgvector:pg16 image, also available in stock Postgres 14+).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- pgvector is used by the ai-service for RAG embeddings; create it here so the
-- shared database is ready for both surfaces. No-op if already present.
CREATE EXTENSION IF NOT EXISTS vector;

-- ── users ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(320) NOT NULL,
  name          VARCHAR(200) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uk
  ON users (LOWER(email));

-- ── workspaces ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspaces (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(200) NOT NULL,
  slug       VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS workspaces_slug_uk ON workspaces (slug);

-- ── workspace_members ────────────────────────────────────────────────────
-- role: owner | admin | member
CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         VARCHAR(20) NOT NULL DEFAULT 'member',
  created_at   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (workspace_id, user_id)
);
CREATE INDEX IF NOT EXISTS workspace_members_user_id_idx
  ON workspace_members (user_id);

-- ── refresh_tokens ───────────────────────────────────────────────────────
-- One row per issued refresh token. token_hash is a SHA-256 of the opaque
-- token so a DB leak does not expose usable tokens. revoked_at supports logout.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ(6) NOT NULL,
  revoked_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS refresh_tokens_token_hash_uk
  ON refresh_tokens (token_hash);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx
  ON refresh_tokens (user_id);

-- ── api_keys ─────────────────────────────────────────────────────────────
-- Workspace-scoped credential for the MCP server. The full key is shown once
-- on create; only key_hash (SHA-256) + prefix (first chars, for display) are
-- stored.
CREATE TABLE IF NOT EXISTS api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         VARCHAR(200) NOT NULL,
  key_hash     VARCHAR(64) NOT NULL,
  prefix       VARCHAR(16) NOT NULL,
  created_at   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMPTZ(6)
);
CREATE UNIQUE INDEX IF NOT EXISTS api_keys_key_hash_uk ON api_keys (key_hash);
CREATE INDEX IF NOT EXISTS api_keys_workspace_id_idx ON api_keys (workspace_id);

-- ── product meetings: workspace scoping + title/insights ─────────────────
-- The product layer scopes meetings to a workspace. The internal joiner row
-- already carries org_id; we add a nullable workspace_id FK plus product
-- metadata so the contract's Meeting can be served from the same row without
-- breaking the existing internal endpoints.
ALTER TABLE meeting_joiner
  ADD COLUMN IF NOT EXISTS workspace_id UUID,
  ADD COLUMN IF NOT EXISTS title        VARCHAR(500),
  ADD COLUMN IF NOT EXISTS insights     JSONB;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = current_schema() AND table_name = 'workspaces'
  ) THEN
    BEGIN
      ALTER TABLE meeting_joiner
        ADD CONSTRAINT meeting_joiner_workspace_id_fkey
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS meeting_joiner_workspace_id_idx
  ON meeting_joiner (workspace_id);

COMMIT;
