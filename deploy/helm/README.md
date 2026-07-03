# Parlor Helm chart

Deploy the full Parlor meeting-assistant stack to any Kubernetes cluster with
a single `helm install`. Self-hosted, no managed services required for dev.

Chart lives in [`parlor/`](./parlor).

## Stack

| Component    | Image (default repo)              | Port | Role |
|--------------|-----------------------------------|------|------|
| `backend`    | `parlor-meeting-api`             | 8000 | FastAPI product API (`/api/v1`, auth, meetings, calendar) |
| `ai-service` | `parlor-ai-service`              | 8100 | Summaries, embeddings, RAG chat over pgvector |
| `web`        | `parlor-web`                     | 3000 | Next.js dashboard |
| `bot-worker` | `parlor-meeting-worker`          | 3001 | Chromium meeting bot / warm pool |
| `postgres`   | `pgvector/pgvector:pg16`          | 5432 | Optional in-cluster pgvector DB (dev only) |

Each component is its own Deployment + Service. The chart also renders a shared
ConfigMap + Secret, a ServiceAccount + RBAC (for warm-pool pod dispatch), an
optional Ingress, an optional backend HPA, and a one-shot db-init Job that
applies `backend/db/*.sql` (idempotent) as a Helm hook.

## Prerequisites

- Kubernetes 1.23+ and Helm 3.8+ (validated on Helm 4.2).
- The four application images built and reachable by the cluster. For local
  clusters, build them and load into the node:
  ```bash
  # kind
  kind load docker-image parlor-meeting-api:dev parlor-ai-service:dev \
                          parlor-web:dev parlor-meeting-worker:dev
  # k3s (containerd)
  docker save parlor-meeting-api:dev | sudo k3s ctr images import -
  ```

---

## (a) Local — k3s / kind / minikube / Docker Desktop

Everything in-cluster, mock AI, standalone bots, no external DB, no API keys.

```bash
helm install parlor ./deploy/helm/parlor \
  -f deploy/helm/parlor/values-dev.yaml \
  --namespace parlor --create-namespace
```

What [`values-dev.yaml`](./parlor/values-dev.yaml) sets:

- `postgres.enabled=true` — in-cluster pgvector, auto-bootstrapped by the
  db-init Job. The DSN is computed automatically and injected as `DATABASE_URL`.
- `aiMode=mock` — ai-service returns deterministic stubs; no keys needed.
- `runtimeMode=standalone` + `meetingBotMode=subprocess` — no warm-pool
  machinery; the bot-worker runs as a normal Deployment.
- `sttProvider=local_whisper` — no cloud STT credentials.
- `ingress.enabled=false` — reach the UI by port-forward:

```bash
kubectl -n parlor port-forward svc/parlor-web 3000:3000
kubectl -n parlor port-forward svc/parlor-backend 8000:8000
# open http://localhost:3000 and sign up
```

Verify:

```bash
kubectl -n parlor get pods -l app.kubernetes.io/instance=parlor
kubectl -n parlor exec deploy/parlor-backend -- wget -qO- localhost:8000/ready
```

---

## (b) Production — external DB + live LLM + warm-pool + ingress/TLS

```bash
cp deploy/helm/parlor/values-prod.yaml.example values-prod.yaml   # keep out of git
# edit values-prod.yaml (image registry, hosts, etc.)

# Create secrets out-of-band (preferred over putting them in any values file):
kubectl create namespace parlor
kubectl -n parlor create secret generic parlor-secrets \
  --from-literal=JWT_SECRET="$(python -c 'import secrets;print(secrets.token_urlsafe(48))')" \
  --from-literal=DATABASE_URL="postgresql://user:pass@db-host:5432/parlor" \
  --from-literal=ANTHROPIC_API_KEY="sk-ant-..." \
  --from-literal=OPENAI_API_KEY="sk-..." \
  --from-literal=CALENDAR_TOKEN_KEY="$(python -c 'from cryptography.fernet import Fernet;print(Fernet.generate_key().decode())')" \
  --from-literal=AWS_ACCESS_KEY_ID="..." \
  --from-literal=AWS_SECRET_ACCESS_KEY="..."

helm install parlor ./deploy/helm/parlor \
  -f values-prod.yaml \
  --namespace parlor
```

What [`values-prod.yaml.example`](./parlor/values-prod.yaml.example) sets:

- `postgres.enabled=false` + external DB via the `DATABASE_URL` secret key
  (or `externalDatabaseUrl`). Your DB **must** have the `pgvector` extension.
- `secrets.existingSecret=parlor-secrets` — the chart renders NO Secret of its
  own; it consumes yours via `envFrom`.
- `aiMode=live`, `aiProviderOrder`, real provider keys.
- `runtimeMode=k8s` — enables the warm-pool dispatcher. The chart's
  ServiceAccount + Role/RoleBinding grant it namespaced perms to create/manage
  bot pods and read the shared ConfigMap/Secret.
- `backend.autoscaling.enabled=true` — renders an HPA.
- `ingress.enabled=true` with split hosts (`host` for web, `apiHost` for the
  API) and TLS via cert-manager. Single-host mode (API under `/api`) is the
  default when `apiHost` is empty.

The db-init Job applies the schema to the external DB on install/upgrade
(`dbInit.enabled=true`). Set it to `false` if you run migrations yourself.

---

## Values reference

### Global

| Key | Default | Description |
|-----|---------|-------------|
| `global.imageRegistry` | `""` | Registry prefix for all images |
| `global.imageTag` | `""` | Default tag (falls back to `Chart.appVersion`) |
| `global.imagePullPolicy` | `IfNotPresent` | Default pull policy |
| `global.imagePullSecrets` | `[]` | Pull secrets for private registries |

### Runtime toggles

| Key | Default | Description |
|-----|---------|-------------|
| `runtimeMode` | `standalone` | `standalone` (no warm pool) or `k8s` (warm-pool dispatch) |
| `aiMode` | `live` | `mock` (no keys) or `live` |
| `aiProviderOrder` | `anthropic,openai` | ai-service provider routing |
| `sttProvider` | `local_whisper` | `aws_transcribe`/`azure_speech`/`azure_openai`/`openai`/`local_whisper` |
| `meetingBotMode` | `subprocess` | Standalone bot dispatch: `subprocess` or `disabled` |
| `logLevel` | `INFO` | Log level for all services |

### Secrets & database

| Key | Default | Description |
|-----|---------|-------------|
| `secrets.existingSecret` | `""` | Name of a pre-created Secret; when set the chart renders none |
| `secrets.data.*` | `{}` | Per-key values rendered into a chart Secret (keep out of git) |
| `postgres.enabled` | `false` | Deploy in-cluster pgvector Postgres + PVC |
| `postgres.auth.{username,password,database}` | `meeting` | In-cluster DB credentials |
| `postgres.persistence.{enabled,size,storageClass}` | `true,10Gi,""` | PVC config |
| `externalDatabaseUrl` | `""` | DSN used when `postgres.enabled=false` |
| `dbInit.enabled` | `true` | Run the schema bootstrap Job |

Required secret keys: `DATABASE_URL` (unless `postgres.enabled`), `JWT_SECRET`.
Optional per feature: `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` (live AI),
`CALENDAR_TOKEN_KEY` + `GOOGLE_*`/`MS_*` (calendar), `AWS_*`/`AZURE_*` (STT &
storage), `ZOOM_APP_CLIENT_*` (Zoom).

### Per-component (backend / aiService / web / botWorker)

| Key | Description |
|-----|-------------|
| `<c>.enabled` | Toggle the component |
| `<c>.replicaCount` | Replicas (botWorker = warm-pool size) |
| `<c>.image.{registry,repository,tag,pullPolicy}` | Per-component image overrides |
| `<c>.service.{type,port}` | Service type and port |
| `<c>.resources` | Requests/limits |
| `<c>.{livenessProbe,readinessProbe}` | Probes (backend hits `/health` + `/ready`) |
| `<c>.{nodeSelector,tolerations,affinity,extraEnv}` | Scheduling + extra env |

Backend-specific: `backend.allowedOrigins`, `backend.allowedHosts`,
`backend.calendarOauthRedirectBase`, `backend.autoscaling.*`.
Web-specific: `web.publicApiUrl` (browser→API), `web.apiInternalUrl`
(SSR→API; auto-derived if empty).
Bot-worker-specific: `botWorker.botName`, `botWorker.enabledPlatforms`,
`botWorker.{googlemeet,msteams}TranscriptSource`, `botWorker.storageRequired`,
`botWorker.warmPool.{namespace,size,max}`.

### ServiceAccount / RBAC / Ingress

| Key | Default | Description |
|-----|---------|-------------|
| `serviceAccount.create` | `true` | Create the bot dispatch ServiceAccount |
| `rbac.create` | `true` | Create the namespaced Role + RoleBinding for pod dispatch |
| `ingress.enabled` | `false` | Render the Ingress |
| `ingress.className` | `nginx` | IngressClass |
| `ingress.host` / `ingress.apiHost` | — | Web host / optional dedicated API host |
| `ingress.tls.{enabled,secretName}` | `false` | TLS config |

## Notes

- The shared ConfigMap is intentionally named `<release>-config` and wired into
  the backend as `MEETING_JOINER_CONFIGMAP`, so the k8s warm-pool dispatcher
  mounts the correct ConfigMap/Secret onto the bot pods it creates.
- All probes target the app health endpoints (`/health`, `/ready` for backend;
  the bot-worker liveness checks the `Xvfb`/`pulseaudio` processes per the
  upstream manifest).
- The bundled SQL under `parlor/files/db/` is copied from `backend/db/`. If the
  schema changes upstream, refresh those copies.
- Lint & render locally:
  ```bash
  helm lint deploy/helm/parlor
  helm template parlor deploy/helm/parlor -f deploy/helm/parlor/values-dev.yaml
  ```
