# Bot runtime: launching real meeting bots locally

By default the standalone dev stack runs an **API-only** backend image
(`backend/Dockerfile.dev`). That image has Python but **no Node, no Chromium,
no virtual display or audio**, so the standalone `LocalBotRunner`
(`src/services/local_bot_runner.py`) cannot spawn a bot — its
`_runtime_check()` returns `bot_runtime_unavailable_no_node` /
`_no_chromium` and the meeting is marked `failed` with
`exit_reason=bot_runtime_unavailable`.

The **bot-runtime image** (`backend/Dockerfile.botruntime`) fixes that: one
container that serves the FastAPI API *and* can fork the real Playwright/Node
bot that drives Chromium into the meeting.

---

## Two images, two commands

| | API-only (default) | Bot runtime |
|---|---|---|
| Dockerfile | `backend/Dockerfile.dev` | `backend/Dockerfile.botruntime` |
| Contents | Python + API deps | Python + API deps **+ Node 18 + pnpm node_modules + Playwright Chromium + Xvfb + pulseaudio + ffmpeg + local whisper cache** |
| Bots | degrade to `bot_runtime_unavailable` | **really launch** Chromium and attempt to join |
| Build | fast, small | large/slow (browser + node_modules) |
| Command | `make up` | `make up-bots` |

```bash
# Fast API-only iteration (auth, workspaces, product endpoints):
make up

# Full bot runtime — backend actually launches meeting bots:
make up-bots

# Tear down (either stack):
make down          # if started with `make up`
make down-bots     # if started with `make up-bots`
```

`make up-bots` is equivalent to:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.botruntime.yml \
  up -d --build
```

The override (`docker-compose.botruntime.yml`) swaps **only** the `backend`
service to the bot-runtime image and sets the env it needs (see below).
postgres / ai-service / web are unchanged.

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

## How a local bot join works

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

- `bot_runtime_unavailable_no_chromium` while using this image → the override
  isn't applied (you ran `make up`, not `make up-bots`), or
  `PLAYWRIGHT_BROWSERS_PATH` was overridden.
- Chromium crashes with renderer OOM → bump `shm_size` (already `1gb` in the
  override).
- First transcription is slow → the whisper model is downloading because the
  build host was offline at bake time; subsequent runs reuse `/opt/hf-cache`.
