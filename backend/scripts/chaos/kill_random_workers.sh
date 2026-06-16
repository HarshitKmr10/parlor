#!/usr/bin/env bash
#
# Chaos game-day: kill a random subset of claimed meeting-worker pods.
#
# When to run:
#   - Monthly, during a quiet maintenance window.
#   - After any change to the rejoin orchestrator, warm-pool manager, or
#     PodDisruptionBudget settings.
#
# Expected outcome:
#   - Each killed pod's meeting transitions ongoing → interrupted → joining
#     → ongoing (rejoined) within the documented rejoin SLA (tracked in
#     the engineering wiki, not committed here).
#   - Grafana dashboard "Meeting-Joiner Overview" shows a spike in
#     rejoin_total but transcript_segments_total continues to climb.
#   - Final transcripts have segments tagged session_number=2+ for the
#     affected meetings.
#
# How to verify:
#   1. ``kubectl get meeting_joiner -o yaml`` (via the custom dashboard)
#      shows status transitions through `interrupted`.
#   2. Grafana: filter "rejoin_duration_seconds" by platform — p95 should
#      stay under the documented rejoin SLA.
#   3. Compare segment counts before/after — drop of <5% per affected
#      meeting is the target.
#
# Rollback: nothing to roll back. The killed pods are ephemeral and the
# rejoin orchestrator restores meetings automatically.

set -euo pipefail

NAMESPACE="${NAMESPACE:-default}"
PERCENT=10
DRY_RUN=0

usage() {
  cat <<EOF
Usage: $0 [--namespace NS] [--percent N] [--dry-run]

  --namespace NS    Kubernetes namespace to target (default: $NAMESPACE)
  --percent N       Percentage of claimed pods to kill (default: $PERCENT)
  --dry-run         List the pods that would be killed; do not delete.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --namespace)
      NAMESPACE="$2"
      shift 2
      ;;
    --percent)
      PERCENT="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl not found in PATH" >&2
  exit 2
fi

if ! command -v shuf >/dev/null 2>&1; then
  echo "shuf not found in PATH (install coreutils)" >&2
  exit 2
fi

claimed_pods=$(kubectl get pods -n "$NAMESPACE" \
  -l app=meeting-worker,pool=claimed \
  --field-selector status.phase=Running \
  -o name 2>/dev/null || true)

if [[ -z "$claimed_pods" ]]; then
  echo "No claimed pods found in namespace $NAMESPACE — nothing to chaos."
  exit 0
fi

total=$(echo "$claimed_pods" | wc -l | awk '{print $1}')
# Round up: ceil(total * percent / 100).
kill_count=$(awk -v t="$total" -v p="$PERCENT" 'BEGIN { printf("%d\n", (t*p+99)/100) }')
if (( kill_count < 1 )); then
  kill_count=1
fi

echo "Found $total claimed pods, killing $kill_count ($PERCENT%)"

targets=$(echo "$claimed_pods" | shuf | head -n "$kill_count")

if (( DRY_RUN )); then
  echo "DRY-RUN — would delete:"
  echo "$targets"
  exit 0
fi

echo "$targets" | while read -r pod; do
  [[ -z "$pod" ]] && continue
  echo "Deleting $pod"
  kubectl delete "$pod" -n "$NAMESPACE" --grace-period=0 --force >/dev/null
done

echo "Chaos complete. Watch Grafana 'Meeting-Joiner Overview' + 'Per-Meeting Lifecycle' dashboards for rejoin behaviour."
