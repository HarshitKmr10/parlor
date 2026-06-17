#!/usr/bin/env bash
# Show the meeting-worker "pool": how many workers are configured, and which
# are idle vs busy — by querying each worker sidecar's real /health (the same
# source of truth the dispatcher uses). Run via `make workers`.
set -euo pipefail

DC="docker compose -f docker-compose.yml -f docker-compose.worker.yml"

# Enumerate the configured workers (MEETING_WORKER_SIDECAR_URL, comma-separated)
# from inside the backend container and health-check each over the compose net.
$DC exec -T backend python - <<'PY'
import os, json, urllib.request

urls = [u.strip() for u in os.environ.get("MEETING_WORKER_SIDECAR_URL", "").split(",") if u.strip()]
if not urls:
    print("No meeting-workers configured (MEETING_WORKER_SIDECAR_URL unset).")
    print("RUNTIME_MODE may be 'standalone' (bot runs in-process) — see `make up` vs `make up-api`.")
    raise SystemExit(0)

idle = busy = 0
print(f"{len(urls)} meeting-worker(s) in the pool:\n")
for u in urls:
    try:
        with urllib.request.urlopen(u + "/health", timeout=4) as r:
            d = json.load(r)
        active = bool(d.get("current_meeting_id")) or bool(d.get("bot_subprocess_alive"))
        if active:
            busy += 1
            print(f"  BUSY        {u}  meeting={d.get('current_meeting_id')}  state={d.get('meeting_state')}")
        else:
            idle += 1
            print(f"  idle        {u}  state={d.get('meeting_state')}")
    except Exception as e:  # noqa: BLE001
        busy += 1
        print(f"  UNREACHABLE {u}  ({e})")

print(f"\navailable: {idle}/{len(urls)}   busy: {busy}/{len(urls)}")
if busy and idle == 0:
    print("All workers busy — new meetings will be rejected (meeting_worker_all_busy).")
    print("Free a stuck/hung worker with: make free-workers")
PY
