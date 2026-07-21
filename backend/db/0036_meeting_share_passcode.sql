-- Passcode-protected share links (privacy vault).
--
-- Idempotent. Run AFTER db/0007_meeting_shares.sql. Re-running is safe.
--
-- Adds:
--   - meeting_shares.passcode: an optional plaintext passcode gating public
--     read access. NULL (the default) means no passcode — the link works
--     exactly as before. When non-NULL, the public-by-token read path requires
--     a matching passcode. Workspace sharing defaults (workspace_share_settings)
--     can force one at creation time (require_passcode + default_passcode).

BEGIN;

ALTER TABLE meeting_shares ADD COLUMN IF NOT EXISTS passcode TEXT;

COMMIT;
