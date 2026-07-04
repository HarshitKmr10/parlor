-- SSO identity binding: key already-linked SSO accounts off the IdP's stable
-- subject claim (issuer + sub) instead of the mutable email string.
--
-- Security fix: profile_from_userinfo() now requires email_verified: true and
-- a sub claim before an OIDC login is trusted at all. Email is only ever used
-- to find-or-create a user on the FIRST successful SSO exchange for a given
-- (issuer, sub); every subsequent login for that identity resolves via this
-- table, not another email lookup — otherwise an IdP that later (or for a
-- different user) returns the same email string could hijack the account.
--
-- Idempotent. Run AFTER db/0021_summary_language.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS sso_identities (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issuer     VARCHAR(500) NOT NULL,
  subject    VARCHAR(500) NOT NULL,
  email      VARCHAR(320) NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS sso_identities_issuer_subject_uk
  ON sso_identities (issuer, subject);
CREATE INDEX IF NOT EXISTS sso_identities_user_id_idx
  ON sso_identities (user_id);

COMMIT;
