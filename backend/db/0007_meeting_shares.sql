-- Public shareable meeting pages (Round 4).
--
-- Idempotent. Run AFTER db/bootstrap.sql, db/0002_product_auth.sql and
-- db/0003_calendar_integrations.sql. Re-running is safe.
--
-- Adds:
--   - meeting_shares: a capability-URL token granting read-only public access
--     to one meeting's recap (summary/transcript/highlights/analytics, gated by
--     per-share scope flags). The token is a 256-bit URL-safe random string —
--     unguessable, like a Loom/Google-Doc share link — so the public view
--     needs no auth. Owners can revoke or expire a link at any time.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS meeting_shares (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id          UUID NOT NULL,
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  token               TEXT NOT NULL,
  include_transcript  BOOLEAN NOT NULL DEFAULT FALSE,
  include_highlights  BOOLEAN NOT NULL DEFAULT TRUE,
  include_analytics   BOOLEAN NOT NULL DEFAULT FALSE,
  revoked             BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at          TIMESTAMPTZ(6),
  view_count          BIGINT NOT NULL DEFAULT 0,
  last_viewed_at      TIMESTAMPTZ(6),
  created_at          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Public lookup is by token — must be unique and indexed.
CREATE UNIQUE INDEX IF NOT EXISTS meeting_shares_token_uk
  ON meeting_shares (token);

-- One active share row per meeting (POST upserts on this key). A revoked row is
-- kept (token stays dead) but re-sharing rotates the token in place.
CREATE UNIQUE INDEX IF NOT EXISTS meeting_shares_meeting_uk
  ON meeting_shares (meeting_id);

CREATE INDEX IF NOT EXISTS meeting_shares_workspace_idx
  ON meeting_shares (workspace_id);

COMMIT;
