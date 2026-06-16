-- Test-only schema reset. Drops and recreates everything from bootstrap.sql.
-- CI integration tests run this against an ephemeral Postgres before each
-- test suite. NEVER run this against a non-test database.

BEGIN;

DROP TABLE IF EXISTS meeting_joiner CASCADE;
DROP TYPE  IF EXISTS meeting_joiner_status CASCADE;

COMMIT;

\i bootstrap.sql
