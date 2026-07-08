# Roadmap

This is a short, honest snapshot of where Parlor actually is, not a
marketing document. "Shipped" means it's in `main` and exercised by tests or
the cookbook; "in progress" means a change is actively landing but not yet
confirmed merged/verified; "planned" is aspirational and unscheduled.

See [`CHANGELOG.md`](./CHANGELOG.md) for the versioned release history and
[`docs/OPERATIONS.md`](./docs/OPERATIONS.md) for day-2 self-hosting concerns
(backup/restore, sizing).

## Shipped

- **Botless local capture** (`desktop-capture/`) — no bot joins the call;
  verified end to end in `cookbook/01-botless-capture/`.
- **Optional bot-join capture** for Zoom (SDK), Google Meet, and Microsoft
  Teams, for anyone who'd rather dispatch a bot than run local capture.
- **Zero-API-key mock mode** (`AI_MODE=mock`) — the full stack runs and
  produces deterministic summaries/RAG answers with no LLM key; verified in
  `cookbook/02-mock-mode-summary-and-ask/`.
- **Cross-meeting RAG "Ask"** (`web/app/(app)/search/`) — chat with a single
  meeting or across your whole workspace, backed by pgvector.
- **Speaker diarization** (`backend/src/speakers/`).
- **Calendar auto-join** (Google Calendar and Microsoft Calendar OAuth).
- **Outbound webhooks** (HMAC-signed, with retry) and **CRM/recap delivery**
  (Slack, Notion, HubSpot, Salesforce).
- **Optional enterprise SSO** (generic OIDC, `backend/src/sso/`).
- **Audit logging and data retention controls**, including a tombstone
  window and legal-hold export.
- **MCP server** (`mcp/`) exposing `search_meetings`/`get_meeting`/
  `ask_meetings` to Claude Desktop, Claude Code, ChatGPT, and other clients.
- **Helm chart** (`deploy/helm/`) for the separated API/bot-worker topology.
- **PyPI packaging metadata** for `desktop-capture/` (`parlor-capture`) with
  a Trusted-Publishing GitHub Actions workflow — not yet actually published
  to PyPI (see Planned).
- **MIT license** for the whole repository (previously FSL-1.1-Apache-2.0).

## In progress

These are landing in parallel with this roadmap and may or may not be merged
yet depending on when you're reading this — check `CHANGELOG.md` and git
history before relying on either:

- **PWA support** for the web app (installable, offline shell).
- **Additional export formats** for meeting notes/transcripts beyond what's
  in the current API contract.
- **Clean-room rewrite of the bot-join automation scripts** (removing any
  third-party-derived code in favor of independently written equivalents) —
  see `MEET-BOT.md` and `THIRD_PARTY_NOTICES.md` once that lands.

## Planned (unscheduled)

- **Publish `parlor-capture` to PyPI** — the packaging and Trusted Publisher
  workflow exist; the one-time `pypi.org` project setup is a manual step
  nobody has done yet.
- **Verify live-LLM mode end to end** — the code paths for real
  `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` usage exist but haven't been exercised
  against a live provider in this environment; only mock mode is currently
  verified.
- **Ephemeral, no-signup hosted demo** on Google Cloud, modeled on Uptime
  Kuma's public demo (auto-resets frequently, no real user data persists).
  This is explicitly separate from a hosted/managed product — see
  [`deploy/gcp-demo/`](deploy/gcp-demo/) for the (not-yet-executed)
  deployment plan. Self-hosting remains the primary, supported way to run
  Parlor for real use.
- **Real-time collaborative notes** during a live meeting (multiple people
  editing the same notes as the call happens) — not started.
- **More export targets** beyond whatever lands in the in-progress export
  work above (e.g. additional destinations/formats based on user requests).
- **Non-macOS botless capture** — `desktop-capture/` is macOS-first today;
  Windows/Linux support is unscheduled.
- **Long-lived release branches** — `SECURITY.md` currently only backports
  fixes to `main`; a real support-branch policy is unscheduled until there's
  a reason for one.

## Not planned

- **A persistent hosted or managed edition of Parlor.** Self-hosting is the
  point of this project. See the README's "What's different from FuturePath
  AI's other products?" section.
- **Billing/payments/pricing of any kind in this repository** — deliberately
  removed from the codebase this was extracted from and out of scope for
  reintroduction here.
