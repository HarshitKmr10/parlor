# Contributing to Parlor

Thanks for considering a contribution. This is a small, self-hosted project
maintained on a best-effort basis — please keep pull requests focused and
give maintainers a reasonable amount of time to respond.

## Before you start

- For anything beyond a small fix, open an issue first to discuss the
  approach. It saves everyone time if the direction turns out to be a no.
- This project is deliberately **self-hosted only** (see the README). PRs
  that add a hosted trial, telemetry-by-default, or anything that nudges
  toward a managed/SaaS offering are out of scope — see [`LICENSE`](./LICENSE)
  for why.

## Running the stack locally

```bash
cp .env.example .env
make up-api        # backend + ai-service + web + postgres, mock AI mode
# or
make up             # full stack including the real bot-join worker
```

See the [README](./README.md) for the full command reference and
[`backend/docs/BOT-RUNTIME.md`](backend/docs/BOT-RUNTIME.md) for how the bot
dispatch modes work.

## Running the tests

```bash
# Backend (pytest needs backend/ on PYTHONPATH — there's no pythonpath
# setting in pyproject.toml):
cd backend && PYTHONPATH=. .venv/bin/pytest -q

# ai-service
cd ai-service && .venv/bin/pytest -q

# desktop-capture
cd desktop-capture && .venv/bin/pytest -q

# web (Playwright E2E — needs the stack up, see above)
cd web && pnpm test:e2e
cd web && pnpm lint
```

`scripts/loop-gate.sh` runs the backend and web suites together and is the
objective bar a change needs to clear:

```bash
scripts/loop-gate.sh            # backend pytest + web Playwright
scripts/loop-gate.sh backend    # backend only
SKIP_WEB=1 scripts/loop-gate.sh # skip Playwright if the stack isn't up
```

A small number of backend tests are pre-existing, environment-dependent
failures (they need a live `meeting-worker:9000` Docker DNS host) — the gate
script whitelists those by file. Any other failure, or a collection/import
error, is a real regression.

## Submitting a pull request

1. Fork the repo and create a branch for your change.
2. Write tests for new behavior; keep existing tests green.
3. Keep commits focused — one logical change per PR is easier to review than
   a bundle of unrelated fixes.
4. Open the PR against `main` with a clear description of what changed and
   why, and a short test plan.

## Developer Certificate of Origin (DCO)

This project uses the [DCO](https://developercertificate.org/), not a CLA.
Sign off every commit to certify you wrote it (or have the right to submit
it) by adding `-s` to your commit:

```bash
git commit -s -m "fix: description of the change"
```

That adds a `Signed-off-by: Your Name <you@example.com>` trailer to the
commit message. PRs with unsigned commits will be asked to amend before
merge.

## Reporting security issues

Please do **not** open a public issue for security vulnerabilities — see
[`SECURITY.md`](./SECURITY.md).
