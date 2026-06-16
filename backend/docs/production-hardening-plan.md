# Meeting-Joiner — Production Hardening Plan

> Internal engineering plan. Scope: harden the existing bot platform for
> production deployment. Out of scope: customer-facing feature additions
> (webhooks, calendar integration, Recall-compat APIs, replay URLs,
> streaming transcript APIs).

## 1. Goal

Make `meeting-joiner` reliable in production for self-hosted customer
clusters. Three properties matter:

1. **Scalable deployment** — one ephemeral pod per meeting, warm pool so
   joins are fast, no shared mutable state between meetings.
2. **Bot rejoin + transcript continuity** — when a bot drops mid-meeting
   (network blip, pod kill, platform hiccup), a new bot picks up the same
   meeting and downstream consumers see one coherent transcript.
3. **Graceful failure modes** — selector breakage detected by canary,
   memory pressure handled with soft abort, disk artifacts flushed to
   Azure Blob, OOM kills surfaced as metrics.

Specific SLA numbers, capacity figures, and timelines are tracked in the
engineering wiki — not in this document so it can be shared internally
without leaking customer-facing commitments.

## 2. Target Architecture

```
                                  ┌─────────────────────────────────────┐
                                  │  PER-CUSTOMER AKS CLUSTER           │
                                  │  (e.g. aks-terraform-akkodis)       │
                                  │                                     │
external traffic ──► nginx ingress ──► meeting-joiner-api (Deployment) │
                     (TLS via         │   HPA on CPU                    │
                      cert-manager)   │   PDB minAvailable=1            │
                                  │   ┌─────────────────────────────┐ │
                                  │   │ FastAPI routes              │ │
                                  │   │ WarmPoolManager (bg tasks)  │ │
                                  │   │ Selector canary (bg)        │ │
                                  │   └────────────┬────────────────┘ │
                                  │                │ claim_pod (CAS)   │
                                  │                ▼                   │
                                  │   meeting-worker pods (imperative) │
                                  │   ┌─────────────────────────────┐ │
                                  │   │ pool=warm   (standby)       │ │
                                  │   │ priorityClass=mw-warm       │ │
                                  │   └─────────────────────────────┘ │
                                  │   ┌─────────────────────────────┐ │
                                  │   │ pool=claimed (in-meeting)   │ │
                                  │   │ priorityClass=mw-claimed    │ │
                                  │   │ containers:                 │ │
                                  │   │  - bot-runtime (Chromium /  │ │
                                  │   │    Xvfb / pulseaudio / bot) │ │
                                  │   │  - sidecar (HTTP control,   │ │
                                  │   │    heartbeat, /abort flush) │ │
                                  │   │ restartPolicy: Never        │ │
                                  │   └─────────────────────────────┘ │
                                  │                                     │
                                  │   prepulled-image DaemonSet         │
                                  │   (warms node image cache)          │
                                  │                                     │
                                  │   In-cluster shared infra:          │
                                  │   ▸ PostgreSQL (meeting state)      │
                                  │   ▸ OTel Collector (optional)       │
                                  │   ▸ Azure Blob (recordings)         │
                                  └─────────────────────────────────────┘
```

## 3. Phase Plan

### Phase 1 — Observability + secret hardening + bug fixes

Lightweight, optional telemetry. Customer can disable OTel entirely via
env flag without affecting bot behaviour.

- **OpenTelemetry SDK** (Py + Node) emits to in-cluster OTel collector.
  Feature-flagged with `OTEL_ENABLED=false` for customers without an
  obs stack.
- **structlog (Py) + pino (Node)** JSON logs to stdout. Promtail picks
  them up in customers running Loki.
- **`shared/secret_validator.py`** — startup validation; fails fast with
  the full list of missing required secrets so misconfigured deployments
  don't get past `kubectl rollout`.
- **`/ready` endpoint** distinct from `/health` (liveness vs readiness).
- **Bridge timeout bug fix** — `meeting_processor_bridge.py:440` was
  `timeout=30000` with a stale "5 hour max" comment. Now env-driven 9h
  default, exceeds the in-bot `MSTEAMS_MAX_MEETING_MS` so the bot's own
  exit reason wins instead of being masked by the wrapper.
- **Probes on transitional `infra/specs/meetingjoiner.yml`** —
  liveness + readiness wired up. Replaced by the Helm chart in Phase 2.

### Phase 2 — Warm pool foundation

Replace the one-pod, asyncio-locked worker Deployment with imperative
pod-per-meeting + warm pool. Ported from techops sandbox.

- **`src/services/warm_pool_manager.py`** — replenish + reaper loops, K8s
  labels as source of truth, atomic CAS claim via JSON Patch +
  `resourceVersion`. Adaptations vs techops source: NO recycle (audio
  singletons leak), meeting-specific reaper signal (heartbeat-based,
  not idle-based), 9h `activeDeadlineSeconds`, wider egress allowlist.
- **`src/services/pod_claim_policy.py` + `k8s_auth.py`** — verbatim
  ports.
- **`src/services/warm_pool_dispatcher.py`** — API-side seam: claim a
  warm pod, POST `/configure` to its sidecar, fall back to PGQueuer
  cold-start if no warm pod is available.
- **`src/sidecar/`** — FastAPI service co-located in each pod. Exposes
  `/configure` (start the bot), `/health` (warm-pool reaper polls this),
  `/abort` (graceful shutdown + transcript flush), `/metrics`.
- **`infra/aiops-chart/templates/meeting-joiner/`** — 16-file Helm
  chart: configmap, two PriorityClasses, ServiceAccount + RBAC,
  NetworkPolicy, ValidatingAdmissionPolicy, API Deployment + Service +
  HPA + PDB, Ingress, prepulled-image DaemonSet, optional
  ExternalSecret, optional ServiceMonitor.
- **`infra/docker/meeting_sidecar.Dockerfile`** — minimal sidecar image.
- **Migration `20260601000000_meeting_joiner_pod_per_meeting`** —
  drop `process_id`, add `pod_name`, `cluster_name`,
  `last_heartbeat_at`.

### Phase 3 — Sessions, rejoin, worker-death recovery

Same `meeting_joiner.id` survives bot drop / pod death / transient
platform errors. Downstream consumers see a single transcript stream
across rejoins.

- **`meeting_sessions` table** — one row per bot attempt for a meeting.
  Migration `20260615000000_meeting_sessions`.
- **State machine** (`meeting_state_machine.py`):
  `not_joined → joining → ongoing ⇄ interrupted → completed | failed`.
- **Rejoin orchestrator** (`rejoin_orchestrator.py`) — classifies exit
  reasons as terminal vs recoverable; bounded by
  `MAX_SESSIONS_PER_MEETING` and `MAX_REJOIN_WINDOW_S`.
- **Sessions repo** (`sessions_repo.py`).
- **Bot heartbeat + SIGTERM handler** in `joinMeeting.js`. Heartbeat
  file mtime is the warm-pool reaper's stuck-bot signal.
- **Transcript segments tagged with `session_number` + `wall_clock_ts`**
  in `dbIntegration.js` — wall-clock is the canonical ordering key so
  rejoin produces a contiguous timeline. Same `meeting_joiner.id` across
  sessions means all segments append to the same transcript JSON; a
  single `SELECT transcript FROM meeting_joiner WHERE id = M` returns
  the cumulative transcript across every rejoin.
- **Sidecar → API callback** at `/internal/sessions/ended` — bot exit
  triggers the rejoin orchestrator (Paths A/B/C).
- **Warm-pool reaper triggers rejoin for stuck pods** — when the reaper
  detects `meeting_state=stuck` (bot heartbeat stale > 90s), it pulls
  the `meeting-id` label off the pod and fires `RejoinOrchestrator`
  with `exit_reason=stuck_no_heartbeat` BEFORE deleting the pod
  (Path D — bot hung without cleanly exiting).
- **Ghost-pod reaper** (`ghost_pod_reaper.py`) — every 30s, scans
  `meeting_joiner` rows in `ongoing`/`joining`/`interrupted` with
  `pod_name IS NOT NULL` and checks if k8s still knows about the pod.
  If the pod is gone (404, or Failed/Succeeded phase), fires
  `RejoinOrchestrator` with `exit_reason=pod_evicted` (Path E — node
  failure, force-evict, kernel OOM before soft monitor tripped).
- **`meeting_cleanup_service.py` rewritten as safety-net** — warm-pool
  reaper + ghost-pod reaper are primary; cleanup is defence in depth.

#### Drop detection coverage

| Failure mode | Signal | Trigger |
|---|---|---|
| Bot exits with a known reason | `Promise.race` in `joinMeeting.js` resolves | sidecar → `/internal/sessions/ended` |
| Bot subprocess crashes | non-zero exit code | sidecar → callback w/ `subprocess_crash` |
| Pod SIGTERMed (k8s drain) | `SIGTERM` handler in `joinMeeting.js` | sidecar → callback w/ `sigterm_during_active` |
| Bot hangs (no exit) | `/tmp/bot.heartbeat` mtime stale > 90s | warm-pool reaper → rejoin w/ `stuck_no_heartbeat` |
| Pod gone entirely | k8s `read_namespaced_pod` 404 | ghost-pod reaper → rejoin w/ `pod_evicted` |

### Phase 4 — Production hardening

Ship-blocker fixes for known failure modes. Built on top of Phases 1-3.

- **Memory soft monitor** (`sidecar/memory_monitor.py`) — psutil RSS
  poll; graceful abort with `exit_reason=memory_pressure` before the
  kernel OOM kill. Surface via `pod_oom_kills_total` metric.
- **Disk hygiene** (`sidecar/disk_hygiene.py`) — `/abort` flushes
  pending audio/transcript files to Azure Blob, then deletes locally.
  Bounded `du -sh /tmp/meetings/` at pod terminate.
- **Selector canary** (`selector_canary_service.py`) — periodic
  synthetic meetings on each platform; consecutive failures raise
  high-priority alerts. Catches Teams/Meet DOM-selector breakage before
  customers see it.
- **Platform circuit breaker** (`platform_circuit_breaker.py`) —
  per-platform 15-min rolling window; opens at <80% join success;
  returns 503 + `Retry-After`; auto-resets on canary success.
- **Chaos script** (`scripts/chaos/kill_random_workers.sh`) — kill a
  random subset of claimed pods to validate the rejoin path. Game-day
  README with what to watch in Grafana.
- **Load test** (`tests/load/test_concurrent_meetings.py`) — Locust,
  `@pytest.mark.load`, gated so it doesn't slow down CI.

## 4. Schema Migrations (in order)

Under `core/core/db/prisma/migrations/`:

| Order | Migration | Phase | Purpose |
|---|---|---|---|
| 1 | `20260601000000_meeting_joiner_pod_per_meeting` | 2 | Drop `process_id`; add `pod_name`, `cluster_name`, `last_heartbeat_at`. |
| 2 | `20260615000000_meeting_sessions` | 3 | New `meeting_sessions` table; add `session_number` + `wall_clock_ts` to transcript JSON. |

Two migrations total. Both forward-only. Standalone vendored deployments
get the same shape via `meeting-joiner/db/bootstrap.sql`.

## 5. K8s Manifest Inventory

All new under `infra/aiops-chart/templates/meeting-joiner/`:

| File | Purpose |
|---|---|
| `configmap.yaml` | warm-pool sizes, deadlines, image refs, log level |
| `priorityclasses.yaml` | `meeting-worker-claimed` (high), `meeting-worker-warm` (low) |
| `serviceaccount.yaml` | `meeting-joiner-api-sa`, `meeting-worker-sa` (no token mount) |
| `role.yaml` + `rolebinding.yaml` | API SA → pod CRUD on `app=meeting-worker` |
| `networkpolicy.yaml` | egress: Teams/Meet/Zoom CIDRs + Azure Blob + DNS |
| `validatingadmissionpolicy.yaml` | only in-cluster SA can create worker pods |
| `api-deployment.yaml` + `api-service.yaml` + `api-hpa.yaml` + `api-pdb.yaml` | API surface |
| `ingress.yaml` | cert-manager + nginx-ingress (parameterized hostname) |
| `prepulled-image-daemonset.yaml` | pull `meeting-worker` image on every node |
| `secret-external.yaml` | optional ExternalSecrets Operator wiring |
| `servicemonitor.yaml` | optional Prom scrape (off by default) |

Old `infra/specs/meetingjoiner.yml` retains the legacy Deployment shape
with probes added — will be deleted once warm pool is proven on the
first pilot customer.

## 6. Per-Customer Rollout

Per-customer AKS clusters live under `infra/aks-terraform-*/`. Order:

1. `staging` — full bake of all phases.
2. `dev`.
3. Pilot customer (smallest blast radius).
4. Mid-tier customers.
5. Largest customers.

Per-customer Helm values overrides at
`infra/aks-terraform-<customer>/meeting-joiner-values.yaml` (warm pool
size, image tags, ingress hostname, optional ExternalSecret refs).

## 7. Out of Scope (explicit non-goals)

These are intentionally not in this plan. Don't propose them without
explicit user buy-in:

1. Webhooks (HMAC signing, delivery service, retry queues).
2. Calendar integration (Google / Outlook OAuth, schedule polling).
3. Streaming transcript APIs (SSE / WebSocket).
4. Replay URL generators (signed Azure Blob SAS).
5. Recall.ai API surface compatibility (`/api/v1/bot/*` aliases).
6. Per-org policy tables (`org_meeting_policies` and friends).
7. Microsoft Teams Bot Framework pivot (separately rejected).
8. Bot TTS / live translation / mobile SDKs.
9. Webex / BlueJeans / other non-{Teams,Meet,Zoom} platforms.
10. On-premises non-K8s deployment.
