# parlor-capture — botless desktop capture

Granola-style **"no bot joins the call"** capture for the Parlor meeting
assistant. It records your machine's **system/meeting audio** locally,
transcribes it, and streams the transcript to the Parlor backend so the
transcript → summary flow works **without a server-side bot joining the
meeting**.

This is the *botless* capture path. It **complements** the server-side joiner
bots (`POST /api/v1/meetings`, which dispatches a bot into a zoom/meet/teams
call) — it does not replace them. Use it when you want a local, private,
bot-free recording of a call you're already in.

macOS-first (the dev box is darwin).

---

## How it works

```
 ┌───────────┐   5s chunks   ┌──────────┐  STTResult  ┌───────────┐  segment  ┌─────────┐
 │  Audio    │ ────────────▶ │   STT    │ ──────────▶ │ Segment   │ ────────▶ │ Backend │
 │  source   │  16kHz mono   │ backend  │             │ shaping   │   POST    │  + local│
 └───────────┘               └──────────┘             └───────────┘           └─────────┘
   loopback / mic         mock | faster-whisper | remote      contract +        /summarize
                                                              internal shape     on stop
```

1. **Audio capture** (`audio/`): opens a chosen input device with `sounddevice`
   (PortAudio), downmixes to **mono 16 kHz float32**, and yields fixed-length
   chunks (`--chunk-seconds`, default 5s). A `--mock-audio` source generates
   synthetic audio so the pipeline runs with no hardware.
2. **STT** (`stt/`): each chunk → zero or more `STTResult` spans. Backends are
   pluggable behind the `STTBackend` protocol:
   - `mock` — canned segments, no model, always available (default; great for
     demos/CI).
   - `faster-whisper` — local **offline** Whisper (optional `[whisper]` extra).
     Does not diarize.
   - `remote` — POSTs a chunk WAV to a configurable HTTP STT endpoint (stub).
3. **Segment streaming** (`client/`): each span becomes a `Segment` emitted in
   **both** the public-contract shape (`speakerName`, `tStartSec`, …) and the
   internal `meeting_joiner` content shape (`speaker`, `startTime`, …), then
   POSTed to the backend. Speaker labels are best-effort (`You`/`Them` from
   mock, or `--speaker` default; real diarization is out of scope).
4. **Finalize**: on stop (Ctrl-C or `--duration`) the meeting is set to
   `completed` (`DELETE /api/v1/meetings/{id}`) and `/summarize` is triggered so
   the recap is generated.

A local JSONL transcript (`parlor-transcript.jsonl` by default in offline mode,
or `--transcript-out`) is always written as a durable artifact.

---

## Botless capture vs. the API contract (important)

The public contract (`docs/API-CONTRACT.md`) has **no botless-create** and
**no public transcript-ingest** endpoint:

- `POST /api/v1/meetings` requires a real `zoom`/`meet`/`teams` URL and
  **dispatches a server-side bot**. A synthetic `desktop://<host>/<ts>` URL is
  rejected (platform "unknown" → 400).
- There is no public endpoint to push transcript segments onto a meeting; the
  transcript lives in the internal `meeting_joiner.transcript` JSON.

So the client behaves pragmatically and **never crashes** on these gaps:

| Situation | Behaviour |
|---|---|
| `--meeting-url <real url>` + backend up | Creates the meeting row, streams segments to `--ingest-path` if configured, finalizes + `/summarize`. |
| No `--meeting-url` | Uses synthetic `desktop://…` URL and runs **locally** (the API would reject the synthetic URL). |
| No ingest path / backend returns 404/405 | Keeps the local transcript, prints a clear notice, still drives `/summarize`. |
| `--local` | Fully offline: capture + transcribe + local JSONL only. |
| Backend down | Reported with a clear message; capture is not interrupted. |

If your backend mounts a private botless ingest endpoint (the internal
`append_transcript_segment` flow), point the client at it with
`--ingest-path` / `PARLOR_INGEST_PATH` (supports a `{meeting_id}` placeholder).
The POST body carries both `segment` (contract shape) and `content` (internal
shape) so either consumer works.

---

## Install

Requires Python **3.12+**.

```bash
cd desktop-capture
python3 -m venv .venv && source .venv/bin/activate
pip install -e .            # core: mock + remote STT, audio capture, client
# optional local offline Whisper (heavier — downloads ctranslate2 + a model):
pip install -e '.[whisper]'
```

On macOS, audio capture needs PortAudio:

```bash
brew install portaudio
```

---

## macOS system-audio setup (BlackHole + Aggregate Device)

macOS cannot record system audio out of the box — Core Audio doesn't expose the
output mix as an input. Install a **virtual loopback device** so the tool can
capture *meeting* audio (both sides) rather than just your microphone:

1. **Install BlackHole** (2ch is enough):
   ```bash
   brew install blackhole-2ch
   # or download from https://existential.audio/blackhole/
   ```
2. **Create a Multi-Output Device** (so you still *hear* the call while it's
   recorded):
   - Open **Audio MIDI Setup** (`/Applications/Utilities`).
   - Click **+ → Create Multi-Output Device**.
   - Tick **your speakers** (e.g. "MacBook Speakers") **and** "BlackHole 2ch".
   - Select this Multi-Output Device as the **system output** during the call.
3. **Capture from BlackHole**:
   ```bash
   parlor-capture --list-devices            # find the loopback device
   parlor-capture capture --device "BlackHole 2ch" --stt faster-whisper ...
   ```
   To record **both** your mic and the call, build an **Aggregate Device**
   (Audio MIDI Setup → + → Create Aggregate Device) combining your mic +
   BlackHole, and select that as `--device`.

If no loopback device is detected, the tool prints these steps and **falls back
to the microphone** so it still runs.

(`ffmpeg`'s `avfoundation` input is an alternative capture path; this client
uses `sounddevice`/PortAudio, which reads the same Core Audio devices.)

---

## Configuration

Resolution order (highest first): **CLI flags → env vars → `~/.parlor/config`**.

Env vars (see `.env.example`):

| Var | Meaning |
|---|---|
| `PARLOR_API_URL` | Backend base URL (default `http://localhost:8000`) |
| `PARLOR_API_KEY` | Workspace API key (`X-API-Key`); carries its own workspace |
| `PARLOR_EMAIL` / `PARLOR_PASSWORD` | Login path (yields a Bearer token) |
| `PARLOR_WORKSPACE_ID` | Active workspace (else first workspace on the account) |
| `PARLOR_INGEST_PATH` | Optional private transcript-ingest path |

`~/.parlor/config` (ini):
```ini
[parlor]
api_url = http://localhost:8000
api_key = vk_live_xxx
```

No secrets are hardcoded — credentials come only from env or the home config.

---

## Usage

```bash
# List audio devices (and loopback setup help if none found)
parlor-capture --list-devices

# Offline demo — no backend, no model, synthetic audio: proves the pipeline
parlor-capture capture --local --mock-audio --duration 15

# Real local capture with offline Whisper, writing a local transcript
parlor-capture capture --local --stt faster-whisper --stt-model base \
  --device "BlackHole 2ch" --transcript-out ./call.jsonl

# Full path against a running backend (real meeting URL + API key)
export PARLOR_API_KEY=vk_live_xxx
parlor-capture capture \
  --meeting-url "https://zoom.us/j/123456789" \
  --title "Weekly sync" \
  --stt faster-whisper --device "BlackHole 2ch"

# Remote STT backend
parlor-capture capture --stt remote --stt-endpoint https://stt.example.com/transcribe ...
```

Key flags: `--device`, `--stt {mock,faster-whisper,remote}`, `--stt-model`,
`--chunk-seconds`, `--duration`, `--speaker`, `--live/--no-live`, `--local`,
`--mock-audio`, `--summarize/--no-summarize`, `--ingest-path`, plus auth
overrides (`--api-url`, `--api-key`, `--workspace-id`, `--email`, `--password`).

---

## Limitations

- **System-audio capture requires a loopback device** (BlackHole / Aggregate).
  Without one it falls back to microphone-only.
- **Diarization is best-effort.** Local backends don't separate speakers; labels
  are `You`/`Them` (mock) or a single `--speaker` default. For real per-speaker
  attribution, use the server-side bot path.
- **No public transcript-ingest endpoint** exists in the contract, so against a
  stock backend segments land in the local JSONL and `/summarize` runs on the
  meeting; wire `--ingest-path` to push segments server-side.
- `faster-whisper` downloads a model on first use and runs on CPU by default
  (slower than realtime for larger models — start with `tiny`/`base`).
- macOS-first; Linux works with a PulseAudio/ALSA loopback, Windows with
  VB-Audio Cable, but those paths are untested here.
