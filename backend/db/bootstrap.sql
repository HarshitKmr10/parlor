-- meeting-joiner standalone bootstrap.
--
-- Idempotent. Run once when standing up the bot against a fresh Postgres.
-- Re-running is safe — every statement is guarded with IF NOT EXISTS or
-- wrapped in a DO block that catches duplicate-object errors.
--
-- This file is the source of truth for the standalone deployment path —
-- self-contained, no external schema source to stay in sync with.
--
-- Schema baseline as of 2026-05-19 (includes exit_reason, exit_details,
-- transcript_source).
--
-- Foreign keys to `organizations` and `meetings` are conditional: they
-- only create when the target table exists in the active schema. In the
-- monorepo public schema those tables exist; in standalone/custom-schema
-- deployments they typically don't, so the FK is silently skipped without
-- binding the bot to unrelated public tables.

BEGIN;

-- ── meeting_joiner_status enum ──────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE meeting_joiner_status AS ENUM (
    'not_joined', 'scheduled', 'joining', 'ongoing', 'interrupted', 'completed', 'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Existing enums (from older standalone bootstraps) get the new values
-- appended idempotently. ALTER TYPE ... ADD VALUE IF NOT EXISTS requires
-- Postgres 9.6+; the syntax errors silently on older versions which we
-- don't support anyway.
ALTER TYPE meeting_joiner_status ADD VALUE IF NOT EXISTS 'joining';
ALTER TYPE meeting_joiner_status ADD VALUE IF NOT EXISTS 'interrupted';
ALTER TYPE meeting_joiner_status ADD VALUE IF NOT EXISTS 'failed';
ALTER TYPE meeting_joiner_status ADD VALUE IF NOT EXISTS 'scheduled';

-- ── meeting_joiner table ────────────────────────────────────────────────
-- Fresh-deploy column list (post-pod-per-meeting refactor). For existing
-- deployments running the older bootstrap, the ALTER TABLE block below
-- brings them up to date in place.
CREATE TABLE IF NOT EXISTS meeting_joiner (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_url            VARCHAR NOT NULL,
  normalized_meeting_url VARCHAR,
  status                 meeting_joiner_status NOT NULL DEFAULT 'not_joined',
  video_link             VARCHAR,
  transcript             JSON,
  participants           JSON,
  org_id                 UUID,
  meeting_id             UUID,
  bot_join_time          TIMESTAMPTZ(6),
  bot_leave_time         TIMESTAMPTZ(6),
  bot_name               VARCHAR(100),
  transcript_source      VARCHAR(32),
  exit_reason            VARCHAR(64),
  exit_details           JSONB,
  pod_name               VARCHAR,
  cluster_name           VARCHAR,
  last_heartbeat_at      TIMESTAMPTZ(6),
  original_meeting_id    UUID,
  is_duplicate           BOOLEAN NOT NULL DEFAULT false,
  scheduled_at           TIMESTAMPTZ(6),
  created_at             TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── in-place upgrade for existing standalone deployments ────────────────
-- Adds the new pod-per-meeting columns, drops the deprecated process_id.
-- Safe to run repeatedly: every ALTER is guarded.
ALTER TABLE meeting_joiner
  ADD COLUMN IF NOT EXISTS pod_name               VARCHAR,
  ADD COLUMN IF NOT EXISTS cluster_name           VARCHAR,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at      TIMESTAMPTZ(6),
  -- RCA #9: parity with 20260615000000_meeting_sessions migration so
  -- the standalone bootstrap path stays in lockstep with Prisma.
  ADD COLUMN IF NOT EXISTS current_session_number INTEGER NOT NULL DEFAULT 1,
  -- Parity with 20260605000000_meeting_joiner_scheduled_at: rows awaiting
  -- timed dispatch sit in status 'scheduled' with this set.
  ADD COLUMN IF NOT EXISTS scheduled_at           TIMESTAMPTZ(6);

DROP INDEX IF EXISTS meeting_joiner_process_id_idx;
ALTER TABLE meeting_joiner DROP COLUMN IF EXISTS process_id;

-- ── indexes ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS meeting_joiner_status_idx                 ON meeting_joiner(status);
CREATE INDEX IF NOT EXISTS meeting_joiner_org_id_idx                 ON meeting_joiner(org_id);
CREATE INDEX IF NOT EXISTS meeting_joiner_created_at_idx             ON meeting_joiner(created_at);
CREATE INDEX IF NOT EXISTS meeting_joiner_normalized_meeting_url_idx ON meeting_joiner(normalized_meeting_url);
CREATE INDEX IF NOT EXISTS meeting_joiner_original_meeting_id_idx    ON meeting_joiner(original_meeting_id);
CREATE INDEX IF NOT EXISTS meeting_joiner_exit_reason_idx            ON meeting_joiner(exit_reason);
CREATE INDEX IF NOT EXISTS meeting_joiner_status_scheduled_at_idx    ON meeting_joiner(status, scheduled_at);
CREATE INDEX IF NOT EXISTS meeting_joiner_pod_name_idx
  ON meeting_joiner(pod_name) WHERE pod_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS meeting_joiner_last_heartbeat_at_idx
  ON meeting_joiner(last_heartbeat_at) WHERE last_heartbeat_at IS NOT NULL;

-- ── self-FK for duplicate-meeting linkage ───────────────────────────────
DO $$ BEGIN
  ALTER TABLE meeting_joiner
    ADD CONSTRAINT meeting_joiner_original_meeting_id_fkey
    FOREIGN KEY (original_meeting_id) REFERENCES meeting_joiner(id)
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── conditional FK to organizations (only if table exists) ──────────────
DO $$ BEGIN
  IF to_regclass(format('%I.organizations', current_schema())) IS NOT NULL THEN
    BEGIN
      ALTER TABLE meeting_joiner
        ADD CONSTRAINT meeting_joiner_org_id_fkey
        FOREIGN KEY (org_id) REFERENCES organizations(id)
        ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- ── conditional FK to meetings (only if table exists) ───────────────────
DO $$ BEGIN
  IF to_regclass(format('%I.meetings', current_schema())) IS NOT NULL THEN
    BEGIN
      ALTER TABLE meeting_joiner
        ADD CONSTRAINT meeting_joiner_meeting_id_fkey
        FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id)
        ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- ── meeting_sessions table (rejoin / session-per-bot-attempt) ───────────
-- One row per bot attempt for a meeting. Session 1 is the first attempt;
-- session N is the (N-1)-th rejoin. Transcript segments are tagged with
-- session_number in the meeting_joiner.transcript JSON envelope.
CREATE TABLE IF NOT EXISTS meeting_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_joiner_id   UUID NOT NULL,
  session_number      INTEGER NOT NULL CHECK (session_number >= 1),
  pod_name            VARCHAR,
  cluster_name        VARCHAR,
  started_at          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at            TIMESTAMPTZ(6),
  admitted_at         TIMESTAMPTZ(6),
  exit_reason         VARCHAR(64),
  exit_classification VARCHAR(16)
    CHECK (exit_classification IS NULL
           OR exit_classification IN ('terminal', 'recoverable', 'unknown')),
  last_segment_ts     TIMESTAMPTZ(6),
  details             JSONB,
  created_at          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- FK to meeting_joiner; cascade so dropping a meeting cleans its sessions.
DO $$ BEGIN
  ALTER TABLE meeting_sessions
    ADD CONSTRAINT meeting_sessions_meeting_joiner_id_fkey
    FOREIGN KEY (meeting_joiner_id) REFERENCES meeting_joiner(id)
    ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- One session_number per meeting — prevents two rejoin orchestrators
-- racing to allocate the same number.
CREATE UNIQUE INDEX IF NOT EXISTS
  meeting_sessions_meeting_joiner_id_session_number_key
  ON meeting_sessions(meeting_joiner_id, session_number);

CREATE INDEX IF NOT EXISTS meeting_sessions_meeting_joiner_id_idx
  ON meeting_sessions(meeting_joiner_id);

CREATE INDEX IF NOT EXISTS meeting_sessions_unended_idx
  ON meeting_sessions(started_at) WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS meeting_sessions_pod_name_idx
  ON meeting_sessions(pod_name) WHERE pod_name IS NOT NULL;

-- Keep updated_at fresh on UPDATE.
CREATE OR REPLACE FUNCTION meeting_sessions_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER meeting_sessions_updated_at_trigger
    BEFORE UPDATE ON meeting_sessions
    FOR EACH ROW EXECUTE FUNCTION meeting_sessions_set_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
