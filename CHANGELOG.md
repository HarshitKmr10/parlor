# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-07-09

Initial public release. This is a fresh extraction of the meeting-assistant
platform into its own standalone open-source repository — it has not
previously been tagged or versioned, so this entry describes the
as-extracted state honestly rather than reconstructing a history that
didn't exist as a public project before now.

### Added
- Full meeting-assistant stack: auth/workspaces/RBAC, meeting capture via a
  server-side joiner bot (Zoom/Meet/Teams), transcript capture, AI summarize
  (key points/action items/chapters) and cross-meeting RAG "Ask", calendar
  auto-join (Google/Microsoft OAuth), outbound recap integrations, webhooks,
  rate limiting, idempotency, audit log, and data retention/compliance
  controls.
- `desktop-capture/` — a botless local capture client (`parlor-capture`) that
  streams a transcript to the backend without a bot joining the call; ships
  as an installable Python package (`pip install -e .` today; PyPI packaging
  metadata added in this release, see below).
- `ai-service` runs in a zero-API-key mock mode (`AI_MODE=mock`) by default,
  producing deterministic structured summaries and RAG answers with no LLM
  provider key configured — see `cookbook/`.
- `mcp/` — a stdio MCP server exposing `search_meetings`/`get_meeting`/
  `ask_meetings` over the same backend.
- `deploy/helm/` — a Helm chart for the separated backend/bot-worker
  deployment topology.
- `cookbook/` — runnable examples demonstrating botless capture and
  zero-API-key mock-mode summarize/Ask, each verified end to end against a
  live local stack (see each example's README for the captured output).
- PyPI packaging for `desktop-capture/` (`parlor-capture`): corrected
  project metadata, an MIT `LICENSE` scoped to that package, and a
  `publish-pypi-desktop-capture.yml` GitHub Actions workflow using PyPI
  Trusted Publishing (OIDC) — not yet published; the one-time trusted
  publisher setup on pypi.org is a manual step for whoever owns the PyPI
  project.

### Known limitations at this release
- Self-hosted only; no hosted/managed offering.
- No billing/payment/pricing concept anywhere in this codebase (intentionally
  removed from the upstream project this was extracted from).
- Live LLM-provider mode (a real `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`) has
  working code paths but was not exercised end to end while preparing this
  release — only mock mode was verified in this environment.
- `desktop-capture`'s botless-ingest path in its own README predates the
  current public API contract (`docs/API-CONTRACT.md` now documents public
  `POST /api/v1/meetings/botless` and `POST /api/v1/meetings/{id}/transcript`
  endpoints); the `cookbook/01-botless-capture` example uses the current
  contract directly.

[Unreleased]: https://github.com/HarshitKmr10/parlor/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/HarshitKmr10/parlor/releases/tag/v0.1.0
