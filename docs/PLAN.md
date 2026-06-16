# Meeting SaaS — Transformation Plan

> Goal: turn the copied `meeting-joiner` bot + transcription stack into a standalone,
> Read.ai / tl;dv–class AI meeting assistant with a distinctive **sage-on-white + brass**,
> YC-grade product surface.

_Last updated: 2026-06-16_

---

## 1. Where we are today

We copied two things into this independent repo:

- **`backend/`** — a production-grade meeting-capture service derived from open-source **Vexa**.
  Python/FastAPI + Node. **Self-built bots already work** for **Zoom (SDK), Google Meet & MS Teams (Playwright)**,
  with warm-pool Kubernetes orchestration, rejoin/recovery state machine, duplicate detection,
  scheduled dispatch, and **real-time streaming transcription** (Deepgram-class via AWS Transcribe / Azure / Whisper).
- **`frontend/`** — a large Next.js 14 (App Router) + Tailwind + Radix console. It is **not** a dedicated
  meeting product; it's an enterprise "AIops" platform (copilot, knowledge base, voice agents, training…)
  that happens to contain a `/meetings` domain with a working live-transcript view and a WaveSurfer audio player.

### What already EXISTS (strong foundation)
- Multi-platform bot join (Zoom/Meet/Teams) — **this is real IP; competitors buy Recall.ai for this.**
- Real-time + batch transcription, speaker attribution, participant capture.
- Meeting lifecycle: schedule → join → rejoin-on-failure → complete, with full session tracking.
- Postgres data model (`meeting_joiner`, `meeting_sessions`), transcript JSON with incremental `since` cursor.
- Frontend: live transcript component, post-call transcript, audio waveform player, WebSocket streaming, auth.

### What is MISSING / STUB (the product gap)
| Capability | Status | Notes |
|---|---|---|
| LLM summaries | ⚠️ stub | returns "N participants, M entries" — not real |
| Action items / key points | ⚠️ stub | keyword regex only |
| Chat-with-meeting (RAG) | ❌ absent | no embeddings, no vector store, no endpoint |
| Cross-meeting search | ❌ absent | no full-text or semantic search |
| Calendar auto-join | ⚠️ instrumented only | metrics exist, no OAuth/poller wired |
| Downstream integrations (Slack/Notion/CRM/email) | ❌ absent | none delivered |
| Auth / multi-tenancy enforcement | ⚠️ weak | `org_id` not enforced; no API keys; no RBAC |
| Shareable links / clips / highlights | ❌ absent | no public view, no clipping |
| Proactive agent (acts, not just summarizes) | ❌ absent | the 2026 wedge |
| Brand / design system | ❌ generic | navy/iris enterprise theme; needs sage/brass reskin |

---

## 2. Target product (what we're building toward)

A focused AI meeting assistant that, per meeting:
1. **Auto-joins** from your connected calendar (Google + Microsoft) across Zoom/Meet/Teams.
2. Shows a **live "people talking" view** — active-speaker, real-time transcript, in-meeting cited Q&A.
3. Produces **AI summary + action items + chapters** within ~30s of the call ending.
4. Lets you **chat with the meeting** (and across all meetings) with cited, timestamped answers.
5. **Acts**: drafts the follow-up email, writes the CRM/Linear/Jira record, pushes to Slack/Notion.
6. Is **shareable**: public links, clips, highlights.

### Competitive parity target (from research)
- **Table-stakes (must ship):** calendar auto-join, multi-platform capture, live+post transcription,
  diarization, recording+playback, AI summary/actions/chapters, chat-with-meeting w/ citations,
  follow-up email, core integrations (Slack/Notion/HubSpot/Gmail/Outlook), shareable links+clips,
  search, consent/retention controls, free tier + per-seat pricing.
- **Our differentiator wedge (LOCKED):**
  - **B5 — Rich live meeting view** with real-time active-speaker + in-meeting cited Q&A. _Signature surface._
  - **B7 — MCP server** exposing the meeting knowledge base to ChatGPT/Claude.
  - **B1 — Botless desktop capture** (Granola-style system-audio) as a second capture mode alongside our bots.
  - _(Proactive agent deferred to a later phase — not in the initial wedge.)_

---

## 3. Design direction — "Verdant" (sage-on-white, brass, YC-grade)

Full spec + tokens in [`docs/DESIGN-SYSTEM.md`](./DESIGN-SYSTEM.md). Headlines:
- **Primary brand:** grounded olive-sage `--sage-600`. **Text:** warm olive-ink (never pure black).
- **Accent:** brass/gold `--gold-500`, used like jewelry — hairlines, focus rings, active-speaker glow, one CTA.
- **Type:** Fraunces (display, warm-editorial) + Inter (body, precise). Mono for timestamps.
- **Feel:** layered creams, warm-tinted multi-layer shadows, subtle grain, gold hairline dividers, refined motion.
- **Signature surface:** the live-transcript view — active speaker gets a pulsing brass ring; speakers tinted
  from the sage scale (not rainbow); AI-extracted items shown as editorial margin annotations.

---

## 4. Key architecture decisions (LOCKED 2026-06-16)

1. **Bots: KEEP self-built.** We already have working Zoom/Meet/Teams capture — the expensive part everyone
   else buys. Keep it as our cost/IP moat; revisit Recall.ai only if maintenance burden bites.
2. **Frontend: BUILD FROM SCRATCH.** A brand-new Next.js app with its **own UI, app shell, auth, and API
   client** — reusing **nothing** from the aiops frontend (which has been removed from this repo). The
   meeting-joiner **backend** (bots + transcription) is kept and gets a clean product API/BFF on top.
3. **AI layer: MULTI-PROVIDER ROUTING.** An `ai-service` (summaries/actions/chapters/chat) behind a provider
   abstraction routing across **Claude + OpenAI** by task/cost. Embeddings + **pgvector** for RAG (Postgres
   already in stack → no new datastore).
4. **Auth/tenancy: NEW, OWNED.** Real workspaces/users/sessions, API keys, and strict `org_id`/workspace
   enforcement on every endpoint — built fresh for this product, not inherited.

---

## 5. Gap → workstream mapping (phased)

### Phase 0 — Foundation (week 1)
- Carve out the dedicated frontend (strip non-meeting modules); stand up `Verdant` design tokens + base components.
- Wire `backend` to run standalone (compose: Postgres + pgvector, API, transcriber-worker, sidecar).
- Real auth: workspaces, users, sessions, API keys; enforce `org_id` on all endpoints.

### Phase 1 — Core product (weeks 1–3)
- **Calendar auto-join:** Google + Microsoft OAuth, event poller, auto-dispatch bot to upcoming meetings.
- **AI service:** summary + action items + chapters (real LLM, JSON-schema extraction), shown in UI.
- **Live meeting view (B5):** active-speaker, real-time transcript polish, in-meeting Q&A.
- **Recording storage + playback:** object storage (S3/Azure), signed-URL player synced to transcript.

### Phase 2 — Intelligence & reach (weeks 3–5)
- **Chat-with-meeting (RAG):** pgvector embeddings, retrieval + cited answers, single + cross-meeting.
- **Search:** full-text + semantic.
- **Proactive agent (B2):** auto-draft recap email; typed tool-calls to write CRM/Linear/Jira; human-in-loop confirm.
- **Integrations:** Slack, Notion, HubSpot/Salesforce, Gmail/Outlook send.

### Phase 3 — Collaboration & polish (weeks 5–6)
- **Sharing:** public tokenized links (no-account view), clips/highlights, export (PDF/MD/SRT).
- **MCP server (B7).**
- Consent/retention controls, billing tiers, observability dashboards, hardening + tests (80% target).

---

## 6. Parallel execution model (how we build fast without losing quality)

Independent workstreams run concurrently via specialized agents, each gated by review:
- **Stream A — Design/Frontend foundation:** tokens, component library, app carve-out, theming.
- **Stream B — AI service:** summaries/actions/chapters/chat/RAG (Claude + pgvector).
- **Stream C — Calendar + integrations:** OAuth, pollers, Slack/Notion/CRM/email connectors.
- **Stream D — Auth/tenancy + platform:** workspaces, API keys, storage, compose/runtime.
Each stream: `code-architect` → implement → `code-reviewer` + `security-reviewer` → tests (TDD, 80%+).
Backend changes reviewed by `python-reviewer`; frontend by `react-reviewer` + `typescript-reviewer`.

---

## 7. Decisions resolved
1. ✅ Keep self-built bots.
2. ✅ Frontend built **from scratch** — own UI/app/auth/API, no aiops reuse (copied `frontend/` removed).
3. ✅ Wedge = **live meeting view + MCP server + botless desktop capture** (proactive agent deferred).
4. ✅ LLM = **multi-provider routing** (Claude + OpenAI).
5. ⏳ **Product name / brand** still open — design spec uses "Verdant" as a placeholder.

## 8. Repo layout (target)
```
Meeting SaaS/
├── backend/      # kept: meeting-joiner bots + transcription (Python/FastAPI + Node)
├── web/          # NEW from-scratch Next.js app (own UI/auth/API client) — replaces removed frontend/
├── ai-service/   # NEW summaries/actions/chapters/chat + multi-provider routing + pgvector RAG
├── mcp/          # NEW MCP server exposing the meeting knowledge base
└── docs/         # PLAN.md, DESIGN-SYSTEM.md
```
