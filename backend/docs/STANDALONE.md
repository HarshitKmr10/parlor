# Running meeting-joiner standalone

The `meeting-joiner/` directory is designed to be vendorable: copy it into
another repo, configure env, and deploy. No dependency on any surrounding
monorepo at runtime.

This document covers the two install paths:

1. **Vendor into existing repo** — clone or subtree-merge the directory.
2. **Run from this folder** — `docker compose up` quickstart, then K8s.

Some organizations also run this service as part of a larger internal
monorepo with its own deployment manifests and runbooks — none of that
applies in the standalone case covered here.

---

## 1. Prerequisites

- Postgres 14+ (Supabase, Azure Postgres, AWS RDS, plain Postgres — anything that speaks the wire protocol).
- Docker 24+ (for the standalone image) OR Node 20 + Python 3.11 (for from-source).
- Outbound HTTPS to the meeting platforms you'll join (Microsoft, Google, Zoom).
- An AWS or Azure account if you use the audio-ASR path; Teams captions mode needs only Postgres.
- **No cloud account is required for transcription** if you use local whisper (see below) — only Postgres.

### Keyless transcription with local whisper

Set `LLM_PROVIDER=local_whisper` to run whisper in-process with **no cloud
keys**. It uses `@xenova/transformers` (Node, pure JS/ONNX) and runs on any
Linux/Mac. The model (`WHISPER_MODEL=tiny.en` by default, ~40MB) downloads
once on first use and then runs fully offline — so a standalone deploy can
transcribe audio-ASR meetings with only a database, no AWS/Azure/OpenAI
account.

Notes:

- First run downloads the model; pre-bake it into the image or persist
  `TRANSFORMERS_CACHE` / `HF_HOME` to avoid re-downloading on each pod.
- `tiny` is fast and CPU-only but lower accuracy than the cloud providers;
  use `WHISPER_MODEL=base` for better quality at higher latency.
- `STT_FALLBACK_LOCAL=true` (default) means a misconfigured cloud provider
  with no credentials automatically falls back to local whisper instead of
  failing. Set it to `false` in production to require real cloud creds.

## 2. Configure

```bash
cp .env.example .env
# Edit .env — fill DATABASE_URL at minimum. Every key is documented inline.
```

The env loader honors precedence (highest wins):

1. `process.env` (whatever your platform injects — K8s ConfigMap/Secret, docker-compose `environment:`, GitHub Actions secrets, …)
2. `meeting-joiner/.env`
3. `meeting-joiner/envs/${NODE_ENV}.env` (optional per-env file)

In container deployments you typically use (1). The `.env` file is for local dev.

## 3. Apply the schema

```bash
psql "$DATABASE_URL" -f db/bootstrap.sql
```

The script is idempotent — re-running it on an existing database is safe.
If your DB doesn't have `organizations` / `meetings` tables (most standalone
deployments won't), the FK constraints are silently skipped.

## 4. Pick your DB driver

```bash
export MEETING_JOINER_DB_DRIVER=pg     # raw SQL via pg / asyncpg (default standalone)
# OR
export MEETING_JOINER_DB_DRIVER=prisma # Prisma client — only useful if you also vendor core/
```

`pg` is the recommended path for standalone consumers — no Prisma generate
step, no `core/` dependency.

---

## Install path A — Vendor into an existing repo

```bash
# From your repo root:
git remote add upstream https://github.com/your-org/your-monorepo.git
git fetch upstream main
git read-tree --prefix=meeting-joiner -u upstream/main:meeting-joiner
git commit -m "vendor meeting-joiner"
```

Then add to your repo's CI / deployment pipeline:

```bash
# Build the image from the meeting-joiner/ directory only.
docker build -t myregistry/meeting-joiner:1.0.0 meeting-joiner/

# Apply the schema on first deploy.
psql "$DATABASE_URL" -f meeting-joiner/db/bootstrap.sql

# Apply the K8s manifests (after editing placeholders).
kubectl apply -f meeting-joiner/deploy/configmap.example.yaml
kubectl apply -f meeting-joiner/deploy/secret.example.yaml
kubectl apply -f meeting-joiner/deploy/deployment.yaml
kubectl apply -f meeting-joiner/deploy/service.yaml
```

Schema staying current with the upstream is your responsibility. The
upstream CI runs `node meeting-joiner/db/extract-bootstrap.mjs` to fail
when columns drift between `core/core/db/prisma/schema.prisma` and
`meeting-joiner/db/bootstrap.sql` — when you periodically pull updates,
just rerun `psql -f db/bootstrap.sql` for any new columns.

## Quickstart — product API dev runtime (Postgres + pgvector + backend)

The fastest way to run the full backend (internal joiner endpoints **plus** the
`/api/v1` product layer: auth, workspaces, product meetings) against a local
Postgres with the `pgvector` extension:

```bash
make dev
# equivalently:
cp .env.dev.example .env.dev
docker compose -f docker-compose.dev.yml --env-file .env.dev up --build
```

This brings up:

- `db` — `pgvector/pgvector:pg16`, schema auto-applied on first boot from
  `db/bootstrap.sql` + `db/0002_product_auth.sql`.
- `api` — FastAPI on host port `8000` (override with `API_PORT`), in
  `RUNTIME_MODE=standalone` so the Kubernetes warm-pool / sidecar / ghost-pod
  reaper / selector-canary machinery is disabled and the app boots without a
  cluster, using the asyncpg (`MEETING_JOINER_DB_DRIVER=pg`) driver.

Smoke test:

```bash
curl localhost:8000/health   # 200 {"status":"healthy",...}
curl localhost:8000/ready    # 200 {"status":"ready","checks":{"database":"ok",...}}

# Sign up (creates user + first workspace + owner membership)
curl -X POST localhost:8000/api/v1/auth/signup -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"supersecret123","name":"You","workspaceName":"Acme"}'
```

Use the returned `accessToken` as `Authorization: Bearer <token>` and the
workspace id as the `X-Workspace-Id` header for `/api/v1/*` calls. MCP servers
authenticate with `X-API-Key: <key>` instead (create one via
`POST /api/v1/workspaces/{id}/api-keys`).

To re-apply the product migration against a running DB (idempotent): `make
migrate`. To wipe the DB volume and start fresh: `make dev-reset`.

## Install path B — Run from this folder

```bash
# Local dev (single host)
docker compose up

# Or from source:
pnpm install
poetry install
psql "$DATABASE_URL" -f db/bootstrap.sql
node src/processors/meetingProcessor.js <meeting_url> <meeting_id>
```

For K8s, see `deploy/README.md` and the manifests in `deploy/`.

---

## Env reference

The full env contract is documented inline in `.env.example`. Quick map:

| Bucket | Required for | Examples |
|---|---|---|
| Database | always | `DATABASE_URL`, `MEETING_JOINER_DB_DRIVER` |
| Recording | Azure Blob upload | `AZURE_STORAGE_CONNECTION_STRING` or `AZURE_STORAGE_AUTH=managed_identity` with `AZURE_STORAGE_ACCOUNT_NAME`/`AZURE_STORAGE_BLOB_ENDPOINT` |
| LLM | model calls | `OPENAI_API_KEY`, `AZURE_OPENAI_API_KEY`, AWS creds |
| Speech | audio-ASR path | `AZURE_SPEECH_KEY`/`AZURE_SPEECH_REGION`, `AZURE_SPEECH_AUTH=managed_identity` with custom-subdomain `AZURE_SPEECH_ENDPOINT`, AWS Transcribe creds |
| MS Teams | Teams meetings | `MSTEAMS_*` family |
| Google Meet | Meet meetings | `GOOGLE_*` and `GOOGLEMEET_*` |
| Zoom | Zoom meetings | `ZOOM_APP_CLIENT_ID`, `ZOOM_APP_CLIENT_SECRET` |
| Diagnostics | debug only | `AUDIO_ARCHIVE_*`, `MSTEAMS_CSRC_AUDIO_DUMP_*` |

## Operational hooks

- **Exit reasons.** Every meeting writes `exit_reason` + `exit_details` on leave.
  Query:
  ```sql
  SELECT exit_reason, COUNT(*), AVG(duration_min) AS avg_minutes
    FROM (
      SELECT exit_reason, EXTRACT(EPOCH FROM (bot_leave_time - bot_join_time))/60 AS duration_min
        FROM meeting_joiner
       WHERE bot_join_time IS NOT NULL
    ) t
   GROUP BY exit_reason
   ORDER BY 2 DESC;
  ```
- **Schema drift.** CI runs `node db/extract-bootstrap.mjs` and `node db/extract-env-example.mjs` on every PR.
- **Per-meeting transcripts.** The `meeting_joiner.transcript` JSON column carries
  the live transcript; downstream consumers can poll or LISTEN/NOTIFY on it
  via Postgres triggers if real-time consumption is needed.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `DATABASE_URL is not set` at boot | required-keys validator hit | Set the env, restart |
| `relation "meeting_joiner" does not exist` | bootstrap not applied | `psql "$DATABASE_URL" -f db/bootstrap.sql` |
| `self.prisma is not available with MEETING_JOINER_DB_DRIVER=pg` | legacy code reaching for the Prisma client | Migrate the caller to `self.db.store.*`; or set `MEETING_JOINER_DB_DRIVER=prisma` if you vendored `core/` too |
| Bot drops at 20-25 minutes on Teams | caption-mode aloneness regression (fixed in #3579) | Confirm you're on the post-fix commit; the captures-feed-aloneness wiring is in `bot_scripts/msteams/captureBridge.js` |
