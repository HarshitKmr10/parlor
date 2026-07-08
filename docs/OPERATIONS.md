# Operations: backup, restore, and resource sizing

Everything a self-hoster actually cares about — meetings, transcripts,
summaries, embeddings, auth/workspace data — lives in one place: the
`parlor_pgdata` named Docker volume backing the shared Postgres+pgvector
service (`postgres` in `docker-compose.yml`). Nothing else in the stack is
stateful. This doc covers backing that volume up and restoring it, plus
approximate resource sizing for the two ways to run Parlor.

## Backup

Use `pg_dump` against the running `postgres` container rather than snapshotting
the raw volume — it's consistent, portable across Postgres/pgvector patch
versions, and doesn't require stopping the stack.

```bash
# Custom-format dump (compressed, supports parallel restore).
docker compose exec -T postgres pg_dump \
  -U "${POSTGRES_USER:-meeting}" -d "${POSTGRES_DB:-meeting}" \
  -F c -f /tmp/parlor-backup.dump
docker compose cp postgres:/tmp/parlor-backup.dump ./parlor-backup-$(date +%F).dump
docker compose exec -T postgres rm /tmp/parlor-backup.dump
```

For a plain-SQL dump instead (easier to inspect/diff, slower to restore on a
large database):

```bash
docker compose exec -T postgres pg_dump \
  -U "${POSTGRES_USER:-meeting}" -d "${POSTGRES_DB:-meeting}" \
  > parlor-backup-$(date +%F).sql
```

Automate this on a cron/systemd timer on the Docker host; there's no built-in
scheduled-backup job in this repo.

## Restore

Restoring into a **fresh** database is the safe path — restoring on top of an
existing one can conflict with data already there:

```bash
make reset          # drops parlor_pgdata and re-applies schema from backend/db/*.sql
make ps              # wait for postgres to report healthy
docker compose cp ./parlor-backup-2026-07-09.dump postgres:/tmp/restore.dump
docker compose exec -T postgres pg_restore \
  -U "${POSTGRES_USER:-meeting}" -d "${POSTGRES_DB:-meeting}" \
  --clean --if-exists /tmp/restore.dump
```

(Swap the `pg_restore` step for `psql ... < parlor-backup-2026-07-09.sql` if you
took a plain-SQL dump instead.)

`make reset` runs `docker compose down -v`, which deletes `parlor_pgdata` —
double check you actually have a backup file before running it against data
you care about. `make down` (no `-v`) stops the stack without touching the
volume, which is what you want for routine restarts.

## Volume-snapshot alternative

If you'd rather snapshot the volume directly (e.g. as part of a host-level
backup tool), stop the stack first so Postgres isn't mid-write:

```bash
make down
docker run --rm -v parlor_pgdata:/data -v "$(pwd)":/backup alpine \
  tar czf /backup/parlor_pgdata-$(date +%F).tar.gz -C /data .
```

Restore by extracting that tarball back into a freshly created (empty) volume
before `make up`. This is coarser than `pg_dump`/`pg_restore` (no cross-version
portability, no partial restore) but is a one-liner if you already snapshot
other Docker volumes this way.

## Resource sizing

These are approximate, based on what the actual images/services in this repo
contain (`docker-compose.yml`, `backend/Dockerfile.dev`,
`backend/Dockerfile.botruntime`) — not vendor-quoted numbers. Treat them as a
starting point, not a guarantee, and adjust based on your own meeting volume
and history size.

### API-only path (`make up-api`, standalone in-process degrade, no real bot)

Runs `postgres` + `ai-service` + `backend` (`Dockerfile.dev`, Python-only) +
`web`. No Chromium, no Xvfb, no Whisper cache.

| Resource | Approximate need |
|---|---|
| RAM | ~2 GB total (Postgres ~256-512 MB idle, growing with `shared_buffers`/cache under load; the three Python/Node app containers are a few hundred MB combined) |
| CPU | 2 vCPU is comfortable for light use; mock-mode AI responses and API requests are not CPU-heavy |
| Disk | Image layers: a few hundred MB combined. Data: driven entirely by `parlor_pgdata` — transcripts and summaries are text, so even thousands of meetings is typically low single-digit GB; pgvector embeddings add roughly a few KB per stored chunk |

This is the path to reach for if you only want the botless `desktop-capture/`
flow, or are just trying the product — it's the one the README recommends for
that reason.

### Full separated-worker path (`make up`, real bot-join)

Adds the `meeting-worker` container running `Dockerfile.botruntime`: Node 18 +
Playwright Chromium + Xvfb + PulseAudio + ffmpeg + a baked local Whisper
(`whisper-tiny.en`) cache, on top of everything above.

| Resource | Approximate need |
|---|---|
| RAM | ~4-6 GB total. Headful Chromium under Xvfb is the dominant cost — budget roughly 500 MB-1 GB per concurrent bot session, plus ~1-2 GB for the rest of the stack. One `meeting-worker` container handles **one meeting at a time** (see `backend/docs/BOT-RUNTIME.md`), so RAM scales with how many worker containers/pods you run, not with total meeting volume |
| CPU | 2-4 vCPU minimum; Chromium rendering + local Whisper transcription are the CPU-heavy parts. More CPU shortens transcription latency more than it increases join reliability |
| Disk | The `meeting-worker`/bot-runtime image itself is large — Chromium + its OS deps + `node_modules` + the baked Whisper model push the built image into the multi-GB range (this is the "large/slow" build the README warns about). Runtime data growth is the same `parlor_pgdata` profile as the API-only path above |

For real concurrency beyond one bot at a time, the intended path is the K8s
warm pool (`deploy/helm/`), not scaling `docker-compose.worker.yml` worker
replicas by hand — see `backend/docs/BOT-RUNTIME.md` for the three dispatch
modes.
