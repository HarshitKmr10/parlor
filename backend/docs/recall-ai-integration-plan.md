# Implementation Plan: Recall.ai-Style Speaker Attribution for MS Teams Bot

**Status:** Draft for engineering lead review
**Date:** 2026-04-29
**Scope:** Replace DOM-based speaker attribution in `src/bot/bot_scripts/msteams/` with platform-level per-participant audio sourced from Microsoft's Real-time Media Platform (RTMP), gated behind a phased build with explicit off-ramps.

---

## 1. Executive Summary

The current Playwright bot at `src/bot/bot_scripts/msteams/` correctly captures per-track audio via the page-realm `RTCPeerConnection.ontrack` hook (`peerStreamsScript.js`, `recorderScript.js`) and uses `speakerMapper.js` + `rosterWatcher.js` for attribution. This works in 1-on-1 calls but degrades on multi-speaker meetings because the Teams web client (lightExperience guest mode) renders `.vdi-frame-occlusion` on a shared ancestor across tiles, so DOM polling cannot distinguish active speakers reliably.

Recall.ai's approach — and the only fully-supported Microsoft path for guest-and-authenticated multi-speaker attribution — is the **Application-hosted Media bot** built on `Microsoft.Graph.Communications.Calls.Media` (Real-time Media SDK). That SDK is **.NET-only and Windows-only**.

This plan proposes a **hybrid build** in three phases, with kill-switches at each phase boundary, ending at a recommendation: build a thin Windows-side media bot, keep our existing Linux Node/Python pipeline, pipe per-participant PCM over gRPC. Total estimate: **8 to 12 engineering-weeks** to GA, with a viable abandon-and-buy off-ramp at the end of Phase 1 (~3 weeks in).

---

## 2. Architecture Target

```
+------------------------- Customer Tenant ---------------------------+
|  Teams Meeting (lightExperience or full client)                     |
|     |                                                               |
|     | RTMP signaling + media (SRTP)                                 |
|     v                                                               |
|  Azure AD App + Bot Framework Channel (Teams)                       |
+----------------------|----------------------------------------------+
                       |
                       v   public FQDN, TLS cert, websocket + media ports
+----------------- Azure Windows VMSS ---------------------------------+
|  meeting-joiner-media-bot (.NET 8, Windows Server 2022)              |
|   - Microsoft.Graph.Communications.Calls.Media                       |
|   - Forks Microsoft PolicyRecordingBot sample                        |
|   - Per-participant audio frame callback                             |
|   - Resamples 16kHz PCM -> protobuf gRPC frames                      |
+----------------------|-----------------------------------------------+
                       | gRPC (mTLS) over private VNet peering / VPN
                       v
+----------------- Existing AKS Linux cluster -------------------------+
|  src/main.py (FastAPI control plane) - dispatch + lifecycle          |
|  src/processors/transcribeProcessor.js - MultiProviderTranscriber    |
|  src/storage/dbIntegration.js - Postgres/Prisma                      |
|  NEW: src/adapters/rtmpAudioReceiver/ (gRPC server, PCM -> chunks)   |
+----------------------------------------------------------------------+
```

The Playwright bot remains in the codebase as the **fallback path** for tenants that refuse `Calls.AccessMedia.All` consent. Dispatch decides per meeting which path to use.

---

## 3. Phased Breakdown

### Phase 0 — Spike and Decision Gate (1 week)

Validate that we can clear regulatory and tenancy hurdles before writing Teams-bot code.

- Provision a Microsoft 365 developer tenant (E5 trial, free).
- Register an Azure AD multi-tenant app with `Calls.AccessMedia.All`, `Calls.JoinGroupCall.All`, `OnlineMeetings.Read.All` (application permissions, admin-consent required).
- Register a Bot Framework bot, link Teams channel.
- Stand up one Windows Server 2022 VM, install .NET 8 SDK, fork the Microsoft PolicyRecordingBot sample.
- Verify `Microsoft.Graph.Communications.Calls.Media` package compiles and bot can answer one test call.

**Exit criteria (all required to proceed):**
- Bot answers a test call in dev tenant and logs at least one audio frame with a participant ID.
- Tenant admin consent flow walked through end-to-end with a non-engineer.
- Legal/compliance has signed off on disclosure language.

**Off-ramp:** if admin consent friction looks unworkable for our SMB segment, abandon and pursue **Graph API meeting transcripts** (post-meeting only, requires only `OnlineMeetingTranscript.Read.All`).

### Phase 1 — Proof of Concept (2-3 weeks)

End-to-end audio path through our existing transcription stack, single tenant, single concurrent meeting.

1. **Fork PolicyRecordingBot** into `services/media-bot-dotnet/` (separate solution, separate Dockerfile.windows, isolated from Node/Python).
2. **gRPC contract** at `proto/audio_frames.proto`. Service `RtmpAudioIngest` with bidi stream `StreamFrames(MeetingFrame) returns (Ack)`. Frame fields: `meeting_id`, `participant_id`, `participant_display_name`, `aad_object_id`, `pcm_16khz_mono` bytes, `start_ts_ms`, `end_ts_ms`, `is_speaking`.
3. **Linux-side gRPC receiver** at `src/adapters/rtmpAudioReceiver/`. Groups frames by `participant_id`, emits the same windowed PCM ArrayBuffer shape that `captureBridge.js` already expects. Wires into existing `MultiProviderTranscriber`.
4. **Adapter shim** in `src/bot/bot_scripts/msteams/joinMeeting.js`: branch on `MSTEAMS_ATTRIBUTION_MODE` (`dom` | `rtmp`).
5. **FastAPI dispatch** in `src/main.py` and `src/services/meeting_service.py`: add `media_bot_strategy` field on `MeetingCreateRequest`; default `auto`.
6. **Disclosure injection.** Bot plays a TTS clip on join.

**Exit criteria:**
- One real Teams meeting in dev tenant captured end-to-end, transcript in Postgres has correct `speaker` field per utterance for at least 3 distinct speakers.
- Latency from speaker stops talking to segment row in Postgres under 8 seconds.
- No regressions in existing DOM-mode tests.

**Off-ramp:** **buy Recall.ai**. Wire their webhook into `src/main.py`. Effort: ~1.5 weeks of integration.

### Phase 2 — Staging (3-4 weeks)

Multi-tenant, concurrent meetings, observability, on-call story.

- **Windows VMSS on Azure** at `infra/azure/media-bot/` (Bicep). Autoscale on CPU and a custom "active calls" metric. Each VM ~10 concurrent meetings. VNet-peer to AKS.
- **Certificate management.** Public FQDN, Let's Encrypt or Azure Key Vault cert. Install in Windows cert store via VMSS extension.
- **Tenant onboarding endpoints** on FastAPI: `/api/v1/tenants/{id}/admin-consent-url`, `/api/v1/tenants/{id}/consent-callback`. New Postgres `tenant_consent` table.
- **Telemetry.** OpenTelemetry traces from .NET bot through gRPC. Metrics: `active_calls`, `audio_frames_dropped`, `participant_join_latency_ms`, `disclosure_play_failures`.
- **Lifecycle integration.** .NET bot publishes call events (`CallEstablished`, `ParticipantJoined`, `ParticipantLeft`, `CallTerminated`) to FastAPI control plane.
- **Failure modes:** crash auto-restart, gRPC buffer-on-partition, mid-call consent revocation handling.

**Exit criteria:**
- 50 concurrent test meetings sustained for 1 hour, dropped frame rate < 0.1%.
- Consent revocation tested and verified.
- Runbook published in `docs/runbooks/media-bot.md`.

**Off-ramp:** hybrid model — RTMP for enterprise tier only, DOM for everyone else.

### Phase 3 — Production (2-3 weeks)

GA, customer onboarding self-service, SLA.

- **Teams app manifest** + submit for **Microsoft publisher attestation** (4-6 week turnaround on Microsoft side).
- **Self-service consent UI** in customer dashboard.
- **SLA monitoring.**
- **Cost dashboard** — per-tenant meeting-hour billing.
- **Decommission plan for DOM mode** — do NOT remove; demote to fallback for non-consenting tenants.

**Exit criteria:**
- First 3 paying customers onboarded onto RTMP path.
- 99.5% successful-join rate over 7 days.
- Microsoft publisher attestation granted.

---

## 4. Files in Repo — Change Map

| File / Path | Change Type | Notes |
|---|---|---|
| `src/bot/bot_scripts/msteams/joinMeeting.js` | Modify | Branch on `MSTEAMS_ATTRIBUTION_MODE`. |
| `src/bot/bot_scripts/msteams/speakerMapper.js` | Adapter shim | Same interface, RTMP path passes `{participant_id, display_name}` directly. |
| `src/bot/bot_scripts/msteams/rosterWatcher.js` | Demote | Only DOM mode. |
| `src/bot/bot_scripts/msteams/captureBridge.js` | Reuse | Already has the right contract (windowed PCM, VAD, hallucination filter). |
| `src/processors/transcribeProcessor.js` | No change | MultiProviderTranscriber stays as-is. |
| `src/storage/dbIntegration.js` | Minor | Add `attribution_source` column (`dom` \| `rtmp`). |
| `src/main.py` | Modify | Add `media_bot_strategy` to schema and dispatch. |
| `src/services/meeting_service.py` | Modify | Strategy selection. |
| `prisma/schema.prisma` | Modify | New `tenant_consent` and `attribution_source`. |
| `services/media-bot-dotnet/` | New | Entire .NET project. |
| `src/adapters/rtmpAudioReceiver/` | New | Node gRPC server. |
| `proto/audio_frames.proto` | New | Shared contract. |
| `infra/azure/media-bot/` | New | Bicep, cert install scripts. |
| `docs/runbooks/media-bot.md` | New | Ops runbook. |

**Nothing is deleted.** DOM-mode is preserved as a fallback.

---

## 5. Risk Register (Top 5)

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | **Tenant admin consent friction.** Many enterprise IT teams won't grant `Calls.AccessMedia.All` to a third-party app without a 4-8 week security review. | High | High | Microsoft publisher attestation (Phase 3), DOM fallback, consent dashboard for CSMs, pre-canned security questionnaire + SOC 2 docs. |
| 2 | **Microsoft deprecates the Real-time Media SDK.** Microsoft has signaled the .NET-only Windows-only dependency is technical debt. Copilot Studio "agents in meetings" rumors. | Medium | High | Wrap SDK calls behind a thin interface in `MediaBot.Core`. Quarterly review of Microsoft Teams platform roadmap. |
| 3 | **Windows VMSS cost overruns.** Windows Azure SKUs are 1.4-1.8× Linux. If concurrent capacity per VM is lower than projected (10 is a guess), costs double. | Medium | Medium | Phase 2 load test before committing to capacity model. Reserve Instances on the floor. Build-vs-buy gate at end of Phase 1. |
| 4 | **Two-party-consent jurisdictions.** CA, IL, FL, MA, MD, MT, NH, PA, WA. Bot enters meeting with non-consenting parties → civil/criminal exposure. | Medium | High | Audible disclosure on join. Visible UI banner. Tenant pre-attests consent posture. Legal review before Phase 2 exit. |
| 5 | **Per-participant audio frame ordering / muxing bugs.** SDK delivers per-participant on separate callbacks; if buffering is wrong we get cross-talk in transcripts. Worse than DOM-mode failure because silent. | Medium | High | TDD on `MediaBot.Audio` with synthetic 3-speaker frame interleavings. Golden-set nightly. `attribution_source` column lets us A/B vs DOM. |

---

## 6. Cost Estimate

### Engineering effort

| Phase | Person-weeks |
|---|---|
| Phase 0 (spike) | 1 (1 backend eng + 0.25 legal/compliance) |
| Phase 1 (PoC) | 3 (1 .NET, 0.5 platform) |
| Phase 2 (staging) | 4 (1 .NET, 1 SRE, 0.5 backend) |
| Phase 3 (prod) | 2 (0.5 .NET, 0.5 SRE, 1 PM for Microsoft attestation) |
| **Total** | **8–12 person-weeks** (10 weeks p50, 12 weeks p80) |

### Runtime infra cost (per month, US East)

- Windows Server 2022 D4s_v5 VMSS, floor 2 RI / ceiling 10 on-demand: **~$650-$2,800/mo**
- Public IP + DNS + cert: **~$20/mo**
- VNet peering + egress: **~$50/mo**
- Datadog/Azure Monitor incremental: **~$100/mo**
- **Total infra delta: ~$820 to $3,000/mo** depending on concurrent load.

### Build vs Buy break-even

- Recall.ai historical pricing: ~$0.50-$1.00 per meeting-hour.
- 100 concurrent meetings × 30min × 8h × 22d = ~26,400 meeting-hours/mo.
- At $0.75/hr: **~$19,800/mo** vs build at **~$3,000 infra + $3,300 amortized eng = ~$6,300/mo**.
- **Build pays back at ~30-40 concurrent meetings sustained.**

---

## 7. Decision Points / Off-ramps

| Milestone | Decision | If we abandon |
|---|---|---|
| End Phase 0 (week 1) | Can we get admin consent and clear legal? | Graph API transcripts only. ~2 weeks. |
| End Phase 1 (week 4) | Does .NET bot deliver clean per-participant audio at PoC scale? Forecast volume above build-pays-back? | Buy Recall.ai. ~1.5 weeks integration. |
| End Phase 2 (week 8) | Are operational costs within projection? Reliability acceptable? | Hybrid: RTMP for enterprise only. |

---

## 8. Verify at Kickoff

1. Latest stable version of `Microsoft.Graph.Communications.Calls.Media` on NuGet.
2. Whether Microsoft has shipped a Linux-compatible media bot SDK (rumored Copilot Studio path).
3. Copilot Studio "agents in meetings" per-participant audio access.
4. Recall.ai current pricing.
5. Microsoft publisher attestation timeline.

---

## 9. Recommendation

**Hybrid build, with hard kill-gate at end of Phase 1.**

- Recall.ai is the safe buy and de-risks Phase 0 entirely (~1.5 weeks integration). At forecast volume (>40 concurrent sustained within 12 months), build pays back in ~8-10 months on infra alone, AND the strategic value of owning per-participant audio (custom VAD, custom hallucination filter, multi-provider STT routing — all already built in `captureBridge.js`, `vad.js`, `hallucinationFilter.js`, `transcribeProcessor.js`) is significant.
- The hybrid model (RTMP for consenting tenants, DOM for the rest) ships to enterprise immediately while preserving SMB self-serve onboarding.
- The hard kill-gate at end of Phase 1 means we spend at most ~4 person-weeks before committing. If the spike reveals Microsoft is shipping a cross-platform SDK, or Copilot Studio exposes the audio we need, or Recall pricing drops, we pivot cheaply.

**Do not** go all-in on Graph API transcripts only — post-meeting, lossy on guest speakers, would force ripping out live streaming.

**Do not** go all-in on Recall.ai without the spike — per-meeting-hour cost compounds and we lose multi-provider STT optionality (HealthScribe routing) that's a real differentiator in healthcare verticals.
