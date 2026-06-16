# PR #3592 — Local-test RCA

PR: `feat/meeting-joiner-recall-replacement` (Recall.ai-grade meeting bot
replacement, final scope = pod-per-meeting + sessions + rejoin + Phase 4
hardening).

This RCA covers **two test sessions** against the PR:
1. **2026-05-28** — happy-path bot join against a Google Meet via the
   PGQueuer cold-start path. Captioned 7 segments, exit reason
   `left_alone_timeout`. Surfaced 10 findings.
2. **2026-05-29** — attempted to test the rejoin orchestration feature
   against a Microsoft Teams meeting. **Concluded we did NOT actually
   test rejoin end-to-end** — the test setup couldn't get there. See the
   honest summary in section D below. Surfaced 5 additional findings
   (4 hard PR bugs + 1 design gap).

## What we actually validated

**Yes, validated:**
- Schema migration applies cleanly via `bootstrap.sql`.
- Bot joins Google Meet and Microsoft Teams (latter via Playwright DOM
  scraping per the Phase 5 revert).
- Captions persist tagged with `session_number=1` + ISO `wall_clock_ts`
  (the new PR field on every segment).
- Multi-speaker Teams meeting → all 44 segments correctly attributed.
- Bot self-exits cleanly via `left_alone_timeout` after a graceful
  meeting end.
- Existing PGQueuer cold-start path continues to function.

**Not validated (k8s-only):**
- Warm pool claim / dispatch.
- Sidecar `/configure` /`/abort` callback.
- A bot actually getting evicted and a *new* bot subprocess launching.
- Transcript continuity across a rejoin gap (segments tagged
  `session_number=2` from the second bot).
- Ghost-pod reaper firing on pod deletion.
- Stuck-bot detection by the warm-pool reaper.

The day-2 test attempted to exercise the orchestrator's code path via a
manual `RejoinOrchestrator.attempt()` call in a Python REPL. This
exercised the orchestrator's bookkeeping (classification, state machine
writes, dispatcher invocation) but **none of the production rejoin
behavior** — see section D.

Below: what each fix actually did and *why* the underlying issue exists.

---

## How the stack was actually brought up

1. `colima start --vz-rosetta` — host runtime (the meeting-joiner image is
   wolfi/ubuntu amd64-only; needs Rosetta on Apple Silicon).
2. `docker run postgres:16-alpine` on host port 5433.
3. `psql -f meeting-joiner/db/bootstrap.sql` — idempotent, includes both
   PR migrations inline.
4. `python3 -m pgqueuer install` against the worker, then SQL
   `ALTER TABLE … SET SCHEMA pgqueuer` to move the tables (see fix #4).
5. `meeting-joiner/.env` written with caption-mode + dummy
   `OPENAI_API_KEY` (`sk-…`) + Azurite well-known
   `AZURE_STORAGE_CONNECTION_STRING` + `MEETING_JOINER_USE_WARM_POOL=false`
   + `RUNTIME_MODE=compose`.
6. `meeting-joiner/docker-compose.override.yml` written to fix the api
   service command, bind-mount the live source and .env, attach
   `meeting-joiner-pg` to the compose network.
7. `meeting-joiner-api:withotel` overlay image built (see fix #3).
8. `curl POST /meetings` with the Meet URL. Bot joined; captions flowed.

---

## Findings, grouped by where the fix belongs

### A. Local-environment friction — fix is in the test setup, not the PR

#### 1. `ALLOWED_HOSTS=*` failed pydantic v2 env parsing

**Symptom:** `pydantic_settings.exceptions.SettingsError: error parsing
value for field "ALLOWED_HOSTS" from source "EnvSettingsSource"` → API
crashloop at boot.

**Root cause:** `shared/config.py:59` declares
`ALLOWED_HOSTS: List[str]`. pydantic-settings v2 tries to JSON-decode
list fields from env *before* validators run, and `*` is not valid JSON.
The `parse_allowed_hosts` validator that handles the comma-separated
case (`shared/config.py:75-79`) never gets reached.

**Fix applied:** `.env` uses JSON form `ALLOWED_HOSTS=["*"]`.

**Suggested upstream fix:** add `noqa`-style comment to `.env.example`
documenting the JSON requirement, OR define the field as
`Union[List[str], str]` so the pre-validator gets called for raw strings.
Lowest-risk: update `.env.example` to use the JSON form so newcomers
copy-paste a working value.

#### 2. `compose env_file:` only re-reads `.env` on container creation

**Symptom:** Edited `.env` → `docker compose restart` → container env
still showed the old values. Looked like the bind-mount wasn't
working; turned out compose's `env_file:` is evaluated at *create* time.

**Root cause:** docker-compose semantics — `env_file:` injects env vars
when the container is created. `restart` reuses the same container
spec.

**Fix applied:** `docker compose up -d --force-recreate <svc>` after
every `.env` edit.

**Not a PR issue.** Worth noting in `meeting-joiner/docs/STANDALONE.md`
if standalone consumers will iterate on env locally.

#### 3. Source bind-mount was `:ro`, but bot writes per-meeting artefacts

**Symptom:** `ENOENT: no such file or directory, mkdir
'/app/meeting-joiner/src/processors/meeting_data/<ts>'`.

**Root cause:** the upstream `meeting-joiner/docker-compose.yml`
bind-mounts `./src:/app/src:ro` (read-only). The bot writes
screenshots, per-meeting state, and the `meeting_data/<ts>/` directory
during a join.

**Fix applied:** override drops `:ro` from the worker's `src` and
`workers` mounts.

**Suggested upstream fix:** either move runtime artefacts to a writable
location outside `src/` (e.g. `/tmp/meeting-joiner-data/<ts>/`), or
declare the volume rw in `docker-compose.yml`. The current behavior
means the upstream compose file is broken for `docker compose up`
out of the box.

---

### B. Build / packaging — fix is in the Dockerfile

#### 4. OTel deps missing from the built image

**Symptom:** API and worker crashloop at import time:
`ModuleNotFoundError: No module named 'opentelemetry'` →
`opentelemetry.instrumentation.httpx` → etc.

**Root cause:** `infra/docker/meeting_worker.Dockerfile:82` does
`poetry install … || pip3 install --no-cache-dir <allowlist>`. The
poetry install failed in our build (likely a resolver issue under
Python 3.10 / amd64 wolfi base), and the pip allowlist is hard-coded
to:

```
fastapi uvicorn asyncpg pgqueuer==0.25.1 pydantic pydantic-settings
pyjwt openai python-dotenv structlog prisma aiofiles psutil
httpx python-multipart docker
```

This allowlist predates PR #3592. The PR added the following to
`pyproject.toml` (we observed):

```
opentelemetry-api
opentelemetry-sdk
opentelemetry-exporter-otlp / -proto-grpc
opentelemetry-instrumentation-fastapi
opentelemetry-instrumentation-asyncpg
opentelemetry-instrumentation-httpx
opentelemetry-instrumentation-logging
kubernetes-asyncio   # for warm pool
```

…but did not update the pip fallback. So *every build where poetry
install fails silently* ships an image that crashloops at module
load because the new observability/__init__.py chain imports OTel
unconditionally.

**This is a real PR-side gap.** OTel imports are unconditional even
though OTel is supposed to be opt-in via `OTEL_ENABLED=false`. The
boot logic in `src/main.py:140` does `try / except` around
`configure_otel(...)`, but the module-level imports in
`src/observability/__init__.py` line 7-9 run *before* that try
block — so the env flag never gets a chance to short-circuit them.

**Fix applied locally:** built a thin overlay image
`meeting-joiner-api:withotel` doing `pip install` of the OTel
packages on top of the upstream image, pointed compose at it.

**Suggested upstream fixes (pick one):**
- Add OTel + `kubernetes-asyncio` to the pip fallback allowlist in
  the Dockerfile (lowest blast radius — keeps the no-OTel boot
  guarantee but at least the image builds).
- Make `src/observability/__init__.py` import OTel lazily (only
  inside `configure_otel`). Honors the spirit of `OTEL_ENABLED=false`
  and avoids gating production boot on an unrelated dep.
- Fix the underlying poetry install failure so the fallback is never
  used in CI/CD images.

#### 5. PGQueuer tables installed to `public`, but code expects schema `pgqueuer`

**Symptom:** worker boots with
`RuntimeError: The required table 'pgqueuer' is missing.`

**Root cause:** `python3 -m pgqueuer install` (v0.25.1) hard-codes
SQL like `CREATE TABLE public.pgqueuer (…)`. Meanwhile
`src/services/pgqueuer_queue_service.py:53` does
`SET search_path TO pgqueuer`. There's no `pgq install --schema=…`
option in the version pinned in the fallback.

**Fix applied:** `ALTER TABLE public.pgqueuer SET SCHEMA pgqueuer`
(plus the log / schedules / statistics tables and the
`pgqueuer_status` enum + `fn_pgqueuer_changed` function).

**Not a PR-#3592 issue** — pre-existing inconsistency between the
queue init path and the consumer. Worth flagging in a separate
ticket; not blocking for the test.

#### 6. `RECORDING_UPLOAD_DISABLED=true` doesn't gate Azure SDK init

**Symptom:** Node processor exits at module load with
`Error: Azure connection string is required for OpenAI provider`
even though `RECORDING_UPLOAD_DISABLED=true`.

**Root cause:** `src/storage/azureStorage.js:22` validates the
connection string in the constructor, which is invoked at the top
of `meetingProcessor.js:11`. The `RECORDING_UPLOAD_DISABLED` check
lives downstream at `meetingProcessor.js:119`, after the constructor
has already thrown.

**Fix applied:** set `AZURE_STORAGE_CONNECTION_STRING` to the
Azurite well-known dev string. Init succeeds; the upload code path
short-circuits later via `RECORDING_UPLOAD_DISABLED=true` so no real
Blob call is ever made.

**Suggested upstream fix:** check `RECORDING_UPLOAD_DISABLED` in the
`uploadToAzure` constructor before validating creds. Otherwise the
flag is misleading — you can't actually run without a connection
string.

---

### C. Real PR-#3592 bugs surfaced during boot/runtime

These all reproduce on a clean stack. None blocked the join test
because each is in a non-critical loop, but they should be fixed
before merge.

#### 7. `meeting_cleanup_service._perform_cleanup`: wrong execute_query signature

**Symptom:** every 60min:
```
cleanup.loop_error error='DatabaseConnection.execute_query() takes
2 positional arguments but 4 were given'
```

**Root cause:** `src/services/meeting_cleanup_service.py:111-130` (the
rewritten safety-net cleanup added in this PR) calls:

```python
silent_meetings = await db.execute_query(
    "<SQL with $1 and $2>", max_age_cutoff, silence_cutoff,
)
```

but `DatabaseConnection.execute_query` is declared as
`execute_query(self, query: str)` — no `*params`. The legacy code
either inlined values or used the underlying asyncpg pool directly;
this PR's new code assumes asyncpg-style parameter binding that the
wrapper doesn't expose.

**Effect:** the hourly safety-net cleanup loop logs an error and
loops forever; *no meetings ever get force-completed by this
service*. In k8s mode the warm-pool reaper covers it, but in compose
mode (or any deployment without warm pool) this is the *only*
cleanup path — and it's silently broken.

**Suggested fix:**
- Extend `DatabaseConnection.execute_query` to accept `*params`
  (forward to `asyncpg.Connection.fetch(query, *args)`), OR
- Use `db.store.list_meetings(where=...)` / similar typed APIs that
  already exist for parameterised queries.

#### 8. `ghost_pod_reaper`: same wrong signature, different arity

**Symptom:** every 30s:
```
ghost_pod_reaper.candidate_query_failed error='DatabaseConnection.execute_query()
takes 2 positional arguments but 3 were given'
```

**Root cause:** same as #7 — `src/services/ghost_pod_reaper.py`
calls `db.execute_query(sql, $cutoff)` with one positional param.

**Effect:** the ghost-pod reaper never finds any candidate rows; the
30s loop is a pure-warning generator. On k8s, this is the *only*
detector for the "pod gone entirely (force-evict / OOM-killed
before soft monitor tripped)" failure mode that commit #4 of the PR
was added to close. So that failure mode is currently *undetected*
in production.

**Suggested fix:** same as #7.

#### 9. `current_session_number` column missing from bootstrap.sql

**Symptom:** `ERROR: column "current_session_number" does not exist`
when reading the meeting row.

**Root cause:** the Prisma migration
`core/core/db/prisma/migrations/20260615000000_meeting_sessions/migration.sql`
adds:

```sql
ALTER TABLE "meeting_joiner"
  ADD COLUMN IF NOT EXISTS "current_session_number" INTEGER NOT NULL DEFAULT 1;
```

…but `meeting-joiner/db/bootstrap.sql` (the standalone path) does
*not* include this. Schemas now drift between the two paths.

**Effect:** any standalone deployment running `bootstrap.sql` is
missing the column. Any read query that selects
`current_session_number` errors out. The Prisma `schema.prisma` also
doesn't list it on the `meeting_joiner` model (the model has a
`sessions meeting_sessions[]` relation but no scalar `current_session_number`).

**Suggested fix:** decide whether `current_session_number` is part
of the design at all (the relation already lets you compute
`max(session_number)` cheaply), then either:
- add it to both `schema.prisma` and `bootstrap.sql`, or
- drop it from the Prisma migration.

The PR's own `meeting-joiner/db/extract-bootstrap.mjs` CI guard
(see `STANDALONE.md`) is meant to catch exactly this drift; either
it didn't run on the PR or it doesn't currently compare migration
↔ bootstrap (only schema.prisma ↔ bootstrap).

#### 10. `meeting_sessions` row never inserted on PGQueuer fallback path

**Symptom:** `SELECT * FROM meeting_sessions WHERE meeting_joiner_id = …`
returns zero rows even though the meeting joined and produced
transcript segments tagged with `session_number=1`.

**Root cause:** the row-insertion call lives in the warm-pool
dispatcher (`src/services/warm_pool_dispatcher.py`) and the rejoin
orchestrator. The PGQueuer cold-start path
(`src/api/routes` → `pgqueuer_queue_service` → bridge → bot) never
touches `sessions_repo`. The bot tags segments with
`session_number=1` regardless (env-driven default at
`joinMeeting.js`), but no row exists to attach those segments to.

**Effect:** in any deployment without warm pool (compose mode,
single-cluster customers), `meeting_sessions` is permanently
empty. The "transcript continuity across rejoins" promise still
holds (because rejoins also only happen on the warm-pool path), but
the audit-trail value of the table is zero in non-k8s mode.

**Suggested fix:** either:
- Have `MeetingService.create_meeting` insert a `session_number=1`
  row unconditionally, and let the warm-pool dispatcher just update
  the `pod_name` after claim. Then both paths have the same audit
  trail.
- Or scope `meeting_sessions` documentation explicitly to
  "warm-pool deployments only" in
  `docs/production-hardening-plan.md`.

---

## Summary of action items for the PR

| # | Bug | Severity | File |
|---|---|---|---|
| 7 | `cleanup_service` execute_query signature | **high** — silently disables safety-net cleanup in non-k8s deployments | `src/services/meeting_cleanup_service.py` |
| 8 | `ghost_pod_reaper` execute_query signature | **high** — silently disables ghost-pod detection (commit 4's whole purpose) | `src/services/ghost_pod_reaper.py` |
| 4 | OTel deps not in pip fallback allowlist | **medium** — image crashloops if poetry install ever fails | `infra/docker/meeting_worker.Dockerfile` |
| 9 | `current_session_number` schema drift | **medium** — standalone DBs missing the column | `meeting-joiner/db/bootstrap.sql` |
| 10 | `meeting_sessions` empty on legacy path | **low** — audit-trail-only; main functionality unaffected | `src/services/meeting_service.py` |
| 3 | `:ro` bind in upstream compose | **low** — affects local-dev only | `meeting-joiner/docker-compose.yml` |
| 6 | Azure SDK init ignores `RECORDING_UPLOAD_DISABLED` | **low** — pre-existing, not PR-introduced | `src/storage/azureStorage.js` |

The high-severity items (#7, #8) both stem from the same shape — the
new PR services use a parameterised-query idiom that the existing
`DatabaseConnection` wrapper doesn't support. They're caught by the
first run; an integration test that simply *boots the worker and
waits 60s* would have flagged them.

## What the test did *not* cover

By design — single laptop, no k8s:
- Warm-pool pod claim / dispatch / sidecar bridge.
- Rejoin orchestrator (would need a recoverable drop mid-meeting).
- Ghost-pod reaper (would need a pod eviction).
- Selector canary, platform circuit breaker.
- The 30s-tick warning loops from #7/#8 mask whether the queries
  themselves are correct; need to fix the signature first, then
  validate the SQL against a real DB.

These need an actual k8s test cluster — either a kind/k3d setup or
a non-production AKS cluster — before this PR is shipped.

---

## Day-2 session (2026-05-29) — rejoin attempt

### D. What we tried + what we actually learned

**Goal:** stand up k3d, deploy the Helm chart, join a live Teams meeting,
`kubectl delete pod <worker>` mid-meeting, and observe the
ghost-pod-reaper + rejoin-orchestrator + warm-pool-dispatcher pipeline
fire end to end. This was meant to be the rejoin feature's first real
test.

**Outcome — honest version: rejoin was NOT actually tested.** We got as
far as exercising the orchestrator's *decision and DB-write bookkeeping*
via a manual REPL call. None of the actual rejoin behaviour ran:

| Step in real rejoin path | Tested? |
|---|---|
| Pod gets deleted/evicted | ❌ — we didn't touch the bot |
| Detector fires on its own | ❌ — we called `attempt()` directly |
| Exit reason classified | ✅ |
| State machine transitions written | ✅ (after patching #12, #13, #14) |
| Warm pool claims a new pod | ❌ — no warm pool exists in compose |
| New bot subprocess launches | ❌ |
| New bot re-admitted to same Teams URL | ❌ |
| `meeting_sessions` row inserted for session 2 | ❌ |
| Segments tagged with `session_number=2` | ❌ |
| Transcript stitches across the gap | ❌ |

The actual bot subprocess kept running in the worker container the
whole time, completely unaware that the orchestrator had marked the
meeting `failed`. The "rejoin" reduced to "writing a few rows in a
table". That is **not** what PR #3592 is for.

### Why k3d didn't happen

On Apple Silicon with Rosetta, k3d's underlying k3s containerd ran as
arm64, while every meeting-joiner image is amd64-only (the Dockerfiles
pin `FROM --platform=linux/amd64` because the production base is
wolfi-amd64). Result: `k3d image import` succeeded but the images
landed as 856-byte stub manifests with no matching layer
(`no match for platform in manifest`).

Workarounds that would have worked but ran out the clock:
1. Rebuild the worker image as arm64 (drop the platform pin, re-resolve
   `pgqueuer`/`kubernetes-asyncio`/OTel wheels for arm64).
2. Force the k3d node container to amd64 via `--platform linux/amd64`,
   which makes k3s + all pods run under Rosetta. Tried via
   `DOCKER_DEFAULT_PLATFORM=linux/amd64`, didn't take — k3d 5.8.3 honors
   its own image arch, not the env.
3. Use a real cloud k8s cluster (kind on Linux, EKS/AKS, etc.).

### E. New PR bugs surfaced (the orchestrator's data-access layer is wholly broken)

When we tried to fire `RejoinOrchestrator.attempt()` manually, the
orchestrator hit **four hard errors in succession**, each blocking it
from making any progress, each in code added by this PR.

#### 11. `DatabaseConnection.execute_query` doesn't accept `*params`

Same bug as yesterday's #7 and #8 — but **the real fix is on the
wrapper, not the callers**.

`src/api/database/connection.py:92` (before):
```python
async def execute_query(self, query: str) -> Any:
    return await self.store.query_raw(query)
```

But the underlying `store.query_raw` already accepts `*params: Any`
(both `pg_store.py:371` and `prisma_store.py:273`). The wrapper just
wasn't forwarding them.

**Fix (applied):** add `*params` and forward:
```python
async def execute_query(self, query: str, *params: Any) -> Any:
    return await self.store.query_raw(query, *params)
```

Yesterday's RCA mis-attributed the bug to each caller — actually a
one-line wrapper fix covers `meeting_cleanup_service`, `ghost_pod_reaper`,
and `sessions_repo` all at once.

#### 12. `_STATUS_TO_DB` mapping missing 3 of the 6 new enum values

`src/api/database/connection.py:29-33` (before):
```python
_STATUS_TO_DB = {
    MeetingStatus.NOT_JOINED: "not_joined",
    MeetingStatus.ONGOING:    "ongoing",
    MeetingStatus.COMPLETED:  "completed",
}
```

Missing: `JOINING`, `INTERRUPTED`, `FAILED`. These are the **three new
states the PR's whole rejoin design depends on**. The state machine
defines transitions through them, the orchestrator writes them, the API
publishes them — but the wrapper that persists status to Postgres
KeyErrors on every one of them.

**Symptom:**
```
DatabaseError: Meeting update failed:
  <MeetingStatus.INTERRUPTED: 'interrupted'>
```

The wrapper's `update_meeting_status` looks up the enum in
`_STATUS_TO_DB[status]` and explodes with a bare `KeyError` (also
unhelpfully formatted — see #15).

**Fix (applied):** add all six entries to the mapping.

**Severity:** *show-stopper for the rejoin feature*. Without this, no
meeting can ever move into `interrupted`, `joining`, or `failed`. The
PR's whole purpose is non-functional.

#### 13. `STATUSES` allowlist in the pg-driver status validator: same omission

`src/db/python/status_enum.py:13` (before):
```python
STATUSES: Final[tuple[str, ...]] = ("not_joined", "ongoing", "completed")
```

Even after fixing #12, the pg-driver path validates the string at write
time via `assertStatus()` and rejects the new values.

**Symptom:**
```
ValueError: invalid meeting_joiner status: 'interrupted';
  expected one of not_joined, ongoing, completed
```

**Fix (applied):** add `joining`, `interrupted`, `failed` to the tuple.

The PR added the enum values to:
- Prisma `schema.prisma` ✓
- Migration `20260615000000_meeting_sessions/migration.sql` ✓
- `meeting-joiner/db/bootstrap.sql` ✓
- `MeetingStatus` Python enum at `schemas.py` ✓
- `meeting_state_machine.py` transitions ✓
- BUT NOT: `src/db/python/status_enum.py` validator
- AND NOT: `src/db/js/statusEnum.js` validator (parallel JS bug)

The validator was the seam between Prisma's type-system enforcement
(removed in the pg-driver split) and raw-SQL writes. The PR clearly
saw the rest of the surface but missed this validator on both sides.

#### 14. `STATUSES` allowlist in the JS status validator: same omission

`src/db/js/statusEnum.js:9` (before):
```js
const STATUSES = Object.freeze(['not_joined', 'ongoing', 'completed']);
```

**Fix (applied):** add the three new values.

JS-side path is less critical (the bot doesn't write status directly —
it writes participants and transcript) but the inconsistency is a
defect waiting to bite the next contributor who reaches for it.

#### 15. `DatabaseConnection.execute_one()` doesn't exist — but is called 3×

`sessions_repo.py` (PR-new file) calls `db.execute_one(...)` at lines
74, 178, 213. The method **does not exist** on the wrapper.

**Symptom:**
```
AttributeError: 'DatabaseConnection' object has no attribute 'execute_one'.
  Did you mean: 'execute_query'?
```

**Fix (applied):** add a thin `execute_one()` to the wrapper:
```python
async def execute_one(self, query: str, *params: Any) -> Optional[dict]:
    rows = await self.execute_query(query, *params)
    return rows[0] if rows else None
```

**Severity:** *show-stopper for the rejoin feature*. The orchestrator's
`evaluate()` → `count_sessions()` is the first thing it calls, and it
hits this method immediately. Rejoin can't even decide whether to
attempt without `execute_one` being callable.

#### 16. Unhelpful error formatting in `update_meeting_status`

Surfaced while diagnosing #12. The `KeyError` in `_STATUS_TO_DB[status]`
is caught and re-raised as
`DatabaseError(f"Meeting update failed: {e}")` — but the KeyError's
`str()` is just `"<MeetingStatus.INTERRUPTED: 'interrupted'>"` with no
context. A reader sees the enum value but no indication that the
mapping is the problem.

**Suggested fix:** catch `KeyError` specifically and rewrap with a
message like `f"unmapped status enum {status!r}; check _STATUS_TO_DB"`.
Low-severity polish.

### Why none of this was caught before now

These five bugs (#11-#15) are all in **the data layer between the
orchestrator and Postgres**. They share one shape: PR-new code calls
DB methods that the existing `DatabaseConnection` wrapper either
doesn't expose, or exposes with a stale signature, or with a
stale-enum mapping.

The PR ships:
- The Prisma schema migration with the new enum values ✓
- The Python `MeetingStatus` enum extended ✓
- A new `meeting_state_machine.py` that uses all six states ✓
- A new `sessions_repo.py` with five DB methods ✓
- A new `RejoinOrchestrator` that orchestrates the state transitions ✓

But the wrapper in the middle (`api/database/connection.py`) and the
two status validators (`src/db/python/status_enum.py` +
`src/db/js/statusEnum.js`) were not touched. There's no integration
test in the PR that exercises the orchestrator end-to-end — if there
were, it would fail on the first line of the first method call.

The day-1 RCA item #7 and #8 are now retroactively explained: they
weren't "the callers used the wrong signature" — they were
"the wrapper never supported `*params` and nobody noticed because the
existing callers built SQL strings with f-string interpolation, which
the PR's new callers correctly avoided in favour of bind parameters."
Yesterday's framing was wrong; today's wrapper fix is the right one.

### Updated severity summary (day 1 + day 2)

| # | Bug | Severity | File |
|---|---|---|---|
| 12 | `_STATUS_TO_DB` missing 3 of 6 enum values | **critical** — rejoin literally cannot persist any state | `src/api/database/connection.py:29-33` |
| 13 | `STATUSES` allowlist missing 3 values (py) | **critical** — pg-driver writes rejected | `src/db/python/status_enum.py:13` |
| 15 | `execute_one` method absent | **critical** — orchestrator can't even evaluate | `src/api/database/connection.py` |
| 11 | `execute_query` doesn't accept `*params` | **critical** — ghost_pod_reaper + cleanup + sessions_repo broken | `src/api/database/connection.py:92` |
| 14 | `STATUSES` allowlist missing 3 values (js) | high | `src/db/js/statusEnum.js:9` |
| 9 | `current_session_number` schema drift | medium | `meeting-joiner/db/bootstrap.sql` |
| 4 | OTel deps not in pip fallback allowlist | medium | `infra/docker/meeting_worker.Dockerfile` |
| 10 | `meeting_sessions` empty on legacy path | low (audit-trail) | `src/services/meeting_service.py` |
| 16 | `KeyError` re-raise loses context | low | `src/api/database/connection.py:198-204` |
| 7/8 | (rewritten — see #11) | — | see #11 |

The four `critical` items collectively mean **the rejoin feature is
non-functional out of the box**. Any production deployment of this PR
that tries to recover a bot would fail at the first DB write attempt
inside `RejoinOrchestrator.attempt()`. The reason this wasn't caught in
PR review is that the PR has no test that boots the orchestrator
against a real DB.

### Working-tree patches left for the PR author

The following local edits remain in the working tree as candidate fixes
(not committed):

| File | Lines | What it fixes |
|---|---|---|
| `src/api/database/connection.py` | 29-37 | adds 3 missing `_STATUS_TO_DB` entries (#12) |
| `src/api/database/connection.py` | 92-99 | adds `*params` to `execute_query` (#11) |
| `src/api/database/connection.py` | 101-107 | adds `execute_one()` method (#15) |
| `src/db/python/status_enum.py` | 13-15 | adds 3 missing `STATUSES` values (#13) |
| `src/db/js/statusEnum.js` | 9 | same for JS (#14) |
| `infra/aiops-chart/templates/meeting-joiner/api-deployment.yaml` | 58-62 | adds `command:` to launch uvicorn — *test artifact only*, not a real fix; the right fix is making the api Dockerfile build |

The first five are real bug fixes ready to be cherry-picked. The
api-deployment one is incidental to a workaround for not having a
working api Dockerfile build during the test; the proper fix is to
debug why `prisma generate` fails in the api image build.

### What still needs to happen for "tested" to mean tested

1. Fix the api Dockerfile so it builds without falling through to the
   pip allowlist (so OTel + kubernetes-asyncio are baked in, and the
   prisma generate step succeeds).
2. Get k3d running with amd64 nodes via Rosetta (or rebuild images
   as arm64).
3. Apply the chart, verify the warm pool provisions N standby pods.
4. Submit a meeting and confirm the bot pod is claimed from the warm
   pool (not via PGQueuer fallback).
5. `kubectl delete pod <claimed-worker>` mid-meeting.
6. Confirm ghost_pod_reaper or stuck-detection fires the orchestrator
   *on its own* — no manual REPL call.
7. Confirm a new pod is claimed, sidecar configures, bot relaunches.
8. Confirm `meeting_sessions` has rows for both sessions.
9. Confirm new transcript segments tag with `session_number=2`.
10. Confirm the API consumer sees `interrupted → joining → ongoing`
    transitions.

Until step 10 happens, the headline "Recall.ai-grade rejoin" claim of
PR #3592 is *aspirational*. The code is wired but never end-to-end
tested.

---

## Day-3 session (2026-05-29 later) — k3d attempt, deeper chart findings

After the day-2 honest-admission that rejoin wasn't tested, attempted a
real k3d setup. Bypassed the amd64-under-Rosetta seccomp issue (runc
amd64 binary can't call seccomp() syscall on arm64 kernel) by switching
to native arm64 k3d. That worked, but exposed four more findings before
we even got to applying the chart.

### F. Day-3 findings (#17-20)

#### 17. Helm configmap uses kebab-case keys, code reads UPPER_SNAKE_CASE env vars

`infra/aiops-chart/templates/meeting-joiner/configmap.yaml` defines:
```yaml
data:
  warm-pool-size: "5"
  active-deadline-seconds: "32400"
  enabled-platforms: "..."
  ...
```

Consumed via `envFrom: configMapRef` on the API Deployment. envFrom
creates env vars whose names are the literal configmap keys — so the
API gets env vars named `warm-pool-size`, `active-deadline-seconds`,
etc. But the code reads:
```python
WARM_POOL_SIZE = int(os.environ.get("WARM_POOL_SIZE", "5"))
ACTIVE_DEADLINE_SECONDS = int(os.environ.get("ACTIVE_DEADLINE_SECONDS", "32400"))
```

The keys don't match. The configmap injects irrelevant env vars; the
code falls back to defaults for everything. Every chart value override
silently has zero effect.

**Severity: critical** for any chart-deployed configuration. The chart
is non-functional for tuning.

**Evidence the chart was never deployed and tested:** if it had been,
this would have been caught the first time someone set
`warmPool.size: 10` and saw the pool stay at 5.

#### 18. `warm_pool_manager` expects a `STORAGE_CREDENTIALS_SECRET` that the chart doesn't create

`src/services/warm_pool_manager.py:570-590` builds the sidecar
container's env from k8s downward API + a hardcoded reference:
```python
client.V1EnvVar(
    name="DB_HOST",
    value_from=client.V1EnvVarSource(
        secret_key_ref=client.V1SecretKeySelector(
            name=STORAGE_CREDENTIALS_SECRET,
            key="DB_HOST",
        ),
    ),
),
```

`STORAGE_CREDENTIALS_SECRET` is read from API env (default name
`"storage-credentials"`). The chart's `secret-external.yaml` template
defines an ExternalSecret resource that pulls `DATABASE_URL`,
`OPENAI_API_KEY`, `AZURE_STORAGE_CONNECTION_STRING` etc. — but **not**
`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT` keys.

So when the warm pool tries to start a sidecar pod, it'll fail to
resolve the secret references and the pod will never come up.

This is undocumented contract drift between the deployment code and
the chart. Nothing in `docs/STANDALONE.md` or
`docs/production-hardening-plan.md` mentions the secret structure
required.

**Severity: critical** for the warm-pool path. Warm pool pods can't
start without this secret existing with the right keys.

#### 19. Dockerfile pins Chrome to amd64 .deb URL with no arm64 fallback

`meeting-joiner/infra/docker/meeting_worker.Dockerfile:50-58`:
```dockerfile
RUN wget -O /tmp/google-chrome-stable_138.0.7204.168-1_amd64.deb \
      https://dl.google.com/linux/chrome/deb/pool/main/g/google-chrome-stable/google-chrome-stable_138.0.7204.168-1_amd64.deb && \
    dpkg -i /tmp/google-chrome-stable_138.0.7204.168-1_amd64.deb
```

Google Chrome has no Linux arm64 build. Dpkg refuses to install the
amd64 .deb on an arm64 system. Build dies.

The Dockerfile already installs Playwright Chromium two steps later
(line 95-97), which IS multi-arch. The Chrome install is a backup that
nothing strictly requires.

**Severity: medium.** Blocks any arm64 deployment (Apple Silicon
local-dev, AWS Graviton if a customer ever wants it). Production AKS
runs amd64 so this doesn't bite there — but it makes local-dev on
Apple Silicon impossible without patches.

#### 20. Same shape: `zoom-meeting-sdk` PyPI wheel is amd64-only

`meeting-joiner/infra/docker/meeting_worker.Dockerfile:72`:
```dockerfile
RUN pip3 install --no-cache-dir zoom-meeting-sdk
```

Has no arm64 wheel published on PyPI. Pip fails the build.

Worth noting since the PR explicitly reverted Phase 5 (Teams Bot
Framework pivot) to stay on Playwright. With Zoom-only being the
remaining native-SDK platform, an arm64 build would lose Zoom but keep
Teams + Meet. That's an acceptable tradeoff if the option to skip
Zoom is exposed.

---

## G. Strategic conclusion — bugs vs design issues

The user asked: are these bugs (fix and ship) or design issues (need
rethink before ship)?

### Pure bugs — fix and ship (15 of 20)

These are local-scope defects. Each is a small change. No
architectural rework needed.

| # | Title | LOC change |
|---|---|---|
| 1 | `ALLOWED_HOSTS` JSON form in `.env.example` | 1 line |
| 3 | `:ro` bind mount in compose | 1 line |
| 4 | OTel deps in pip fallback allowlist | ~8 lines |
| 9 | `current_session_number` in `bootstrap.sql` | 3 lines |
| 11 | `execute_query` accepts `*params` | 2 lines |
| 12 | `_STATUS_TO_DB` mapping completeness | 3 lines |
| 13 | `STATUSES` tuple (Python) | 1 line |
| 14 | `STATUSES` array (JS) | 1 line |
| 15 | `execute_one` method on wrapper | ~5 lines |
| 16 | `KeyError` rewrap with context | ~5 lines |
| 17 | Helm configmap key names | ~30 lines (rewrite configmap.yaml) |
| 19 | Chrome install conditional on arch | ~5 lines |
| 20 | Zoom SDK install conditional on arch | ~5 lines |

Total: maybe a day of mechanical work + a CI/integration test run.

### Design issues — need architectural decision (3 of 20)

These are not local fixes. Each represents an unresolved question
about how the system should actually work in production.

#### Design issue #1 — Sessions audit on the PGQueuer fallback path (#10)

The `meeting_sessions` table is the audit trail that backs the
"transcript continuity across rejoin" feature. Rows are only inserted
by:
- `warm_pool_dispatcher.dispatch_to_warm_pool` (warm-pool happy path)
- `rejoin_orchestrator.attempt()` (rejoin)

The PGQueuer cold-start fallback (`pgqueuer_queue_service` → bridge →
bot) never touches `sessions_repo`. So:
- In warm-pool-only deployments, every meeting has a session 1 row. ✓
- In any deployment where warm pool is exhausted / disabled / falls
  back, the meeting has zero session rows. The audit table is *useless*
  for those meetings.
- Worse: a meeting that started via PGQueuer fallback and then *needs
  a rejoin* would have the orchestrator allocate `session_number=1`
  (because count_sessions returns 0), overwriting nothing but
  creating a hole — the original bot session has no row in the audit
  table, and the rejoined bot's session pretends to be the first.

**Strategic question:** is PGQueuer a real production path or just a
local-dev shim?
- **If real:** the API's `create_meeting` flow must insert
  `session_number=1` unconditionally and the warm-pool dispatcher
  should just update the `pod_name` on that row after claim. Both
  paths converge on the same audit shape.
- **If not:** delete the PGQueuer fallback entirely. The chart only
  deploys the warm-pool path; remove `pgqueuer_queue_service.py` and
  the fallback logic in `src/main.py:create_meeting`.

The PR keeps both paths but only audits one. That's the design hole.

#### Design issue #2 — The Helm chart has never been deployed and tested (#17, #18)

The chart compiles (`helm template` succeeds) but it has never been
applied to a live cluster. Two pieces of evidence:

1. **Finding #17**: configmap keys don't match env var names. Anyone
   who deployed the chart and tried to override `warmPool.size` would
   have noticed immediately that the value didn't take effect. Nobody
   has done that.
2. **Finding #18**: warm-pool pods can never start because
   `STORAGE_CREDENTIALS_SECRET` isn't created and doesn't have the
   keys the code expects. Anyone who deployed the chart would have
   seen pods stuck in CreateContainerError. Nobody has.

**Strategic question:** is the chart in this PR meant to be
production-ready, or is it scaffolding for a future PR?
- **If production-ready:** it needs a full chart-install integration
  test in CI. Stand up kind/k3d, apply the chart, wait for warm-pool
  pods to be Ready, fail the build otherwise. This finds #17 and #18
  the first time the test runs.
- **If scaffolding:** the PR description should say so, the chart
  templates should be marked `WIP`, and the README should say "do not
  deploy yet."

Right now neither is true. The chart is in the PR alongside live
production code, suggesting it's meant to be deployed, but it can't
actually be deployed.

#### Design issue #3 — No integration test for the orchestrator

This is the meta-issue that explains why #11, #12, #13, #14, #15 all
shipped. They share a property: each one would be caught by a single
test that boots the orchestrator against a real Postgres and runs
`RejoinOrchestrator.attempt()`. That test does not exist in the PR.

**Strategic question:** should the PR add an integration test, or is
the rejoin feature small enough to land without one?
- **If small enough:** then someone is going to discover #11-15 in
  production. There's no recovery from a broken rejoin loop in
  production — meetings just sit in `ongoing` forever (after #12, they
  can't even transition to `interrupted`).
- **If not small:** the test setup needs to be added, and the test
  needs to run on every PR touching this code.

For a feature whose entire purpose is to handle failures, shipping
without a test of the failure-handling code is a process problem more
than a code problem. The fact that the four critical bugs all sit
behind that one untested seam is evidence of the deeper issue.

### My recommendation

**Don't rethink the design.** The architecture (warm pool + sessions +
state machine + orchestrator) is sound. Yesterday's PR analysis stands:
this is a credible Recall-replacement design.

**Fix the bugs (15 items, ~1 day of work).** Most are one-line.

**Address the three design issues with focused decisions, not a
rewrite:**
1. Pick one path for meetings (warm-pool only, or warm-pool + PGQueuer
   with shared audit-trail writes). 2-3 days of work either way. - warm-pool + PGQueuer
2. Add a chart-install integration test to CI. Catches #17, #18, and
   any future regressions. 1 day to set up. - yes
3. Add an orchestrator integration test. Catches #11-15 and any future
   data-layer drift. 1 day to set up. -yes

**Total: ~1 week of work + the bug fixes, then this PR is shippable.**

Without those three additions, the rejoin feature ships
non-functional and the next incident is going to be an oncall
nightmare: silent meeting failures with no audit trail to debug from,
no metrics that would alert (the ghost-pod reaper that powers the
detection logs warnings on a broken query loop, not errors).
