# Chaos game day — meeting-joiner

Scripts and runbook for periodic resilience testing of the meeting-joiner
warm pool + rejoin orchestrator.

## When to run

- Monthly, during a quiet maintenance window.
- After any change to: warm pool manager, rejoin orchestrator,
  PodDisruptionBudget, sidecar lifecycle, or Helm chart resources.
- Before promoting a new chart version to a customer cluster.

## Scripts in this directory

| Script | Purpose |
|---|---|
| `kill_random_workers.sh` | Kill a configurable percentage of claimed
  meeting-worker pods with `--grace-period=0 --force` (simulates node
  loss). The rejoin orchestrator should restore the affected meetings. |

## Watch these during a chaos run

- **Grafana "Meeting-Joiner Overview"** — active meetings should dip then
  recover; rejoin success rate should hold steady.
- **Grafana "Warm Pool Health"** — replenish should fire to refill the
  pool after kills; CAS-conflict rate should stay near zero.
- **Grafana "Per-Meeting Lifecycle"** — pick one affected meeting and
  walk through its status transitions
  (`ongoing → interrupted → joining → ongoing`).
- **Loki query** `{app="meeting-joiner-api"} |= "rejoin.success"` — every
  killed pod should yield a matching success line within the rejoin SLA.

## Rollback

Nothing to roll back. The killed pods were ephemeral. If a rejoined
session itself fails, the meeting moves to `failed` after
`MAX_SESSIONS_PER_MEETING` attempts — no manual intervention needed.

## Reporting template

After each chaos run, file a short report in the engineering wiki:

- Date / time / namespace.
- Number of pods killed and their meeting IDs.
- Time-to-recovery per affected meeting (start-of-kill → next segment).
- Any meetings that did NOT recover within the rejoin SLA — investigate.
- Any unexpected alerts that fired.
- Any code changes the run prompted.
