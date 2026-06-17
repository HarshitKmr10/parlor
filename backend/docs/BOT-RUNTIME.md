# Bot runtime: launching real meeting bots locally

## The three dispatch modes

Every meeting funnels through `dispatch_meeting(...)` in `src/main.py`. Which
path it takes is decided by `RUNTIME_MODE` (and, for compose, whether a worker
URL is configured):

| Mode | `RUNTIME_MODE` | Where the bot runs | How the API hands it off |
|---|---|---|---|
| **standalone** (in-process) | `standalone` (or `compose` with no worker URL) | a subprocess of the **API container** | `LocalBotRunner` forks `node …/sidecar_launcher.js` directly |
| **compose** (separate worker) | `compose` **+** `MEETING_WORKER_SIDECAR_URL` set | a **separate `meeting-worker` container** | API POSTs `SidecarConfigurePayload` to the worker's sidecar `POST /configure` over HTTP |
| **k8s** (warm pool) | anything else (e.g. `k8s`) | a **warm-pool pod** claimed per meeting | API claims a pod and POSTs the same payload to that pod's sidecar `/configure` (Helm) |

The **compose** and **k8s** modes share the exact same wire contract
(`SidecarConfigurePayload` → sidecar `/configure`); the only difference is the
target URL (a fixed compose service name vs. a claimed pod IP). That is the
point: **`make up` locally now mirrors prod** — the API and the bot run in
SEPARATE containers, and the API dispatches over HTTP rather than spawning the
bot in-process.

`local_bot_runner.py` (standalone) and `compose_worker_dispatcher.py` (compose)
are the two seams; `warm_pool_dispatcher.py` is the k8s seam. None of them
breaks the others — the branch order in `dispatch_meeting` is compose → standalone
→ k8s/warm-pool.

### `make up` (default) = compose separate-worker mode

```bash
make up           # web + backend(API) + meeting-worker(bot) + ai-service + postgres
make logs-worker  # follow ONLY the bot container — proof the bot runs separately
make up-api       # API-only, fast iteration (standalone in-process degrade)
make up-bots      # alias for `make up`
make down         # tear down the whole separated stack
```

`make up` is equivalent to:

```bash
docker compose -f docker-compose.yml -f docker-compose.worker.yml up -d --build
```

The override (`docker-compose.worker.yml`):
- flips `backend` to `RUNTIME_MODE=compose` and sets
  `MEETING_WORKER_SIDECAR_URL=http://meeting-worker:9000`;
- adds the `meeting-worker` service — the **same** heavy bot-runtime image, but
  its entrypoint (`docker/worker-sidecar-entrypoint.sh`) brings up Xvfb/pulse
  and execs the **sidecar** (`uvicorn src.sidecar.main:app --port 9000`) instead
  of the API.

---

## The bot-runtime image (shared by standalone + compose worker)

The **API-only** backend image (`backend/Dockerfile.dev`) has Python but **no
Node, no Chromium, no virtual display or audio**, so it cannot spawn a bot — the
runtime check returns `bot_runtime_unavailable_no_node` / `_no_chromium`.

The **bot-runtime image** (`backend/Dockerfile.botruntime`) fixes that. It is
used two ways:
- **standalone (`make up-api` is API-only; the legacy in-process bot path used
  this image as the `backend`)** — one container serves the API *and* forks the
  bot.
- **compose worker (`make up`)** — the same image runs as the `meeting-worker`
  container with the **sidecar** entrypoint; the bot is forked by the sidecar's
  `bot_supervisor` on `POST /configure`.

---

## Two images

| | API-only | Bot runtime |
|---|---|---|
| Dockerfile | `backend/Dockerfile.dev` | `backend/Dockerfile.botruntime` |
| Contents | Python + API deps | Python + API deps **+ Node 18 + pnpm node_modules + Playwright Chromium + Xvfb + pulseaudio + ffmpeg + local whisper cache** |
| Bots | degrade to `bot_runtime_unavailable` | **really launch** Chromium and attempt to join |
| Build | fast, small | large/slow (browser + node_modules) |
| Used as | `backend` in `make up-api` | `meeting-worker` in `make up` (sidecar entrypoint) |

```bash
make up        # separated stack: API (Dockerfile.dev) + meeting-worker (Dockerfile.botruntime, sidecar)
make up-api    # API-only fast iteration (no worker; in-process standalone degrade)
make down      # tear down the separated stack (one merged project)
```

`make up` is `docker compose -f docker-compose.yml -f docker-compose.worker.yml up -d --build`.
The override (`docker-compose.worker.yml`) flips `backend` to `RUNTIME_MODE=compose`,
sets `MEETING_WORKER_SIDECAR_URL`, and adds the `meeting-worker` service (the
bot-runtime image with the **sidecar** entrypoint). postgres / ai-service / web
are unchanged.

> The legacy `docker-compose.botruntime.yml` (which ran the bot-runtime image as
> a single `backend` container with the in-process LocalBotRunner) is retained
> for that single-container mode but is no longer the default; `make up` now uses
> the separated worker.

---

## What the bot-runtime image does

`Dockerfile.botruntime`:

1. Starts from `python:3.12-slim` and installs the **same API deps** as
   `Dockerfile.dev` (`requirements-dev.txt`), plus `faster-whisper` for the
   Python local-whisper STT path.
2. Installs **Node 18** (nodesource) + **pnpm**, then `pnpm install` against
   the project lockfile — bringing in `playwright`, `playwright-extra`, and
   `@xenova/transformers` (the JS local-whisper engine).
3. Installs **Chromium + its OS deps** via
   `npx playwright install --with-deps chromium` into the shared, world-readable
   `/opt/ms-playwright` (`PLAYWRIGHT_BROWSERS_PATH`).
4. Installs **Xvfb + xauth + x11-utils, pulseaudio, ffmpeg** — the virtual
   display + audio + media stack the headful bot needs.
5. Pre-bakes (or, if the build host is offline, defers to first-run) the small
   `Xenova/whisper-tiny.en` model into `/opt/hf-cache`, with `HF_HOME` and
   `TRANSFORMERS_CACHE` pointed there so **keyless STT works without per-run
   downloads**.

The **entrypoint** (`backend/docker/botruntime-entrypoint.sh`) mirrors
`src/bot/start-bot-runtime.sh`: it starts `Xvfb :99` and pulseaudio with a
virtual sink, exports `DISPLAY=:99`, then **execs `uvicorn src.main:app`**. The
API and every bot subprocess it spawns therefore share the same container and
the same virtual display — exactly what `browser.js` expects (it appends
`--display=$DISPLAY` and runs Chromium headful when `RUNNING_IN_DOCKER=true`).

---

## How a compose separate-worker join works (`make up` default)

1. `POST /api/v1/meetings` (or calendar / Meet-events dispatch) creates the
   meeting row and calls `dispatch_meeting(...)`.
2. In compose mode `dispatch_meeting` builds a `SidecarConfigurePayload` and
   `dispatch_to_compose_worker(...)` POSTs it to
   `http://meeting-worker:9000/configure` over the compose network.
3. The **meeting-worker** container's sidecar (`src/sidecar/main.py`) accepts the
   request (HTTP 202) and `bot_supervisor.spawn(...)` forks
   `node /app/src/bot/bot_scripts/sidecar_launcher.js googlemeet` **inside the
   worker container**, which launches headful Chromium on `DISPLAY=:99`.
4. The API marks the meeting `joining` and returns; the worker/bot drives the
   rest (heartbeats, transcript writes to the **shared DB**, and
   `/internal/sessions/ended` back to the API on exit).
5. The bot's exit reason (e.g. `admission_timeout` for a non-live URL) is the
   terminal `exit_reason` — a **real** join failure, proving the bot ran in the
   separate container.

If the worker is unreachable / busy / rejects, the API marks the meeting
`failed` with a clear `exit_reason` (`meeting_worker_unreachable`,
`meeting_worker_all_busy`, `meeting_worker_rejected_<code>`) and never crashes.

**Concurrency:** one `meeting-worker` handles one meeting at a time (the sidecar
rejects a second `/configure` until it's `warm` again). Set
`MEETING_WORKER_SIDECAR_URL` to a comma-separated list of worker URLs for a
small local pool; real concurrency at scale is the K8s warm pool via Helm.

---

## How a standalone in-process bot join works

1. `POST /api/v1/meetings` with a meeting URL creates the meeting row and, in
   `RUNTIME_MODE=standalone`, calls `dispatch_local_bot(...)`.
2. `LocalBotRunner._runtime_check()` confirms `node`, the bot entrypoint, and a
   Chromium binary are present. In this image all three pass.
3. The runner spawns:
   `node /app/src/bot/bot_scripts/sidecar_launcher.js googlemeet`
   with `MEETING_ID`, `MEETING_URL`, `BOT_NAME`, `PLATFORM`, etc. in the env.
   - The standalone layout puts the app at `/app/src/...`, **not** the monorepo
     `/app/meeting-joiner/src/...`. The compose override sets
     `NODE_BOT_ENTRYPOINT=/app/src/bot/bot_scripts/sidecar_launcher.js`
     so the runner resolves the bot tree here.
4. `sidecar_launcher.js` requires `googlemeet/index.js` and calls
   `joinMeeting(url, {name}, opts)`, which launches Chromium (Playwright +
   stealth) on `DISPLAY=:99` and drives the join flow.
5. The meeting transitions `scheduled → joining → ongoing → completed/failed`.
   The bot subprocess exit code maps to the terminal `exit_reason`.

### Relevant env (set by the override)

| Var | Value | Why |
|---|---|---|
| `RUNTIME_MODE` | `standalone` | local subprocess dispatch (no K8s warm pool) |
| `MEETING_BOT_MODE` | `subprocess` | actually spawn the bot (`disabled` short-circuits) |
| `NODE_BOT_ENTRYPOINT` | `/app/src/bot/bot_scripts/sidecar_launcher.js` | standalone bot tree path |
| `DISPLAY` | `:99` | Xvfb display the bot renders onto |
| `RUNNING_IN_DOCKER` | `true` | makes `browser.js` launch headful on Xvfb |
| `PLAYWRIGHT_BROWSERS_PATH` | `/opt/ms-playwright` | Chromium discovery |
| `LLM_PROVIDER` | `local_whisper` | keyless STT, no cloud keys |
| `WHISPER_MODEL` / `HF_HOME` / `TRANSFORMERS_CACHE` | `tiny.en` / `/opt/hf-cache` | cached local whisper model |

No secrets are required to boot or to launch a Google Meet bot.

---

## What a SUCCESSFUL real join needs

Launching the bot is now real, but **being admitted** depends on the meeting:

- **Google Meet / Microsoft Teams** — needs a **valid, live** meeting URL and
  that a host (or the lobby policy) **admits the bot**. Against a random or
  not-yet-started link the bot launches Chromium, reaches the lobby, and then
  ends with a *real* join failure — `not_admitted` / `join_timeout` — **not**
  `bot_runtime_unavailable`. That distinction is the proof the runtime is real.
- **Zoom** — additionally needs the **Zoom Meeting SDK credentials** (the SDK
  is an amd64-only PyPI wheel and is not bundled in this standalone image; Meet
  and Teams work without it).

So a green end-to-end join is: bot-runtime image up → a **live** Meet/Teams
link → the host admits "Verdant Notetaker" → status reaches `ongoing` and the
local-whisper transcript fills in with no cloud keys.

---

## Troubleshooting

- `meeting_worker_unreachable` / meeting stuck never joining → the
  `meeting-worker` container isn't healthy; check `make logs-worker`.
- `bot_runtime_unavailable_no_chromium` in the worker → `PLAYWRIGHT_BROWSERS_PATH`
  / `CHROMIUM_PATH` was overridden, or you're on `make up-api` (no worker, API-only).
- Chromium crashes with renderer OOM → bump `shm_size` (already `1gb` in the
  override).
- First transcription is slow → the whisper model is downloading because the
  build host was offline at bake time; subsequent runs reuse `/opt/hf-cache`.
