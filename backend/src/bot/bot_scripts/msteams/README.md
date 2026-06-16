# MS Teams Joiner

The Microsoft Teams meeting bot. Conforms to the same `platformRouter`
contract used by Zoom and Google Meet — `joinMeeting(url, credentials, options)`
and `startStreamScrapping(meetingId, options)`.

## Design goals

The previous implementation joined slowly (best case 25–40 s, worst case
130 s+ from a single hard-coded `waitForSelector` timeout) and produced lossy
speaker attribution because it captured a single mixed audio stream. This
module fixes both:

- **No unconditional sleeps in the join path.** Every step has a budget and
  resolves on the first observable signal (selector visible, predicate true).
  Worst-case join is the sum of step budgets, currently ~12 s.
- **Per-speaker audio capture.** A page-realm hook on `RTCPeerConnection`
  attaches every remote audio track to its own `<audio>` element. The
  recorder pulls PCM from each independently via `AudioWorklet`. Speaker
  attribution becomes *known by construction* rather than inferred from DOM
  polling.
- **Stealth wired correctly.** The `playwright-extra` stealth plugin is now
  actually loaded; the legacy code declared it as a dependency but never
  imported it.
- **Modern audio pipeline.** `AudioWorklet` instead of the deprecated
  `ScriptProcessorNode`. PCM ArrayBuffers transferred to Node as binary, no
  base64 33 % bloat.
- **VAD before transcription.** Cheap energy + ZCR gate skips the most common
  hallucination triggers (silent windows transcribed as "thank you") so we
  never pay for a provider round-trip on near-silent windows.
- **Provider-agnostic transcription.** The adapter delegates to the existing
  `MultiProviderTranscriber`, so `LLM_PROVIDER` selects between OpenAI, Azure
  OpenAI, Azure Speech, AWS Transcribe, AWS Transcribe Medical, Bedrock Nova
  Sonic and HealthScribe — same set the rest of the project supports.
- **Teams captions transcript source.** `MSTEAMS_TRANSCRIPT_SOURCE=teams_captions`
  captures Teams `recognitionResults` from the WebRTC main channel, buffers
  them until final using the closed-caption pipeline, and persists them
  as `provider: 'teams_captions'` transcript segments without starting ASR
  sessions.
- **Hallucination filter after the provider returns text.** Known-phrase,
  repetition-loop, and filler detection — applies to every provider.
- **Structured timing.** `JoinTimer` records every step with budget
  comparisons; logs flag any step that goes over budget. Easy to find the
  slow leg of a particular meeting.

## File map

| File                      | Purpose                                                |
|---------------------------|--------------------------------------------------------|
| `joinMeeting.js`          | Public entry. Runs the lifecycle and exposes results.  |
| `streamScrapping.js`      | Compatibility shim (capture is integrated).            |
| `browser.js`              | Playwright launcher + stealth + container/Xvfb wiring. |
| `selectors.js`            | All Teams DOM selectors with HOST/GUEST fallbacks.     |
| `dom.js`                  | `raceAny`, `raceFirst`, click/fill helpers.            |
| `timing.js`               | `JoinTimer` for step-level instrumentation.            |
| `join.js`                 | Pre-join orchestration (warm-up → click Join).         |
| `admission.js`            | Lobby/admitted/removed state machine.                  |
| `removal.js`              | Background removal-by-admin watcher.                   |
| `leave.js`                | Graceful leave + confirm.                              |
| `peerStreamsScript.js`    | In-page hook on `RTCPeerConnection.ontrack`.           |
| `recorderScript.js`       | In-page `AudioWorklet` capture per track.              |
| `captureBridge.js`        | Node-side: VAD → provider → filter → publish.          |
| `transcription.js`        | Adapter onto MultiProviderTranscriber (all providers). |
| `vad.js`                  | Energy + zero-crossing-rate VAD.                       |
| `hallucinationFilter.js`  | Known-phrase / repetition / filler detection.          |
| `speakerMapper.js`        | Track-based primary attribution + word-overlap fallback. |
| `rosterWatcher.js`        | People-panel scrape for peer-id → name enrichment.     |

## Configuration

| Env                              | Default                  | Effect                                  |
|----------------------------------|--------------------------|-----------------------------------------|
| `MSTEAMS_HEADLESS`               | `false`                  | `true` runs Chromium headless (don't, Teams blocks). |
| `MSTEAMS_USE_STEALTH`            | `true`                   | `false` disables the stealth plugin.    |
| `MSTEAMS_TZ`                     | `America/Los_Angeles`    | Browser timezone.                       |
| `MSTEAMS_CHUNK_MS`               | `5000`                   | Per-track audio window length.          |
| `MSTEAMS_LOBBY_MS`               | `60000`                  | Max time to wait in lobby.              |
| `MSTEAMS_JOIN_BUDGET_MS`         | `15000`                  | Soft budget for the join leg.           |
| `MSTEAMS_MAX_MEETING_MS`         | `7200000`                | Hard cap on a single meeting.           |
| `MSTEAMS_ALONE_GRACE_MS`         | `300000`                 | Grace before exiting if alone.          |
| `MSTEAMS_DUMP_AUDIO`              | `false`                  | Persist captured WAV chunks to disk.    |
| `MSTEAMS_MEETING_DIR`            | `/tmp/msteams_meetings`  | Where per-meeting artifacts go.         |
| `MSTEAMS_TRANSCRIPT_SOURCE`      | `csrc_asr`               | `csrc_asr` keeps the current audio-to-ASR path. `teams_captions` uses Teams platform captions and skips ASR audio capture. |
| `MSTEAMS_CAPTIONS_LANGUAGE`      | unset                    | Optional Teams captions language passed to the programmatic caption enable call. |
| `LLM_PROVIDER`                   | `openai`                 | Picks the transcription backend (one of `openai`, `azure_openai`, `azure_speech`, `aws_transcribe`, `aws_transcribe_medical`, `bedrock`, `healthscribe`). Provider-specific env vars are documented in `transcribeProcessor.js`. |

## Output contract

`joinMeeting()` resolves to:

```js
{
  success: boolean,
  platform: 'msteams',
  meetingDir: string,
  segmentsPath: string,           // JSONL, one segment per line
  segmentsCount: number,
  timing: { total_ms, spans: [...] },
  exitReason: { reason, info? },  // 'removed_by_admin' | 'max_meeting_time'
  localMp4Path: 'NoFile',         // legacy contract; capture is segment-only
}
```

Each line in `segments.jsonl` is:

```js
{
  id, track_id, peer_id,
  speaker, speaker_id, attribution_confidence,
  start_ms, end_ms,
  language, provider, kind,
  text,
  words: [ { word, start, end, probability } ]   // present for word-level providers
}
```

`kind` is `'words'` when the provider returned word-level timestamps (OpenAI,
Azure, AWS), `'segments'` when it returned segment-level only (Bedrock,
HealthScribe), `'caption'` for Teams platform captions, and `'empty'` for
filtered/empty results.

## Operations

- Healthy join logs: every span <= budget, `total_ms` ≤ ~12 000.
- Slow join: look for the first `[teams.timing] X.Y=Nms ... WARN` line — that
  is the step that blew its budget. Common causes: launcher page didn't
  short-circuit (`page.navigate`), permissions popup (`prejoin.ready`),
  lobby that took longer than `MSTEAMS_LOBBY_MS` (`admission.confirm`).
- No segments published: check the live console — VAD/hallucination drops
  show up in `[teams.capture]` logs. If the bridge never sees an `__teamsBridgeOnTrack`
  callback, the page-realm hook didn't run before Teams' WebRTC, which means
  `addInitScript` was registered too late (only `installPageHooks` should
  do this).
