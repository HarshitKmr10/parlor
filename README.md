# Verdant — Meeting Assistant (full dev stack)

Verdant is an AI meeting assistant: it joins meetings, captures transcripts,
and produces summaries, action items, and chat-with-your-meeting (RAG) answers.
This repo wires the whole product into a single `docker compose` dev stack.

## Architecture

```
                                  browser
                                     │
                                     ▼  http://localhost:${WEB_PORT}
                          ┌──────────────────────┐
                          │  web  (Next.js :3000) │   cookie auth, full UI
                          └──────────┬───────────┘
                                     │  http://localhost:${API_PORT}  (browser → backend)
                                     ▼
                          ┌──────────────────────┐   POST /configure (HTTP)   ┌─────────────────────────────┐
                          │ backend (FastAPI :8000) │ ─────────────────────────▶│ meeting-worker (sidecar :9000)│
                          │   RUNTIME_MODE=compose   │                          │  spawns the REAL bot:         │
                          │   /api/v1 auth, meetings │ ◀───────────────────────  │  Node + Playwright Chromium   │
                          └─────┬───────────┬──────┘  /internal/sessions/ended  │  on Xvfb :99  (separate cntr) │
              AI_SERVICE_URL    │           │   DATABASE_URL                     └──────────────┬──────────────┘
        http://ai-service:8100  │           │   postgres:5432                            DATABASE_URL │ (bot writes
                                ▼           ▼                                    postgres:5432 ◀──────┘  transcripts)
              ┌──────────────────────┐   ┌──────────────────────────────┐
              │ ai-service (:8100)    │──▶│ postgres (pgvector :5432)     │
              │ summarize/embed/chat  │   │ ONE shared DB:                │
              │ mock mode w/o keys    │   │  • backend product/auth/mtgs  │
              └──────────────────────┘   │  • ai-service meeting_embeddings│
                                         └──────────────────────────────┘
```

`make up` runs the **separated** stack (mirroring prod): the API and the bot
live in **different containers**. The API dispatches each meeting to the
`meeting-worker` container's sidecar over HTTP (`POST /configure`); the worker
spawns the real Playwright/Chromium bot. See
[backend/docs/BOT-RUNTIME.md](backend/docs/BOT-RUNTIME.md) for the three
dispatch modes (standalone in-process, compose separate-worker, k8s warm-pool).

- **Single shared Postgres** (`pgvector/pgvector:pg16`) backs both services.
  Backend schema is applied from `backend/db/*.sql` on first boot
  (`bootstrap.sql` → `0002_product_auth.sql` → `0003_calendar_integrations.sql`).
  The ai-service creates its `meeting_embeddings` table on startup.
- **Inter-service URLs use Docker DNS** (`postgres`, `ai-service`, `backend`).
  **Host ports** (configurable in `.env`) are for the browser / local dev.
- The stack runs **with no LLM keys**: the ai-service is in **mock mode**, so
  summaries/embeddings/chat return deterministic structured data.

The `mcp/` directory (stdio MCP server) is intentionally **not** part of this
runtime stack.

## Prerequisites

- Docker Engine + Compose v2 (`docker compose version`)
- `bash`, `curl`, `jq` (for the smoke test)

## Quick start

```bash
cp .env.example .env     # safe local defaults; or `make up` creates it for you
make up                  # build + start the SEPARATED stack (API + meeting-worker bot)
make ps                  # wait until all services are "healthy"
make logs-worker         # follow the meeting-worker (bot) container logs
make smoke               # end-to-end cross-service smoke test
make down                # stop everything (keeps the DB volume)

# Fast API-only iteration (no bot container; in-process standalone degrade):
make up-api
```

> The first `make up` build is large/slow — the `meeting-worker` image carries
> Node + Playwright Chromium + node_modules + Xvfb/pulse/ffmpeg + a local whisper
> cache. Use `make up-api` for quick backend/product iteration.

### URLs (defaults; override in `.env`)

| Service        | URL                              | Notes                              |
|----------------|----------------------------------|------------------------------------|
| web            | http://localhost:3001            | login at `/login`                  |
| backend        | http://localhost:8001            | `/api/v1`, `/health`, `/ready`     |
| meeting-worker | http://localhost:9000/           | sidecar control plane (the bot)    |
| ai-service     | http://localhost:8101/health     | internal; rarely hit directly      |
| postgres       | localhost:5434                    | user/db `meeting`                  |

> **Ports are configurable.** Defaults are `WEB_PORT=3001`, `API_PORT=8001`,
> `AI_PORT=8101`, `POSTGRES_PORT=5434` — chosen to avoid the commonly-occupied
> 3000 / 8000 / 8100 / 5432. Change them in `.env` if they clash on your host.
> Inter-service traffic uses Docker DNS and is unaffected by host-port changes.

## Going from mock → live LLMs

The ai-service auto-detects mock vs. live. To use real models:

1. Put at least one key in `.env`:
   ```bash
   ANTHROPIC_API_KEY=sk-ant-...
   # and/or
   OPENAI_API_KEY=sk-...
   AI_MODE=live           # or leave blank to auto-detect when a key is present
   ```
2. `make down && make up` (rebuild not required; the var is read at runtime).

Provider order is controlled by `AI_PROVIDER_ORDER` (default `anthropic,openai`);
the first provider that succeeds wins, falling through on error. No code or
compose changes are needed — only `.env`.

## End-to-end smoke test

`scripts/smoke_e2e.sh` (run via `make smoke`) proves the full cross-service flow
against the running stack:

1. `POST /api/v1/auth/signup` → captures `accessToken` + `workspaceId`.
2. `POST /api/v1/meetings` (a Google Meet URL) → captures `meetingId`.
3. **Seeds a transcript** into `meeting_joiner.transcript` via
   `docker compose exec postgres psql` — a **test shim** standing in for a real
   bot join writing captured segments.
4. `POST /api/v1/meetings/{id}/summarize` → asserts `MeetingInsights`
   (summary / keyPoints / actionItems / chapters). Exercises
   **backend → ai-service `/summarize`** (mock).
5. **Seeds embeddings** by calling the ai-service `/embed` directly with the
   same segments → writes the `meeting_embeddings` pgvector table. (Another test
   shim: the capture pipeline would embed during a live meeting.)
6. `POST /api/v1/meetings/{id}/ask` → asserts `{ answer, citations[] }`.
   Exercises **backend → ai-service `/chat` → pgvector retrieval** end-to-end.

It asserts each step's HTTP status + key fields and exits non-zero on any
failure with a PASS/FAIL summary.

## Make targets

| Target             | Action                                                                  |
|--------------------|-------------------------------------------------------------------------|
| `make up`          | build + start the SEPARATED stack (API + meeting-worker bot); creates `.env` if absent |
| `make up-bots`     | alias for `make up`                                                     |
| `make up-api`      | API-only fast iteration (no worker; standalone in-process degrade)      |
| `make down`        | stop + remove containers (keeps the DB volume)                          |
| `make reset`       | `down -v` — also drop the DB volume (fresh schema next up)              |
| `make logs`        | follow logs for all services                                            |
| `make logs-worker` | follow ONLY the meeting-worker (bot) container                          |
| `make smoke`       | run `scripts/smoke_e2e.sh`                                              |
| `make ps`          | service status / health                                                 |
| `make psql`        | open a psql shell on the shared Postgres                                |
| `make build`       | build all images (separated stack)                                      |

## Configuration

All configuration is via `.env` (see `.env.example` for every variable, with
documentation). No secrets are baked into images or compose files. Optional
integrations (Google/Microsoft calendar OAuth, Slack, SMTP) are documented in
`.env.example` and are **not** required for the stack to boot.

## Known limitations

- **Web SSR → backend in Docker.** The web app resolves its backend base URL
  from a single public var (`NEXT_PUBLIC_API_URL`, default
  `http://localhost:${API_PORT}`). That value is correct for the **browser**.
  Server-side rendering inside the web container also uses it, so SSR fetches
  resolve to the web container's own `localhost`. Pages that fetch on the
  browser (login, signup, the auth route handlers proxied through Next) and the
  smoke test (which talks to the backend directly) are unaffected. Wiring SSR to
  the internal DNS name (`http://backend:8000`) would require a small,
  backward-compatible code change to add a server-only base-URL override; it was
  intentionally left out to avoid modifying service source for this stack-up.
- The bot-join / live-capture path is not exercised here (it needs the heavier
  worker image with Chromium + Zoom SDK). Transcript + embeddings are seeded as
  documented test shims so the AI pipeline is provable offline.
```
