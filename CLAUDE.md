# CLAUDE.md

## Code comments

Default to no comments. Well-named identifiers should carry the "what"; only
add a comment when it captures a non-obvious "why" (a hidden constraint, a
workaround for a specific bug, an invariant a reader would otherwise miss).
Never restate what the code already says — that's wasted tokens to write, read,
and keep in sync, not documentation.

## Working across multiple sessions/agents on this repo

More than one Claude Code session may be working on this repo at the same
time, without shared memory between them — git is the only thing they
actually coordinate through. This has already happened here for real: one
session's merge reintroduced a factually wrong "optional billing" claim into
the README because it wasn't aware billing had just been deliberately
removed by a different session.

- **Before pushing, always `git fetch` first and diff against the remote.**
  A rejected push (`! [rejected] ... (fetch first)`) means another session
  has already pushed — stop, fetch, and read what actually changed before
  doing anything else.
- **Never force-push to resolve a rejected push without investigating first.**
  Do a real `git merge` so both sides' work survives, then resolve conflicts
  by reading both versions.
- **Don't trust another session's commit messages or doc edits at face
  value — verify against the actual current files**, same as you'd verify
  your own subagents. A concurrent session may be working from stale
  context it never re-fetched.
- **This repo has explicit, deliberate constraints from its OSS-extraction
  work — treat these as authoritative and re-check them after any merge**,
  since a concurrent session unaware of them can silently reintroduce what
  they undo:
  - **No billing, payment, or pricing concept anywhere.** `backend/src/billing/`
    was deliberately deleted; do not recreate it or describe it as present.
  - **No fabricated social proof** (fake customer names/logos, fake company
    entities in copyright lines) and **no dead links** — every link and claim
    in public-facing pages (README, landing page, footer) must point
    somewhere real or be removed.
  - **No internal-only content**: no internal roadmap docs, codenames,
    internal domains, or company-process files (the pattern that caused a
    real leak here: `STATE.md`, internal engineering docs naming real
    customers/PRs). If you find something like this, remove it, don't just
    flag it.
  - Full history of what's been checked/fixed lives in a `docs/OSS-LAUNCH-ISSUES-TRACKER.md`
    kept in the separate closed-source product this was extracted from — that
    tracker itself must never be copied into this repo (it documents past
    vulnerabilities; irrelevant and inappropriate for a public repo once fixed).
- **Re-run the full test suite after any merge**, even a clean auto-merge.

## Deploying the hosted demo (direct to GCP, not via CI/CD)

There is an always-on hosted demo on Google Cloud Run — three services
(`parlor-demo-web` / `parlor-demo-backend` / `parlor-demo-ai-service`) plus
Cloud SQL, in `us-central1`, images in the Artifact Registry repo
`parlor-demo`. The concrete operator specifics (GCP project id/number, the
Cloud Run URLs, Secret Manager entries, the reset job) live in
`deploy/gcp-demo/README.md`, deliberately **not** here (public repo).

- **CI/CD exists but is normally dormant.** `.github/workflows/deploy-gcp.yml`
  builds + deploys on push to `main`, but only when the repo variable
  `GCP_DEPLOY_ENABLED=true`. It is usually left `false` (GitHub Actions
  minutes are a finite monthly budget), so **deploy directly with `gcloud`**
  rather than relying on the workflow. Re-enable the workflow by flipping that
  variable when Actions minutes are available.
- **Direct deploy = Cloud Build, then Cloud Run.** Cloud Build runs GCP-side
  (billed under the GCP budget, *not* Actions minutes), using the committed
  `deploy/gcp-demo/cloudbuild.{backend,ai-service,web}.yaml` configs:
  ```bash
  AR=us-central1-docker.pkg.dev/<PROJECT_ID>/parlor-demo
  BACKEND_URL=$(gcloud run services describe parlor-demo-backend --region=us-central1 --format='value(status.url)')
  gcloud builds submit ./backend    --config deploy/gcp-demo/cloudbuild.backend.yaml    --substitutions=_IMAGE=$AR/backend:latest
  gcloud builds submit ./ai-service --config deploy/gcp-demo/cloudbuild.ai-service.yaml --substitutions=_IMAGE=$AR/ai-service:latest
  gcloud builds submit ./web        --config deploy/gcp-demo/cloudbuild.web.yaml        --substitutions=_IMAGE=$AR/web:latest,_API_URL=$BACKEND_URL
  for s in backend ai-service web; do gcloud run deploy parlor-demo-$s --region us-central1 --image $AR/$s:latest; done
  ```
- **Deploy image-only — never pass `--set-env-vars`/`--set-secrets` on a
  redeploy.** A new Cloud Run revision inherits the previous revision's runtime
  config (the live-Gemini `GEMINI_API_KEY` secret, the `HOSTED_COST_CAP_*`
  spend caps, the Cloud SQL socket `DATABASE_URL`, `ENABLE_API_DOCS=false`).
  Passing env/secret flags silently resets anything you don't re-specify — the
  classic way to knock the demo into a broken or mock state.
- The Cloud Build configs set `options.logging: CLOUD_LOGGING_ONLY` on purpose:
  the CI deployer service account can't write to the default GCS logs bucket,
  so a bare `gcloud builds submit --tag` fails for it.

## Deploy gotchas / fundamentals worth knowing before you touch a build

- **`backend/requirements-dev.txt` is a hash-pinned lockfile.** pip runs in
  hash-required mode, so adding a dependency means adding its `--hash` lines
  **and** every new transitive dep's hashes (for a compiled dep, the specific
  manylinux/abi3 wheel hash for `linux/amd64` plus the sdist). The code has
  drifted from this lockfile before — packages `import`ed but never declared
  (e.g. `email-validator`, `pwdlib`/`argon2-cffi`) make the backend image
  build fine but crash at boot with `ModuleNotFoundError`. Keep imports and
  the lockfile in sync, and pin new deps with hashes.
- **The demo backend image is `backend/Dockerfile.dev`** (API-only, no bot
  runtime / Chromium). `backend/Dockerfile.botruntime` is the heavy image that
  actually launches bots — do not use it for the Cloud Run demo.
- **`shared/secret_validator.py` runs at startup and fails closed.** The
  botless demo must set `MEETING_JOINER_STORAGE_REQUIRED=false` and
  `MSTEAMS_TRANSCRIPT_SOURCE=teams_captions` (the captions path needs no cloud
  STT key) or the backend won't boot. Do **not** set
  `LLM_PROVIDER=local_whisper` — the validator rejects that value outright.
- **API docs are gated by `ENABLE_API_DOCS`.** Default is dev-on / prod-off
  (keyed off `RUNTIME_MODE`), but the demo runs `standalone` (a dev runtime),
  so it sets `ENABLE_API_DOCS=false` explicitly to keep `/docs`, `/redoc`,
  `/openapi.json` returning 404. The ai-service hardcodes its docs off. There
  should be no user-facing Swagger/ReDoc/OpenAPI links (they were removed from
  `web/app/developers` and the README).
- **Next.js 16 / Turbopack requires a static middleware `matcher`.** In
  `web/proxy.ts`, `export const config.matcher` must be a literal array — a
  computed `PROTECTED_PREFIXES.map(...)` is rejected at build time and breaks
  the `web` build. The static matcher must be kept in sync with
  `PROTECTED_PREFIXES` by hand.
- **`PROTECTED_PREFIXES` (in `web/proxy.ts`) is the auth boundary.** Any path
  prefix listed there redirects anonymous visitors to `/login`. `/developers`
  is public docs (it lives outside the `(app)` group) and must stay OUT of
  that list.
- **`NEXT_PUBLIC_API_URL` is baked into the web bundle at build time** (a Docker
  build arg, not a runtime env). Changing which backend the web talks to means
  rebuilding the `web` image, not just updating a Cloud Run env var.
