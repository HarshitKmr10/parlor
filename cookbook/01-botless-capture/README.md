# 01 — Botless capture

Demonstrates Parlor's botless path: a local client posts transcript segments
straight to the backend over the public API contract — no server-side bot
ever joins the call (contrast with `POST /api/v1/meetings`, which dispatches
a Playwright bot into a real Zoom/Meet/Teams URL).

This script is a minimal, dependency-light stand-in for what
`desktop-capture/` does with real microphone/loopback audio and Whisper: sign
up, create a `platform: "desktop"` meeting via `POST /api/v1/meetings/botless`,
append `TranscriptSegment`s via `POST /api/v1/meetings/{id}/transcript`, then
mark it complete.

## Run it

```bash
pip install httpx
python run.py --base-url http://localhost:8001   # match your API_PORT
```

## What was actually verified

Run against a live `make up` stack in this environment (backend on a
non-default port for this sandbox, `http://localhost:8002`):

```
1. Signing up cookbook-925df3cd@example.com ...
   workspace=46d4c708-f7a0-4f23-baf2-a07a8299647e
2. Creating a botless meeting (no bot dispatched) ...
   meeting id=7b241da8-75d2-46af-a085-f25fad8afa00 platform='desktop' meetingUrl='desktop://46d4c708-f7a0-4f23-baf2-a07a8299647e/20260708T210312478487Z' status='ongoing'
3. Streaming transcript segments as if a local capture client produced them ...
   appended=2
4. Marking the meeting complete (fires the embed+summarize pipeline) ...
   status='completed'

Done. No bot ever joined a call — see meeting 7b241da8-75d2-46af-a085-f25fad8afa00 ...
```

This is the actual output from that run, not a hand-written transcript —
`platform` came back `"desktop"`, the `meetingUrl` is the synthetic
`desktop://<workspaceId>/<timestamp>` scheme the contract documents for
botless meetings (a real `zoom`/`meet`/`teams` URL would trigger a real bot
dispatch instead), and the meeting transitioned `ongoing -> completed` with
no bot process ever spawned.

## Real desktop-capture client

For the real thing (actual audio capture + STT instead of hand-written
segments), see [`../../desktop-capture/README.md`](../../desktop-capture/README.md)
and [`03-offline-cli-demo/`](../03-offline-cli-demo) in this cookbook.
