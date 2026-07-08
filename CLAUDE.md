# CLAUDE.md

## Code comments

Default to no comments. Well-named identifiers should carry the "what"; only
add a comment when it captures a non-obvious "why" (a hidden constraint, a
workaround for a specific bug, an invariant a reader would otherwise miss).
Never restate what the code already says — that's wasted tokens to write, read,
and keep in sync, not documentation.

## Working across multiple sessions/agents on this repo

More than one Claude Code session may be working on this repo at the same
time, without shared memory between them — git is the only thing they
actually coordinate through. This has already happened here for real: one
session's merge reintroduced a factually wrong "optional billing" claim into
the README because it wasn't aware billing had just been deliberately
removed by a different session.

- **Before pushing, always `git fetch` first and diff against the remote.**
  A rejected push (`! [rejected] ... (fetch first)`) means another session
  has already pushed — stop, fetch, and read what actually changed before
  doing anything else.
- **Never force-push to resolve a rejected push without investigating first.**
  Do a real `git merge` so both sides' work survives, then resolve conflicts
  by reading both versions.
- **Don't trust another session's commit messages or doc edits at face
  value — verify against the actual current files**, same as you'd verify
  your own subagents. A concurrent session may be working from stale
  context it never re-fetched.
- **This repo has explicit, deliberate constraints from its OSS-extraction
  work — treat these as authoritative and re-check them after any merge**,
  since a concurrent session unaware of them can silently reintroduce what
  they undo:
  - **No billing, payment, or pricing concept anywhere.** `backend/src/billing/`
    was deliberately deleted; do not recreate it or describe it as present.
  - **No fabricated social proof** (fake customer names/logos, fake company
    entities in copyright lines) and **no dead links** — every link and claim
    in public-facing pages (README, landing page, footer) must point
    somewhere real or be removed.
  - **No internal-only content**: no internal roadmap docs, codenames,
    internal domains, or company-process files (the pattern that caused a
    real leak here: `STATE.md`, internal engineering docs naming real
    customers/PRs). If you find something like this, remove it, don't just
    flag it.
  - Full history of what's been checked/fixed lives in a `docs/OSS-LAUNCH-ISSUES-TRACKER.md`
    kept in the separate closed-source product this was extracted from — that
    tracker itself must never be copied into this repo (it documents past
    vulnerabilities; irrelevant and inappropriate for a public repo once fixed).
- **Re-run the full test suite after any merge**, even a clean auto-merge.
