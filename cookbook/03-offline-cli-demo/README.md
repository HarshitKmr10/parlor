# 03 — Fully offline capture CLI demo

The `parlor-capture` CLI (the real `desktop-capture/` package, not a
stand-in) can run its whole audio -> STT -> transcript-segment pipeline with
zero infrastructure: synthetic audio in, a mock STT backend, a local JSONL
transcript out. No Docker, no backend, no network calls.

## Run it

```bash
./run.sh
```

It installs `desktop-capture` into a local `.venv` if `parlor-capture` isn't
already on `PATH`, then runs:

```bash
parlor-capture capture --local --mock-audio --duration 3 --transcript-out <tmpfile>.jsonl
```

## What was actually verified

Actual output from running this script in this environment:

```
Audio source: mock tone generator
STT backend: mock
Mode: local (offline) — no backend calls.
Capturing... press Ctrl-C to stop (auto-stop in 3s)
   0.0s You: Thanks everyone for joining the call today.

Captured 1 segment(s).
Local transcript: /var/folders/.../parlor-cookbook-XXXX.jsonl
```

and the transcript file contained a real `TranscriptSegment`-shaped JSON
line:

```json
{"id": "8a22020e-da79-41f7-8f06-5c54ee852f1c", "speakerId": null, "speakerName": "You", "text": "Thanks everyone for joining the call today.", "tStartSec": 0.0, "tEndSec": 5.0, "createdAt": "2026-07-08T21:04:13.033565+00:00"}
```

This was also verified from a built-and-installed **wheel** (not just
`pip install -e .`) as part of the PyPI packaging work — see
`desktop-capture/pyproject.toml` and the root `CHANGELOG.md`.

## Going further

Swap `--mock-audio` for a real input device (`--device "BlackHole 2ch"`,
see `desktop-capture/README.md` for macOS loopback setup) and `--stt mock`
for `--stt faster-whisper` to capture and transcribe a real call locally.
Add `--meeting-url` and `--api-key` to stream segments to a live backend
instead of writing only a local file — see
[`../01-botless-capture/`](../01-botless-capture) for that path via raw API
calls.
