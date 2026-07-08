# Parlor ephemeral demo on GCP — deployment plan (not yet executed)

**Status: this has not been deployed.** There is no live demo URL. This
directory documents the exact plan a maintainer with a real GCP project,
billing account, and credentials would follow to stand it up. Nothing here
was run against a real GCP project — this environment has neither `gcloud`
nor GCP credentials (verified: `gcloud` is not installed here).

## What this is — and isn't

This is a **separate, always-available, no-signup, ephemeral browsing demo**,
not a hosted product:

- No persistent accounts. Whatever you create during your visit (a demo
  workspace, a mock meeting) is destroyed on the next reset cycle.
- No real user data ever persists past a reset.
- Resets automatically and frequently — modeled directly on
  [Uptime Kuma's public demo](https://demo.uptime.kuma.pet/), which wipes and
  reseeds every ~10 minutes.
- Runs Parlor in `AI_MODE=mock` only. No LLM provider keys are configured for
  the demo, ever — mock mode is a first-class feature of this project (see
  the root README), not a downgrade for the demo.
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

## Step-by-step (not yet executed)

Everything below is exact enough to run, but requires a real GCP project,
billing account, and `gcloud auth login` credentials that don't exist in
this environment.

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
gcloud sql instances create parlor-demo-db \
  --database-version=POSTGRES_16 \
  --tier=db-g1-small \
  --region="$REGION" \
  --storage-size=10GB \
  --storage-auto-increase
gcloud sql databases create parlor --instance=parlor-demo-db
gcloud sql users create parlor_demo --instance=parlor-demo-db --password=<GENERATE_WITH_openssl_rand>
# Enable pgvector once connected (psql via Cloud SQL Auth Proxy, then):
#   CREATE EXTENSION IF NOT EXISTS vector;
# Apply this repo's schema migrations from backend/db/*.sql, in the same
# numeric order docker-compose.yml lists them, against this instance once.

# 5. Deploy the three Cloud Run services
gcloud run deploy parlor-demo-backend \
  --image="$REGION-docker.pkg.dev/$PROJECT_ID/parlor-demo/backend:latest" \
  --region="$REGION" --allow-unauthenticated \
  --add-cloudsql-instances="$PROJECT_ID:$REGION:parlor-demo-db" \
  --set-env-vars="AI_MODE=mock,RUNTIME_MODE=standalone,MEETING_JOINER_DB_DRIVER=pg" \
  --set-secrets="DATABASE_URL=parlor-demo-database-url:latest"

gcloud run deploy parlor-demo-ai-service \
  --image="$REGION-docker.pkg.dev/$PROJECT_ID/parlor-demo/ai-service:latest" \
  --region="$REGION" --allow-unauthenticated \
  --add-cloudsql-instances="$PROJECT_ID:$REGION:parlor-demo-db" \
  --set-env-vars="AI_MODE=mock" \
  --set-secrets="DATABASE_URL=parlor-demo-database-url:latest"

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
  --add-cloudsql-instances="$PROJECT_ID:$REGION:parlor-demo-db" \
  --set-secrets="DATABASE_URL=parlor-demo-database-url:latest" \
  --set-env-vars="BACKEND_URL=<backend service URL from step 5>"

# 7. Cloud Scheduler: fire the reset job every 10 minutes
gcloud scheduler jobs create http parlor-demo-reset-schedule \
  --location="$REGION" \
  --schedule="*/10 * * * *" \
  --uri="https://$REGION-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/$PROJECT_ID/jobs/parlor-demo-reset:run" \
  --http-method=POST \
  --oauth-service-account-email="<a dedicated service account with roles/run.invoker only>"

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
