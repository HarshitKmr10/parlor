# API Contract (v1) — single source of truth

All three surfaces (backend, ai-service, web) build against this. Keep it in sync if it changes.

## Conventions
- Backend product API base: **`/api/v1`**. JSON. Auth: **Bearer JWT** (access token), workspace-scoped.
- Envelope: success → the resource/array directly (2xx). Error → `{ "error": { "code": string, "message": string, "details"?: any } }` with appropriate 4xx/5xx.
- Pagination: `?limit=&offset=`; list responses → `{ "items": T[], "total": number, "limit": number, "offset": number }`.
- IDs are UUID strings. Timestamps are ISO-8601 UTC strings. camelCase in JSON.
- Web stores tokens in **httpOnly cookies** (never localStorage), set by Next route handlers that proxy the backend.

## Auth & tenancy (backend)
- `POST /api/v1/auth/signup` `{ email, password, name, workspaceName }` → `{ user, workspace, accessToken, refreshToken }`
- `POST /api/v1/auth/login` `{ email, password }` → `{ user, accessToken, refreshToken }`
- `POST /api/v1/auth/refresh` `{ refreshToken }` → `{ accessToken, refreshToken }`
- `POST /api/v1/auth/logout` → `204`
- `GET  /api/v1/auth/me` → `{ user, workspaces: Workspace[], currentWorkspace }`
- `GET/POST/DELETE /api/v1/workspaces/{id}/api-keys` → manage API keys (key shown once on create)
- Header `X-Workspace-Id` selects active workspace; server validates membership on every request.

### Entities
- `User { id, email, name, createdAt }`
- `Workspace { id, name, slug, role }`  (role = owner|admin|member for the current user)
- `Meeting { id, workspaceId, title, platform: 'zoom'|'meet'|'teams'|'desktop', meetingUrl, status: 'scheduled'|'joining'|'ongoing'|'completed'|'failed', scheduledAt?, startedAt?, endedAt?, durationSec?, participants: Participant[], hasSummary, hasRecording, createdAt }`  (`platform: 'desktop'` = botless desktop-capture session)
- `Participant { id, name, email?, joinedAt?, leftAt? }`
- `TranscriptSegment { id, speakerId, speakerName, text, tStartSec, tEndSec, createdAt }`
- `MeetingInsights { summary: string, keyPoints: string[], actionItems: ActionItem[], chapters: Chapter[] }`
- `ActionItem { id, text, assignee?, dueDate?, done }`
- `Chapter { id, title, tStartSec, tEndSec }`
- `Citation { segmentId, speakerName, text, tStartSec }`
- `CalendarAccount { id, provider: 'google'|'microsoft', email, autoJoin: boolean, connectedAt }`

## Meetings (backend, workspace-scoped)
- `GET  /api/v1/meetings?status=&limit=&offset=` → `{ items: Meeting[], total, limit, offset }`
- `POST /api/v1/meetings` `{ meetingUrl, title?, scheduledAt?, botName? }` → `Meeting` (creates + dispatches bot via existing joiner)
- `POST /api/v1/meetings/botless` `{ title?, source?: 'desktop' }` → `Meeting` (creates a workspace-scoped meeting WITHOUT a bot: synthetic `meetingUrl` `desktop://<workspaceId>/<ts>`, `platform: 'desktop'`, `status: 'ongoing'`, `botName` null). Used by the desktop-capture client.
- `GET  /api/v1/meetings/{id}` → `Meeting & { insights?: MeetingInsights }`
- `GET  /api/v1/meetings/{id}/transcript?since=<ISO>` → `{ items: TranscriptSegment[], lastSegmentAt }`
- `POST /api/v1/meetings/{id}/transcript` `{ segments: TranscriptSegment[] }` → `{ appended: number, lastSegmentAt }` (appends externally-captured segments to the meeting transcript; out-of-order/missing `createdAt` are clamped so the `since` cursor stays monotonic). Workspace-scoped, auth required.
- `WS   /api/v1/meetings/{id}/live` → server pushes `{ type: 'segment', segment }` and `{ type: 'active_speaker', speakerId }` and `{ type: 'status', status }`
- `POST /api/v1/meetings/{id}/complete` → finalize `ongoing → completed` → `Meeting` (idempotent; fires the embed+summarize completion pipeline). Use for botless meetings.
- `DELETE /api/v1/meetings/{id}` → stop/cancel → `Meeting` (also fires the completion pipeline on the `→ completed` transition)
- `POST /api/v1/meetings/{id}/summarize` → triggers ai-service; returns `MeetingInsights` (also stored)
- `POST /api/v1/meetings/{id}/ask` `{ question, history?: {role,content}[] }` → `{ answer, citations: Citation[] }` (proxies ai-service `/chat`)

## Calendar (backend)
- `GET  /api/v1/calendar/accounts` → `CalendarAccount[]`
- `GET  /api/v1/calendar/connect/google` → 302 to Google OAuth; callback `GET /api/v1/calendar/callback/google`
- `GET  /api/v1/calendar/connect/microsoft` → 302 to MS OAuth; callback `GET /api/v1/calendar/callback/microsoft`
- `PATCH /api/v1/calendar/accounts/{id}` `{ autoJoin }` → `CalendarAccount`
- A poller scans connected calendars for upcoming meetings and auto-dispatches bots when `autoJoin` is on.

## AI service (internal HTTP, base `/`, called by backend; not public)
- `POST /summarize` `{ meetingId, meta: { title, participants }, segments: TranscriptSegment[] }` → `MeetingInsights`
- `POST /embed` `{ workspaceId, meetingId, segments: TranscriptSegment[] }` → `{ embedded: number }` (stores in pgvector)
- `POST /chat` `{ workspaceId, meetingId?, question, history? }` → `{ answer, citations: Citation[] }` (RAG over embeddings; meetingId optional = cross-meeting)
- Provider routing: env `AI_PROVIDER_ORDER` (e.g. `anthropic,openai`), keys `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`; cheap model for live/embed, premium for final summary + chat.

## MCP server (separate)
- Exposes tools over MCP: `search_meetings`, `get_meeting`, `get_transcript`, `ask_meetings` — wrapping the backend product API with an API key. Lets ChatGPT/Claude query the meeting knowledge base.

## Runtime (docker-compose, dev)
- `postgres` (with `pgvector` extension) · `backend` (FastAPI :8000) · `ai-service` (FastAPI :8100) · `web` (Next :3000) · optional `redis`.
- Web → backend via `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`). Backend → ai-service via `AI_SERVICE_URL` (default `http://localhost:8100`).
