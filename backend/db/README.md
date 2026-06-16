# meeting-joiner — database bundle

This directory ships everything a standalone consumer needs to provision the database the bot writes to.

## Files

| File | Purpose |
|---|---|
| `bootstrap.sql` | Idempotent DDL. Run once against a fresh Postgres. Re-running is safe. |
| `bootstrap.test.sql` | Drop-and-recreate variant. **CI only.** Do not run against any non-test database. |
| `extract-bootstrap.mjs` | Drift guard. Asserts `bootstrap.sql` matches the monorepo's `core/core/db/prisma/schema.prisma`. Run in CI; fails on drift. |
| `../src/scripts/install_schema.py` | Pod-friendly installer. Uses `asyncpg` and `pgqueuer`; no `psql` binary required. |

## Standalone deployment

```bash
psql "$DATABASE_URL" -f db/bootstrap.sql
```

For deployments that do not ship `psql`, use the Python installer instead:

```bash
python3 src/scripts/install_schema.py
```

The installer reads `DIRECT_URL` first, then `DATABASE_URL`. It applies `bootstrap.sql`, installs the PGQueuer schema, and takes a Postgres advisory lock so concurrent pods do not race each other.

By default the bot writes to `public.meeting_joiner` and installs PGQueuer into `pgqueuer`. For a shared database where another application owns `public`, set:

```bash
MEETING_JOINER_SCHEMA=meeting_joiner
MEETING_JOINER_PGQUEUER_SCHEMA=meeting_joiner_pgqueuer
```

Schema names must be lowercase PostgreSQL identifiers (`[a-z_][a-z0-9_]*`). The optional `org_id` / `meeting_id` foreign keys are skipped automatically if those parent tables don't exist in the active Meeting Joiner schema.

## Monorepo deployment

The monorepo uses Prisma migrations at `core/core/db/prisma/migrations/`. Do NOT run `bootstrap.sql` against the monorepo database in the default `public` schema — Prisma manages that schema there.

## Drift guard

When someone in the monorepo adds a column to `meeting_joiner` in `schema.prisma`, this bundled `bootstrap.sql` must be updated in the same PR. CI enforces it:

```bash
node db/extract-bootstrap.mjs
```

Exit 0 = in sync. Exit 1 = update one of the two files.
