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

## SSO (backend, generic OIDC)
- `GET  /api/v1/auth/sso/status` → `{ enabled, provider? }` (`enabled` = an OIDC IdP is configured via env)
- `GET  /api/v1/auth/sso/authorize-url` → `{ url }` (302 target for the browser; embeds a signed, 10-min CSRF `state`)
- `POST /api/v1/auth/sso/exchange` `{ code, state }` → `SignupResponse` (`{ user, workspace, accessToken, refreshToken }`; finds-or-creates the user + a default workspace)
- Config is env-only, one IdP per deployment: `SSO_OIDC_CLIENT_ID`, `SSO_OIDC_CLIENT_SECRET`, `SSO_OIDC_AUTHORIZE_URL`, `SSO_OIDC_TOKEN_URL`, `SSO_OIDC_USERINFO_URL`, `SSO_OIDC_REDIRECT_URI` are all required for `enabled: true`; `SSO_OIDC_ISSUER` (informational), `SSO_OIDC_PROVIDER` (label returned by `/status`, default `"oidc"`), `SSO_OIDC_SCOPES` (default `"openid email profile"`) are optional.
- Because this is standard authorization-code OIDC (not a vendor SDK), **any OIDC-compliant IdP works** — Okta, Azure AD/Entra ID, and Google Workspace are all usable by pointing the `*_URL` vars at that IdP's discovery endpoints. See `docs/CONNECTOR-SETUP.md` for Okta/Azure AD walkthroughs.
- The web app owns the browser redirect and the httpOnly session cookies (same as password login); the state token is signed with `JWT_SECRET` and carries no PII.
- IdP userinfo must return an `email` claim (`sub`/`preferred_username`/`name` used for display name) — SSO login fails with `sso_no_email` otherwise.

## Calendar OAuth (backend, Google + Microsoft)
- Both providers use the same routes documented above under **Calendar**: `GET /api/v1/calendar/connect/{provider}` → `GET /api/v1/calendar/callback/{provider}`, `provider` ∈ `google` | `microsoft`.
- Per-provider env, both optional independently — a provider missing its client id/secret returns `501 calendar_provider_not_configured` from `connect`, so the stack still boots without either configured:
  - Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Scopes requested: `openid email https://www.googleapis.com/auth/calendar.readonly`. `access_type=offline&prompt=consent` is always sent so a refresh token comes back.
  - Microsoft: `MS_CLIENT_ID`, `MS_CLIENT_SECRET`. Scopes requested: `openid email offline_access Calendars.Read`. Uses the `common` multi-tenant authority (`login.microsoftonline.com/common/...`), so both personal Microsoft accounts and Azure AD work accounts can connect.
  - Shared: `CALENDAR_OAUTH_REDIRECT_BASE` (default `http://localhost:8000`) — the callback URL registered with the provider is always `{CALENDAR_OAUTH_REDIRECT_BASE}/api/v1/calendar/callback/{provider}`.
- The OAuth `state` param is a short-lived (10 min) JWT signed with `JWT_SECRET`, carrying the workspace + user id — this is how the callback (no auth header) knows which workspace to attach the connected account to.
- Access/refresh tokens are Fernet-encrypted at rest (`CALENDAR_TOKEN_KEY`); if unset, an ephemeral key is generated at boot (fine for dev, tokens won't survive a restart — set a real key in production).
- See `docs/CONNECTOR-SETUP.md` for exact OAuth-app creation steps for both providers.

## Outbound integrations (backend, recap delivery)
- `GET /api/v1/integrations` → `Integration[]` — one entry per known kind (`slack`, `email`, `notion`, `hubspot`, `salesforce`), merged with any stored config; kinds with no stored row come back `enabled: false, config: {}`.
- `PUT /api/v1/integrations` `{ kind, enabled, config }` → `Integration` — upserts the one config row for `(workspace, kind)`.
- `Integration { kind, enabled, config: object, implemented: boolean }`. All five kinds are fully implemented (`implemented` is always `true` today; the field exists for a future placeholder kind).
- On `meeting.completed`, the backend calls every **enabled + configured** integration for the workspace with a `MeetingRecap { meetingId, title, summary, keyPoints, actionItems }`; each provider's `deliver` never raises — failures come back as a non-fatal per-kind result and don't block the others.
- Config shape per kind (verified against `backend/src/integrations/*.py`, not assumed):
  - `slack`: `{ "webhookUrl": "https://hooks.slack.com/services/..." }`. Only accepts URLs starting with `https://hooks.slack.com/` (else treated as not configured). Posts a formatted header/summary/action-items Block Kit message. **No env vars are involved** — this is per-workspace config in the DB, not `SLACK_BOT_TOKEN`/`SLACK_SIGNING_SECRET` (those don't exist in this codebase; don't set them expecting them to do anything).
  - `email`: `{ "to": ["a@example.com", ...] }` (or `"recipients"`; a comma-separated string also works). Sends via SMTP using `SMTP_HOST`/`SMTP_PORT`/`SMTP_USERNAME`/`SMTP_PASSWORD`/`SMTP_FROM`/`SMTP_USE_TLS`; if `SMTP_HOST` is unset it logs the rendered recap instead of sending (dev-friendly, always reports `delivered: true`).
  - `notion`: `{ "token": "secret_...", "databaseId": "..." }` (camelCase `databaseId` or snake_case `database_id`; `apiKey`/`api_key` also accepted for the token). Creates one page in the given database via `POST https://api.notion.com/v1/pages`.
  - `hubspot`: `{ "accessToken": "..." }` (or `access_token`). Creates a CRM note via `POST https://api.hubapi.com/crm/v3/objects/notes`.
  - `salesforce`: `{ "instanceUrl": "https://yourorg.my.salesforce.com", "accessToken": "..." }` (or snake_case equivalents). Creates a completed `Task` via the REST API (`/services/data/v59.0/sobjects/Task`); `instanceUrl` is the org's own API base — this integration does not do the OAuth handshake itself, it expects a token already minted elsewhere (e.g. a Salesforce Connected App client-credentials/JWT flow run out of band).

## Webhooks (backend, outbound event delivery)
Developer-facing outbound webhooks — a workspace registers HTTPS endpoints and gets signed POSTs as product events happen. This is the building block a self-hoster would use to wire up Zapier/n8n or a custom receiver; it's independent of the `integrations` recap-delivery system above.
- `GET    /api/v1/webhooks/events` → `{ eventTypes: string[] }` — the catalog: `meeting.started`, `meeting.completed`, `transcript.ready`, `summary.ready`, `highlight.created`, `comment.created`.
- `POST   /api/v1/webhooks` `{ url, description?, eventTypes?: string[] }` → `WebhookEndpoint` (201). `url` must be `https://` and pass an SSRF guard (rejects `localhost`/`*.internal`/`*.local` hostnames and private/loopback/link-local/reserved/multicast IP literals — registration-time only, not a substitute for network-level egress filtering). `eventTypes: []` (default) subscribes to every event. The signing secret is generated server-side (`whsec_` + 32 url-safe bytes) and returned once in the response.
- `GET    /api/v1/webhooks` → `WebhookEndpoint[]`; `GET /api/v1/webhooks/{id}` → one; `PATCH /api/v1/webhooks/{id}` `{ url?, description?, eventTypes?, enabled? }` → updated; `DELETE /api/v1/webhooks/{id}` → `204`.
- `POST   /api/v1/webhooks/{id}/test` → `WebhookDelivery` (201) — enqueues a synthetic `webhook.test` event to that endpoint immediately.
- `GET    /api/v1/webhooks/{id}/deliveries` → `{ items: WebhookDelivery[], total }` — the delivery log for one endpoint.
- `POST   /api/v1/webhooks/deliveries/{id}/redeliver` → `202 { requeued: true }` — puts a delivery back on the queue for immediate retry.
- `WebhookEndpoint { id, url, description?, eventTypes: string[], secret, enabled, consecutiveFailures, createdAt, updatedAt }`
- `WebhookDelivery { id, endpointId, eventId, eventType, status: 'pending'|'delivered'|'failed', attempts, maxAttempts, responseStatus?, error?, nextAttemptAt?, deliveredAt? }`

### Signing scheme (HMAC-SHA256, Stripe/Svix-style)
- Every delivery POST carries an `X-Parlor-Signature: t=<unix ts>,v1=<hex hmac>` header.
- The signed string is `"{timestamp}.{raw request body}"`, HMAC-SHA256'd with the endpoint's `secret`.
- To verify: recompute the same HMAC with your stored secret, compare in constant time, and reject if `|now - t|` exceeds a ~5-minute tolerance (replay defense). The backend's own `verify_signature` helper (`backend/src/webhooks/signing.py`) does exactly this and is a useful reference implementation for receivers in other languages.
- Payload body: `{ "id": "<eventId>", "type": "<eventType>", "createdAt": "<ISO-8601>", "data": { ... } }`.

### Retry behavior
- A background dispatcher polls every 5s, claims due rows with `FOR UPDATE SKIP LOCKED` (safe with multiple API replicas), and delivers up to 20 at a time with 8-way concurrency.
- Exponential backoff between attempts: 1min → 5min → 30min → 2h → 6h, then holds at 6h for any further attempts, up to `maxAttempts` (default 6) before a delivery is marked `failed` for good (use `redeliver` to force another attempt after that).
- Each *terminal* delivery failure (i.e. one that exhausts `maxAttempts`) increments the endpoint's `consecutiveFailures`; a successful delivery resets it to 0. After **15** consecutive terminal failures the endpoint is auto-disabled (`enabled: false`, `disabledAt` set) — re-enable it with `PATCH .../{id} { enabled: true }` once the receiver is fixed.

## MCP server (separate)
- Exposes tools over MCP: `search_meetings`, `get_meeting`, `get_transcript`, `ask_meetings` — wrapping the backend product API with an API key. Lets ChatGPT/Claude query the meeting knowledge base.

## Runtime (docker-compose, dev)
- `postgres` (with `pgvector` extension) · `backend` (FastAPI :8000) · `ai-service` (FastAPI :8100) · `web` (Next :3000) · optional `redis`.
- Web → backend via `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`). Backend → ai-service via `AI_SERVICE_URL` (default `http://localhost:8100`).
