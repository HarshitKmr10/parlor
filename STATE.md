# Loop state · ship-feature

The persistent state for the autonomous build loop (see `.claude/skills/ship-feature`).
The agent forgets between runs; this file does not. **Read first, update last.**
Mirrors the `competitive-build-loop` memory — keep them in sync.

## Current branch
`feat/idempotency-keys` — everything below is stacked here. `main` is clean and
has NEVER been merged into.

## In progress
- _(none — pick the next item below or the highest-leverage gap)_

## Next (candidate work, highest-leverage first)
- **Merge gate:** open PR `feat/idempotency-keys` → `main` (18 roadmap items A1–D4
  all shipped & green). This is the biggest pending action.
- Credential-gated paths built + mock-tested, need live creds to go live:
  CRM push (B5 — Notion/HubSpot/Salesforce), SSO IdP (C2 — OIDC), Stripe (D1 — billing).
- Native mobile app — deferred (out of this environment).

## Shipped (A1–D4 — all 18 roadmap items complete, 2026-06-29)
Tiers A–D end-to-end, each = migration + module + routes + web + tests + commit.
Migrations 0002–0021, all mounted in docker-compose.
- **Iter 1–11:** analytics, highlights/reel, cross-meeting search, public share links,
  threaded comments+@mentions, developer webhooks (HMAC+retry), token-bucket rate
  limiting, summary templates, action-items tracker, digest reports, idempotency keys.
- **Web UI parity:** Next.js UI for all 8 previously-headless features.
- **Tier A:** cross-meeting Ask (RAG+citations), notifications/inbox, scheduled digest
  emit, OpenAPI docs page + global search.
- **Tier B:** during-call assist, speaker identities, coaching scorecards, trackers,
  CRM providers, PII redaction+vocab.
- **Tier C:** audit log, OIDC SSO, retention+legal-hold+export, RBAC+usage.
- **Tier D:** billing/plans/quota+Stripe (D1), multi-language summaries (D3), botless
  native capture (D4), desktop GUI control panel (D2).

## Gate status (the objective verifier — `scripts/loop-gate.sh`)
- Backend: **470 pytest pass**, 6 known docker-DNS failures (whitelisted).
- ai-service: 6 tests pass. web: **45 Playwright specs** green.
- The 6 known failures live in `tests/services/test_compose_worker_dispatcher.py`
  and `test_rejoin_orchestrator_integration.py` (need docker host `meeting-worker:9000`).
  Environmental, not product-layer. If the FAILING TEST NAMES change, a real
  regression may be hiding — inspect.

## Lessons learned (write here, not in chat)
- 2026-06-29: `segments_from_transcript` must decode the JSON-string form asyncpg
  returns — search snippets were silently always empty before the fix.
- Native run (no Docker): backend needs `MEETING_JOINER_DB_DRIVER=pg` (defaults to
  prisma, which isn't installed); web must run `./node_modules/.bin/next` not
  `pnpm dev` (predev deps-check fails on ignored sharp/unrs-resolver build scripts).
- Turbopack root pinned in `web/next.config.ts` — repo path has a space → panic otherwise.
