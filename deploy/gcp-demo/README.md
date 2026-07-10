# Parlor ephemeral demo on GCP — deployed

**Status: live.** This plan has been executed end to end against a real GCP
project and verified working, including through the actual Cloud Scheduler
trigger path (not just a manual job run):

- Web: https://parlor-demo-web-316016512837.us-central1.run.app
- Backend API: https://parlor-demo-backend-316016512837.us-central1.run.app
- ai-service: https://parlor-demo-ai-service-316016512837.us-central1.run.app
- Region: `us-central1`. Cloud SQL instance: `parlor-demo-db`.
- Reset job (`parlor-demo-reset`) runs every 10 minutes via Cloud Scheduler
  (`parlor-demo-reset-schedule`), truncating all product tables and
  reseeding one fixed demo account (`demo@parlor.example.com` —
  intentionally not a secret; the account is destroyed and recreated every
  cycle) with two canned mock meetings.
- A hard GCP budget (₹3,000/month, alerts at 50/90/100%) is set on the
  billing account as a safety net independent of this being a low-traffic,
  mostly-Cloud-Run-billed deployment.

Two real bugs were found and fixed only by actually deploying this (not
caught by writing the plan or by local docker-compose testing):
1. The `DATABASE_URL` secret needs an **empty host** with the socket path in
   `?host=/cloudsql/...` (`postgresql://user:pass@/db?host=...`) —  a
   `localhost`-style host made asyncpg attempt a real TCP connection instead
   of the Unix socket, and Cloud Run failed the container's health check.
2. `reset_demo.py` posted `{"source": "desktop"}` when creating the demo
   meetings; the actual API field is `platform`, not `source`.
3. `roles/iam.serviceAccountTokenCreator` on the invoker service account,
   granted to Cloud Scheduler's own service agent
   (`service-<PROJECT_NUMBER>@gcp-sa-cloudscheduler.iam.gserviceaccount.com`)
   — without it, Cloud Scheduler can configure the trigger but can never
   actually mint a token to invoke the job, and fails silently with no
   Cloud Run execution ever created.

The step-by-step commands below are kept as the accurate record of what was
actually run (not a hypothetical plan) — useful for tearing this down,
rebuilding it in a different project, or understanding exactly what exists.

## Redeploying (CI/CD + manual)

Once the infrastructure above exists, redeploying the three services to the
latest `main` is just: rebuild the images and roll out a new Cloud Run
revision per service. Two ways:

- **CI/CD (automatic):** `.github/workflows/deploy-gcp.yml` does exactly this
  on every push to `main` that touches `backend/`, `ai-service/`, `web/`, or
  the build configs. It's dormant until you complete the one-time Workload
  Identity Federation setup documented at the top of that workflow and set the
  repo variable `GCP_DEPLOY_ENABLED=true`.
- **Manual:** build via the shared Cloud Build configs, then deploy
  image-only (so the running services keep their env/secrets):

  ```bash
  AR=us-central1-docker.pkg.dev/named-tube-444103-p0/parlor-demo
  BACKEND_URL=https://parlor-demo-backend-316016512837.us-central1.run.app
  gcloud builds submit ./ai-service --config deploy/gcp-demo/cloudbuild.ai-service.yaml --substitutions=_IMAGE=$AR/ai-service:latest
  gcloud builds submit ./backend    --config deploy/gcp-demo/cloudbuild.backend.yaml    --substitutions=_IMAGE=$AR/backend:latest
  gcloud builds submit ./web        --config deploy/gcp-demo/cloudbuild.web.yaml        --substitutions=_IMAGE=$AR/web:latest,_API_URL=$BACKEND_URL
  for s in ai-service backend web; do gcloud run deploy parlor-demo-$s --region us-central1 --image $AR/$s:latest; done
  ```

**Critical:** deploy image-only — `gcloud run deploy --image` with no
`--set-env-vars`/`--set-secrets`. A new revision inherits the existing runtime
config (the live-Gemini env + `GEMINI_API_KEY` secret + `HOSTED_COST_CAP_*`
caps + Cloud SQL socket `DATABASE_URL`). Passing env/secret flags would reset
anything you don't re-specify — the classic way to silently knock the demo
back into a broken or mock state.

## What this is — and isn't

This is a **separate, always-available, no-signup, ephemeral browsing demo**,
not a hosted product:

- No persistent accounts. Whatever you create during your visit (a demo
  workspace, a mock meeting) is destroyed on the next reset cycle.
- No real user data ever persists past a reset.
- Resets automatically and frequently — modeled directly on
  [Uptime Kuma's public demo](https://demo.uptime.kuma.pet/), which wipes and
  reseeds every ~10 minutes.
- Runs **live AI via Google Gemini**, not mock mode. The ai-service is
  configured with `AI_MODE=live`, `AI_PROVIDER_MODE=pinned`,
  `AI_PINNED_PROVIDER=gemini`, and `AI_DEFAULT_MODEL_TIER=cheap`; the
  `GEMINI_API_KEY` lives in Secret Manager (`parlor-demo-gemini-api-key`),
  never in this repo or in an env var literal. Spend is bounded by the
  hosted cost cap on the backend (`HOSTED_COST_CAP_ENABLED=true`,
  `HOSTED_COST_CAP_MAX_USD_PER_WORKSPACE=2`, `HOSTED_COST_CAP_MAX_USD_GLOBAL=20`)
  plus a per-workspace meeting quota (`HOSTED_QUOTA_MAX_TOTAL_MEETINGS=30`),
  on top of the GCP billing budget below. (Mock mode is still the default for
  local dev and self-hosting — it's just not what this hosted demo runs.)
- **Bot-join capture is disabled entirely in the demo.** A public,
  no-signup surface that can dispatch a real Playwright/Chromium bot into an
  arbitrary Zoom/Meet/Teams URL is a live abuse vector (outbound network
  requests to third-party meeting infra, on someone else's dime, from an
  anonymous visitor) with no upside for a "let me see what this looks like"
  demo. The demo only exposes botless capture + mock AI + RAG "Ask", which
  is also genuinely the more interesting differentiator to show off.
- This is explicitly **not** the free-forever self-host path. Self-hosting
  (the root README's "Try it in 2 minutes") remains the primary, supported
  way to actually use Parlor. This demo exists purely so someone can look
  before they self-host, without giving them anything resembling a real
  account or persistent data.

## Why Cloud Run + Cloud SQL, not GKE or a bare VM

Parlor already ships as three stateless-ish HTTP services (`web`, `backend`,
`ai-service`) plus one stateful dependency (Postgres+pgvector). That maps
cleanly onto Cloud Run (one Cloud Run service per app container, same images
this repo already builds for `docker-compose.yml`) instead of standing up a
GKE cluster for three small services — Cloud Run's per-request billing and
zero idle cost fit a low-traffic public demo much better than a
cluster that's on 24/7 regardless of visitor volume.

**Database: Cloud SQL for PostgreSQL, not self-managed Postgres+pgvector on
Compute Engine.** Reasoning:

- Cloud SQL for PostgreSQL has supported the `pgvector` extension since 2023
  (`CREATE EXTENSION IF NOT EXISTS vector;` is enabled the same way as on any
  Postgres 15/16 instance) — this repo's `pgvector/pgvector:pg16` image has a
  drop-in managed equivalent, so there's no need to give up a managed
  database just for the vector column.
- A self-managed Postgres+pgvector container on a small always-on Compute
  Engine VM would save a little money but adds patching, backup, and
  restart-on-crash operational burden for a throwaway demo database that
  gets truncated every few minutes anyway — not worth the tradeoff here.
- Cloud SQL's smallest tier (`db-f1-micro` / `db-g1-small`, shared-core, ~10GB
  disk) is more than enough: demo data is deliberately tiny and gets wiped
  constantly, so there's no real storage or throughput requirement to size
  for.
- Cloud Run connects to Cloud SQL via the Cloud SQL Auth Proxy sidecar
  (`--add-cloudsql-instances` on `gcloud run deploy`), which is the standard,
  documented pattern — no public IP or manual TLS cert management needed on
  the database.

**Why not a single Cloud Run job with an attached persistent disk instead of
Cloud SQL:** Cloud Run doesn't support attaching a persistent disk to a
long-lived stateful service in the way Postgres needs (durable, consistent
writes across many short-lived request-scoped container instances) — Cloud
Run's storage model is built around stateless request handling, not stateful
daemons. Cloud SQL is the right-shaped managed primitive for this; a
self-hosted Postgres container is what you'd reach for if Cloud SQL didn't
support pgvector, which it does.

## Reset mechanism design

The entire point of this demo is that no real data survives, and the
compute/abuse surface stays as small as possible for something with no
signup gate — the same free-tier abuse economics apply here that make a
persistent free hosted tier a bad idea in general (running real compute for
anonymous visitors is expensive to secure properly, and this demo sidesteps
that by making the persisted state and the compute footprint both
deliberately tiny and short-lived rather than building genuine anti-abuse
infrastructure for a tier that isn't the point of this project).

- **Cloud Scheduler** job fires every 10 minutes (`*/10 * * * *`), matching
  the Uptime Kuma precedent, hitting a **Cloud Run Job** (not a service —
  this is a one-shot batch task, not something that serves traffic) via
  OIDC-authenticated HTTP trigger.
- The Cloud Run Job runs [`reset/reset_demo.py`](./reset/reset_demo.py),
  which:
  1. Connects to the demo Cloud SQL instance via the Cloud SQL Python
     Connector.
  2. `TRUNCATE ... RESTART IDENTITY CASCADE`s every product/app table (the
     full list was cross-checked against the actual `CREATE TABLE` statements
     in `backend/db/*.sql` — e.g. the meetings table is named `meeting_joiner`,
     not `meetings`, and webhooks live in `webhook_endpoints`/
     `webhook_deliveries` — kept in sync by hand since Cloud SQL doesn't have
     this repo's `make reset` volume-drop shortcut available).
  3. Re-seeds one fixed demo workspace + demo user + two or three canned mock
     meetings by calling the backend's own public API in the same way
     `cookbook/01-botless-capture/` and `cookbook/02-mock-mode-summary-and-ask/`
     do (`POST /api/v1/meetings/botless` →
     `POST /api/v1/meetings/{id}/transcript` →
     `POST /api/v1/meetings/{id}/complete`) — reusing the real product API
     instead of hand-crafted SQL inserts, so the seed script can't drift out
     of sync with the schema the way raw INSERTs would.
  4. Prints a summary line for Cloud Logging so a failed reset is visible
     without needing to reproduce it manually.
- The **demo landing page** (see "Wiring the demo landing page" below) shows
  a persistent banner: "This is a public demo. Data resets every 10 minutes.
  Do not enter anything sensitive." — matching the Uptime Kuma demo's own
  framing.
- No outbound integrations (Slack/Notion/HubSpot/Salesforce recap delivery,
  webhooks) are configured with real credentials in the demo environment —
  those code paths stay inert because their env vars are simply never set,
  the same "optional and inert until configured" behavior described in the
  root README's "What's included" section.

## Step-by-step (as actually run)

This is the real sequence of commands used to stand up the live deployment
above, kept here so it can be reproduced, torn down, or rebuilt in a
different project. Two fixes (the DSN host format, and
`roles/iam.serviceAccountTokenCreator` for the Scheduler service agent) are
folded into the commands below rather than left as separate corrections —
following this section top to bottom now reflects what actually works, not
the original first-draft plan.

```bash
# 0. Project setup
export PROJECT_ID=parlor-demo-$(date +%s)   # pick a real, permanent project id instead
export REGION=us-central1
gcloud projects create "$PROJECT_ID" --name="Parlor demo"
gcloud config set project "$PROJECT_ID"
gcloud billing projects link "$PROJECT_ID" --billing-account=<YOUR_BILLING_ACCOUNT_ID>

# 1. Enable required APIs
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  cloudscheduler.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  vpcaccess.googleapis.com

# 2. Artifact Registry for the three app images
gcloud artifacts repositories create parlor-demo \
  --repository-format=docker --location="$REGION"

# 3. Build and push the three existing images (reuses this repo's Dockerfiles).
# `gcloud builds submit` uses the Dockerfile named exactly "Dockerfile" at the
# build context root, so the API-only backend/Dockerfile.dev (no bot runtime
# in the demo, by design — see above) needs a local `docker build -f` +
# `docker push` instead of a bare `gcloud builds submit`:
docker build -f backend/Dockerfile.dev -t "$REGION-docker.pkg.dev/$PROJECT_ID/parlor-demo/backend:latest" backend
docker push "$REGION-docker.pkg.dev/$PROJECT_ID/parlor-demo/backend:latest"

gcloud builds submit ./ai-service \
  --tag "$REGION-docker.pkg.dev/$PROJECT_ID/parlor-demo/ai-service:latest"
gcloud builds submit ./web \
  --tag "$REGION-docker.pkg.dev/$PROJECT_ID/parlor-demo/web:latest"

# 4. Cloud SQL for PostgreSQL with pgvector
# NOTE: db-g1-small alone 400s under the ENTERPRISE_PLUS default edition —
# --edition=ENTERPRISE is required for the classic shared-core tiers.
gcloud sql instances create parlor-demo-db \
  --database-version=POSTGRES_16 \
  --edition=ENTERPRISE \
  --tier=db-g1-small \
  --region="$REGION" \
  --storage-size=10GB \
  --storage-auto-increase
gcloud sql databases create parlor --instance=parlor-demo-db
gcloud sql users create parlor_demo --instance=parlor-demo-db --password=<GENERATE_WITH_openssl_rand>

# Connect via the Cloud SQL Auth Proxy (installed with
# `gcloud components install cloud-sql-proxy`; may land outside PATH — check
# $(gcloud info --format='value(installation.sdk_root)')/bin) and, as the
# postgres superuser (CREATE EXTENSION needs superuser, the app user
# doesn't), run: CREATE EXTENSION IF NOT EXISTS vector; then apply this
# repo's schema migrations from backend/db/*.sql in the exact order
# docker-compose.yml's initdb mount list uses them, then grant the app user
# access:
#   GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO parlor_demo;
#   GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO parlor_demo;
#   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO parlor_demo;
#   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO parlor_demo;

# The DATABASE_URL secret MUST use an empty host with the socket path in the
# `host` query param -- NOT a `localhost`-style netloc, which makes asyncpg
# attempt a real TCP connection and fails Cloud Run's health check outright:
CONNECTION_NAME="$PROJECT_ID:$REGION:parlor-demo-db"
DATABASE_URL="postgresql://parlor_demo:<PASSWORD>@/parlor?host=/cloudsql/${CONNECTION_NAME}"
printf '%s' "$DATABASE_URL" | gcloud secrets create parlor-demo-database-url --data-file=-

# 5. Deploy the three Cloud Run services
gcloud run deploy parlor-demo-backend \
  --image="$REGION-docker.pkg.dev/$PROJECT_ID/parlor-demo/backend:latest" \
  --region="$REGION" --allow-unauthenticated \
  --add-cloudsql-instances="$CONNECTION_NAME" \
  --set-env-vars="AI_MODE=mock,RUNTIME_MODE=standalone,MEETING_JOINER_DB_DRIVER=pg,MEETING_JOINER_STORAGE_REQUIRED=false,MSTEAMS_TRANSCRIPT_SOURCE=teams_captions,HOSTED_QUOTA_ENABLED=true,HOSTED_QUOTA_MAX_TOTAL_MEETINGS=30,HOSTED_COST_CAP_ENABLED=true,HOSTED_COST_CAP_MAX_USD_PER_WORKSPACE=2,HOSTED_COST_CAP_MAX_USD_GLOBAL=20" \
  --set-secrets="DATABASE_URL=parlor-demo-database-url:latest"
# The backend itself runs AI_MODE=mock and delegates all real LLM calls to the
# ai-service (AI_SERVICE_URL, wired below) — which is the service that runs
# live Gemini. The HOSTED_COST_CAP_* / HOSTED_QUOTA_* vars bound hosted spend.
# The demo is BOTLESS (transcripts are ingested directly, no bot capture), so
# it needs no cloud STT key and no recording blob storage — startup secret
# validation requires waiving both, or the container won't boot:
#   MEETING_JOINER_STORAGE_REQUIRED=false  -> no Azure Blob connection string
#   MSTEAMS_TRANSCRIPT_SOURCE=teams_captions -> captions path, no OPENAI/ASR key
# (Do NOT set LLM_PROVIDER=local_whisper here — the startup validator doesn't
# recognize that value and raises 'Unknown STT provider'.)
# The Cloud Run default compute service account needs explicit access to
# the secret, or the deploy above fails with a "Permission denied on
# secret" error:
gcloud secrets add-iam-policy-binding parlor-demo-database-url \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
# Once the backend is up, wire its URL into ai-service so the two can talk:
gcloud run services update parlor-demo-backend --region="$REGION" \
  --update-env-vars="AI_SERVICE_URL=<ai-service URL from the deploy below>"

# The demo runs LIVE Gemini. Store the key in Secret Manager (never inline it
# in a command or commit it), then grant the Cloud Run compute SA read access:
printf '%s' "<YOUR_GEMINI_API_KEY>" | gcloud secrets create parlor-demo-gemini-api-key --data-file=-
gcloud secrets add-iam-policy-binding parlor-demo-gemini-api-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud run deploy parlor-demo-ai-service \
  --image="$REGION-docker.pkg.dev/$PROJECT_ID/parlor-demo/ai-service:latest" \
  --region="$REGION" --allow-unauthenticated \
  --add-cloudsql-instances="$CONNECTION_NAME" \
  --set-env-vars="AI_MODE=live,AI_PROVIDER_MODE=pinned,AI_PINNED_PROVIDER=gemini,AI_DEFAULT_MODEL_TIER=cheap" \
  --set-secrets="DATABASE_URL=parlor-demo-database-url:latest,GEMINI_API_KEY=parlor-demo-gemini-api-key:latest"

# web needs NEXT_PUBLIC_API_URL baked in at BUILD time (it's inlined into
# the client bundle), so build/push web only after the backend URL is known:
docker build --build-arg NEXT_PUBLIC_API_URL="<backend URL from above>" \
  -t "$REGION-docker.pkg.dev/$PROJECT_ID/parlor-demo/web:latest" web
docker push "$REGION-docker.pkg.dev/$PROJECT_ID/parlor-demo/web:latest"
gcloud run deploy parlor-demo-web \
  --image="$REGION-docker.pkg.dev/$PROJECT_ID/parlor-demo/web:latest" \
  --region="$REGION" --allow-unauthenticated \
  --set-env-vars="NEXT_PUBLIC_API_URL=<backend service URL from the deploy above>"

# 6. Build and deploy the reset Cloud Run Job
gcloud builds submit ./deploy/gcp-demo/reset \
  --tag "$REGION-docker.pkg.dev/$PROJECT_ID/parlor-demo/reset-demo:latest"
gcloud run jobs create parlor-demo-reset \
  --image="$REGION-docker.pkg.dev/$PROJECT_ID/parlor-demo/reset-demo:latest" \
  --region="$REGION" \
  --set-cloudsql-instances="$CONNECTION_NAME" \
  --set-secrets="DATABASE_URL=parlor-demo-database-url:latest" \
  --set-env-vars="BACKEND_URL=<backend service URL from step 5>"

# 7. Cloud Scheduler: fire the reset job every 10 minutes
gcloud iam service-accounts create parlor-demo-reset-invoker \
  --display-name="Parlor demo reset job invoker (Cloud Scheduler only)"
gcloud run jobs add-iam-policy-binding parlor-demo-reset --region="$REGION" \
  --member="serviceAccount:parlor-demo-reset-invoker@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.invoker"
# Cloud Scheduler's OWN service agent also needs permission to mint a token
# AS the invoker account -- without this, the schedule looks correctly
# configured but silently never produces a single Cloud Run execution:
gcloud iam service-accounts add-iam-policy-binding \
  parlor-demo-reset-invoker@${PROJECT_ID}.iam.gserviceaccount.com \
  --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-cloudscheduler.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator"
gcloud scheduler jobs create http parlor-demo-reset-schedule \
  --location="$REGION" \
  --schedule="*/10 * * * *" \
  --uri="https://${REGION}-run.googleapis.com/v2/projects/${PROJECT_ID}/locations/${REGION}/jobs/parlor-demo-reset:run" \
  --http-method=POST \
  --oauth-service-account-email="parlor-demo-reset-invoker@${PROJECT_ID}.iam.gserviceaccount.com"

# Recommended: a hard budget so spend is capped regardless of credits/plan.
gcloud billing budgets create --billing-account=<YOUR_BILLING_ACCOUNT_ID> \
  --display-name="Parlor demo — hard cap" --budget-amount=35USD \
  --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 --threshold-rule=percent=1.0 \
  --filter-projects="projects/$PROJECT_ID"

# 8. Optional: custom domain
gcloud run domain-mappings create --service=parlor-demo-web \
  --domain=demo.parlor.example.com --region="$REGION"
# then add the CNAME/A records GCP prints out to your DNS provider.
```

## Wiring the demo landing page

Not built yet — tracked here as the last step once the above is actually
deployed:

- A visible, dismissible-but-persistent banner component on the demo `web`
  deployment only (gated by an env var like `NEXT_PUBLIC_DEMO_MODE=true`, so
  the same image can serve both the demo and a real self-host without a
  fork) reading something like: *"You're viewing a public demo. Everything
  resets every 10 minutes and nothing you enter here is private or kept —
  don't use a real email or real meeting content."*
- The demo `web` deployment's sign-up form pre-fills or auto-creates a fixed
  demo account so visitors skip signup entirely, consistent with "no
  signup" — exact UX (auto-login link vs. a one-click "Enter demo" button)
  is a product decision for whoever builds this, not decided here.

## Cost estimate (rough, unverified against a real bill)

Cloud Run's per-request billing means near-zero cost at low demo traffic;
the dominant fixed cost is the always-on Cloud SQL instance
(`db-g1-small` is roughly $25-35/month at current list pricing, subject to
change — verify against the GCP pricing calculator before committing to
this, since list prices drift and this wasn't cross-checked live).
