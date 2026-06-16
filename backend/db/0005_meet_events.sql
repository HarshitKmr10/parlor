-- Ad-hoc / instant Meet capture via Google Workspace Events + Cloud Pub/Sub
-- (Pass 2). Catches meetings that NEVER touch a calendar — someone just starts
-- an instant Meet — by subscribing to Meet conference lifecycle events fanned
-- out across org users and dispatching the bot from the Pub/Sub push webhook.
--
-- Idempotent. Run AFTER db/bootstrap.sql, db/0002_product_auth.sql,
-- db/0003_calendar_integrations.sql, and db/0004_google_workspace.sql against
-- the same database. Re-running is safe — every statement is guarded.
--
-- Adds:
--   - workspace_event_subscriptions: one row per active Workspace Events API
--       subscription. Fanned out across org users (one subscription per user
--       targeting that user's Meet conference lifecycle). Renewed before
--       expire_time by a background loop.
--   - meet_capture_events: dedupe log of processed Meet conference ids. Google
--       WILL redeliver the same Pub/Sub message; the unique conference id keeps
--       a redelivery from double-joining.
--   - org_meeting_policy: per-workspace auto-join policy consulted before EVERY
--       dispatch (calendar sync AND ad-hoc events).
--   - google_workspace_orgs.notetaker_email: the Workspace account the bot
--       joins meetings AS (for auto-admission to internal meetings).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── notetaker identity on the org config ──────────────────────────────────
-- The bot joins internal meetings AS this Workspace account so it's
-- auto-admitted. Per-workspace; falls back to settings.MEET_NOTETAKER_EMAIL.
ALTER TABLE google_workspace_orgs
  ADD COLUMN IF NOT EXISTS notetaker_email VARCHAR(320);

-- ── workspace_event_subscriptions ─────────────────────────────────────────
-- google_subscription_id: the Workspace Events API subscription resource name
--   (e.g. "subscriptions/abc123").
-- target_user_email: the org user whose Meet activity this subscription watches
--   (target resource //cloudidentity.googleapis.com/users/{id}).
-- event_types: JSONB array of subscribed CloudEvent types.
-- state: 'active' | 'expiring' | 'deleted' | 'error'.
CREATE TABLE IF NOT EXISTS workspace_event_subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  google_subscription_id VARCHAR(512),
  target_user_email      VARCHAR(320) NOT NULL,
  event_types            JSONB NOT NULL DEFAULT '[]'::jsonb,
  expire_time            TIMESTAMPTZ(6),
  state                  VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at             TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- One live subscription per (workspace, user) — re-subscribe upserts on this.
CREATE UNIQUE INDEX IF NOT EXISTS workspace_event_subs_ws_user_uk
  ON workspace_event_subscriptions (workspace_id, target_user_email);

-- The renewal loop scans by expire_time across active subscriptions.
CREATE INDEX IF NOT EXISTS workspace_event_subs_expire_idx
  ON workspace_event_subscriptions (state, expire_time);

-- ── meet_capture_events (dedupe log) ──────────────────────────────────────
-- conference_id: the Meet conferenceRecord / space conference id from the
--   CloudEvent. The unique constraint is the dedupe guard: a duplicate Pub/Sub
--   delivery for the same conference is a no-op insert (ON CONFLICT DO NOTHING).
CREATE TABLE IF NOT EXISTS meet_capture_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id  VARCHAR(512) NOT NULL,
  workspace_id   UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  meeting_id     UUID,
  meeting_uri    TEXT,
  event_type     VARCHAR(128),
  organizer_email VARCHAR(320),
  dispatched     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS meet_capture_events_conference_uk
  ON meet_capture_events (conference_id);

-- ── org_meeting_policy ────────────────────────────────────────────────────
-- Consulted before EVERY dispatch. mode:
--   'all'       — join everything (subject to deny/opt-out).
--   'allowlist' — join ONLY when the organizer/domain/OU matches `allow`.
--   'denylist'  — join everything EXCEPT matches in `deny`.
-- allow / deny: JSONB { "emails": [...], "domains": [...], "ous": [...] }.
-- opt_out_emails: JSONB array of organizer emails who opted out entirely.
CREATE TABLE IF NOT EXISTS org_meeting_policy (
  workspace_id              UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  auto_join_enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  mode                      VARCHAR(16) NOT NULL DEFAULT 'all',
  allow                     JSONB NOT NULL DEFAULT '{}'::jsonb,
  deny                      JSONB NOT NULL DEFAULT '{}'::jsonb,
  opt_out_emails            JSONB NOT NULL DEFAULT '[]'::jsonb,
  recording_disclosure_text TEXT,
  created_at                TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
