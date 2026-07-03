## What changed

<!-- One or two sentences describing the change. -->

## Why

<!-- The problem this solves or the use case it enables. Link an issue if one exists. -->

## How this was tested

<!-- e.g. `cd backend && PYTHONPATH=. pytest -q`, `cd web && pnpm test:e2e`, manual steps. -->

## Checklist

- [ ] Tests pass locally (`scripts/loop-gate.sh`, or the relevant subset — see [`CONTRIBUTING.md`](../CONTRIBUTING.md))
- [ ] New behavior has test coverage; existing tests still pass
- [ ] Commits are signed off (DCO — `git commit -s`, see [`CONTRIBUTING.md`](../CONTRIBUTING.md))
- [ ] No billing/pricing surface reintroduced (Parlor's billing/Stripe surface was
      deliberately removed for the OSS release — see `git log --grep="billing"`)
- [ ] If this touches auth, webhooks, RBAC, or anything else security-sensitive,
      I've checked [`SECURITY.md`](../SECURITY.md)'s scope and considered whether
      it should be reported/reviewed privately instead of via a public PR
- [ ] Docs updated if this changes a public API, `.env.example`, or a Make target
