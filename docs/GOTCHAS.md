# Gotchas

Known sharp edges and non-obvious fixes, collected from real debugging sessions.
If you hit one of these, save yourself the time — read here first.

- `segments_from_transcript` must decode the JSON-string form asyncpg returns —
  search snippets were silently always empty before this fix. See
  `backend/src/api/product/mappers.py`.
- **Native run (no Docker):** the backend needs `MEETING_JOINER_DB_DRIVER=pg`
  (it defaults to `prisma`, which isn't installed); the web app must run
  `./node_modules/.bin/next` and not `pnpm dev` (the `predev` deps-check fails
  on ignored `sharp`/`unrs-resolver` build scripts).
- Turbopack's root is pinned in `web/next.config.ts` — if your checkout path
  contains a space, Turbopack panics on startup.
