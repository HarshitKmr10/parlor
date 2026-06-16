# Local Docker test harness for the Google Meet bot

Reproduce the Chainguard wolfi-base + Chromium + Xvfb + PulseAudio
environment that runs in staging/prod, locally, on Mac ARM via
Docker buildx (`linux/amd64` emulated by qemu / Rosetta).

**Why this exists:** the `[role="dialog"]:has-text("not found")`
false-positive that bailed the staging bot only reproduces inside the
prod Chromium config (specifically the `--use-file-for-fake-{video,
audio}-capture=/dev/null` flags that make Meet show a "Camera not
found" / "Microphone not found" device-warning dialog). The bug doesn't
appear in macOS-native local runs because the Mac has real audio/video
devices. So we need a Docker test path BEFORE pushing selector changes.

## One-time setup

```bash
# Make sure Docker Desktop is running and buildx supports linux/amd64.
docker buildx inspect | grep -E "Platforms|name"

# Build the slim test image (~5-10 min cold, mostly apk + npm).
docker compose -f scripts/local-docker/docker-compose.test.yaml build
```

## Test recipes

### Smallest repro — just the join flow

Best for iterating on `join.js` / `selectors.js` changes. Joins, dumps
every visible dialog + button + body-text snippet on rejection so we
see exactly what fired.

```bash
MEET_URL=https://meet.google.com/<your-meeting> \
  docker compose -f scripts/local-docker/docker-compose.test.yaml \
  run --rm test-join
```

Output lands in `scripts/local-docker/out/test-join/<ts>/`:
- `after_navigation_*.png` — pre-join screen as Meet served it
- `failure_*.png` (on rejection) — what the bot saw when it bailed
- `diagnostic.json` — visible dialogs, top 30 button aria-labels, body snippet, URL
- `result.json` — `{ ok, error? }`

### WebRTC architecture probe

Re-runnable check that Meet still ships per-peer audio receivers.
Useful when validating `audio_asr` mode against a UI rev that might
have changed the receiver layout.

```bash
MEET_URL=https://meet.google.com/<your-meeting> \
  docker compose -f scripts/local-docker/docker-compose.test.yaml \
  run --rm test-probe
```

### Full live E2E (audio_asr or gmeet_captions)

Same as `scripts/e2e/googlemeet/live.js` but in the prod Chromium env.
For `audio_asr`, set `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` in
your shell or a `meeting-joiner/.env` file before running.

```bash
MEET_URL=https://meet.google.com/<your-meeting> MODE=gmeet_captions \
  docker compose -f scripts/local-docker/docker-compose.test.yaml \
  run --rm test-live
```

## What's mounted vs what's baked in

| | In image (rebuild required) | Bind-mounted (live edit) |
|---|---|---|
| Chromium + Xvfb + PulseAudio | ✅ | |
| node_modules (playwright, stealth) | ✅ | |
| `src/bot/bot_scripts/...` (the bot code) | | ✅ |
| `scripts/...` (probes, e2e, this harness) | | ✅ |
| `tests/...` | | ✅ |

So tweaking `selectors.js` and re-running `docker compose run …`
takes seconds, not minutes.

## Pre-push workflow

For any change touching `bot_scripts/googlemeet/join.js`,
`selectors.js`, or any selector matching:

1. Edit locally.
2. `docker compose -f scripts/local-docker/docker-compose.test.yaml run --rm test-join`
   against a real Meet URL (admit the bot from your host account).
3. Read `out/test-join/<ts>/diagnostic.json` to confirm the bot
   classified the page correctly (admitted vs name_input vs rejection).
4. Only then push.

If the diagnostic.json shows a rejection that looks suspicious
(< 5 s after navigation, dialog text doesn't mention "meeting" /
"call"), the selector is too loose — narrow it before pushing.
