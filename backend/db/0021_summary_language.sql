-- Multi-language summaries (Round 20).
--
-- Idempotent. Adds a per-workspace summary output language (BCP-47-ish code,
-- 'en' default) to the existing NLP settings row. The summarizer writes the
-- recap in this language.

BEGIN;

ALTER TABLE workspace_nlp_settings
  ADD COLUMN IF NOT EXISTS summary_language VARCHAR(10) NOT NULL DEFAULT 'en';

COMMIT;
