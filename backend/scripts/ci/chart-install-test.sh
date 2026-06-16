#!/usr/bin/env bash
# Chart-install integration test for PR #3592 (RCA Design #2).
#
# Catches:
#   #17 — configmap key/env-var name mismatches that silently no-op overrides
#   #18 — warm-pool pod-spec secret expectations the chart doesn't fulfil
#   any future regression in deployment plumbing
#
# Lifecycle:
#   1. Create a throwaway k3d cluster (kind also works; k3d is faster).
#   2. Build the meeting-joiner-api/worker/sidecar images from the current
#      tree and import them into the cluster.
#   3. Apply meeting-joiner/db/bootstrap.sql against an in-cluster Postgres
#      and pgqueuer install.
#   4. helm install the aiops-chart with values pinned to the local images.
#   5. Wait for warm-pool standby pods labelled `app=meeting-worker,
#      pool=warm` to reach Ready.
#   6. Fail the build if any of the above doesn't happen within the budget.
#
# Run locally:
#   ./meeting-joiner/scripts/ci/chart-install-test.sh
#
# Run on CI: this script is intended to be the body of a GH Actions job
# with k3d, kubectl, helm, and docker preinstalled.

set -euo pipefail

CLUSTER_NAME="${CLUSTER_NAME:-mj-chart-test}"
NAMESPACE="${NAMESPACE:-meeting-joiner-test}"
TIMEOUT_SECS="${TIMEOUT_SECS:-300}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

echo "▶ creating k3d cluster $CLUSTER_NAME"
k3d cluster delete "$CLUSTER_NAME" >/dev/null 2>&1 || true
k3d cluster create "$CLUSTER_NAME" \
  --servers 1 --agents 0 \
  --port "18080:80@loadbalancer" \
  --no-rollback \
  --timeout 300s --wait \
  --k3s-arg "--disable=traefik@server:*"

cleanup() {
  echo "▶ tearing down cluster"
  k3d cluster delete "$CLUSTER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "▶ building images"
docker build -t mj-test-worker:ci \
  -f meeting-joiner/infra/docker/meeting_worker.Dockerfile . >/dev/null
docker build -t mj-test-sidecar:ci \
  -f infra/docker/meeting_sidecar.Dockerfile . >/dev/null
docker tag mj-test-worker:ci mj-test-api:ci

echo "▶ importing images into cluster"
k3d image import -c "$CLUSTER_NAME" \
  mj-test-api:ci mj-test-worker:ci mj-test-sidecar:ci

echo "▶ creating namespace $NAMESPACE"
kubectl create namespace "$NAMESPACE" >/dev/null

echo "▶ standing up Postgres in cluster"
kubectl -n "$NAMESPACE" apply -f - <<YAML
apiVersion: apps/v1
kind: StatefulSet
metadata: { name: postgres }
spec:
  serviceName: postgres
  replicas: 1
  selector: { matchLabels: { app: postgres } }
  template:
    metadata: { labels: { app: postgres } }
    spec:
      containers:
        - name: postgres
          image: postgres:16-alpine
          env:
            - { name: POSTGRES_PASSWORD, value: postgres }
            - { name: POSTGRES_USER, value: postgres }
            - { name: POSTGRES_DB, value: meeting_joiner }
          ports: [{ containerPort: 5432 }]
          readinessProbe:
            exec: { command: ["pg_isready", "-U", "postgres"] }
            initialDelaySeconds: 3
            periodSeconds: 2
---
apiVersion: v1
kind: Service
metadata: { name: postgres }
spec:
  selector: { app: postgres }
  ports: [{ port: 5432, targetPort: 5432 }]
YAML

kubectl -n "$NAMESPACE" wait --for=condition=ready pod -l app=postgres --timeout=120s

echo "▶ applying bootstrap.sql"
kubectl -n "$NAMESPACE" cp meeting-joiner/db/bootstrap.sql postgres-0:/tmp/bootstrap.sql
kubectl -n "$NAMESPACE" exec postgres-0 -- \
  sh -c 'PGPASSWORD=postgres psql -U postgres -d meeting_joiner -v ON_ERROR_STOP=1 -f /tmp/bootstrap.sql' >/dev/null

echo "▶ creating meeting-joiner secret stub"
kubectl -n "$NAMESPACE" create secret generic meeting-joiner-secrets \
  --from-literal=DATABASE_URL='postgresql://postgres:postgres@postgres:5432/meeting_joiner' \
  --from-literal=DIRECT_URL='postgresql://postgres:postgres@postgres:5432/meeting_joiner' \
  --from-literal=OPENAI_API_KEY='sk-ci-no-real-calls' \
  --from-literal=AZURE_STORAGE_CONNECTION_STRING='DefaultEndpointsProtocol=https;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;EndpointSuffix=core.windows.net' \
  >/dev/null

echo "▶ helm installing aiops-chart"
helm upgrade --install meeting-joiner-test infra/aiops-chart \
  --namespace "$NAMESPACE" \
  --set meetingJoiner.enabledPlatforms="msteams_playwright,googlemeet" \
  --set meetingJoiner.sttProviders="openai" \
  --set meetingJoiner.warmPool.size=2 \
  --set meetingJoiner.warmPool.max=4 \
  --set meetingJoiner.images.api=mj-test-api:ci \
  --set meetingJoiner.images.botRuntime=mj-test-worker:ci \
  --set meetingJoiner.images.sidecar=mj-test-sidecar:ci \
  --set meetingJoiner.ingress.enabled=false \
  --set meetingJoiner.externalSecrets.enabled=false \
  --set meetingJoiner.botName="CI Chart-Install Test Bot" \
  --set meetingJoiner.otelEnabled=false \
  --set meetingJoiner.recordingUploadDisabled=true \
  --set meetingJoiner.storageRequired=false \
  --set meetingJoiner.minSegmentTextLength=0 \
  --wait --timeout "${TIMEOUT_SECS}s"

echo "▶ waiting for API deployment to be Available"
kubectl -n "$NAMESPACE" wait --for=condition=Available \
  deployment/meeting-joiner-api --timeout="${TIMEOUT_SECS}s"

echo "▶ waiting for ${WARM_POOL_SIZE:-2} warm-pool pods to be Ready"
# Warm pool pods are created imperatively by the API process, not by the
# chart, so we poll rather than `wait`.
deadline=$(( $(date +%s) + TIMEOUT_SECS ))
while [ "$(date +%s)" -lt "$deadline" ]; do
  ready=$(kubectl -n "$NAMESPACE" get pods \
    -l 'app=meeting-worker,meeting-joiner.aiopshq.dev/status=warm' \
    -o jsonpath='{range .items[?(@.status.phase=="Running")]}{.metadata.name}{"\n"}{end}' \
    2>/dev/null | wc -l | tr -d ' ')
  if [ "$ready" -ge 2 ]; then
    echo "✓ $ready warm-pool pods Ready"
    exit 0
  fi
  sleep 5
done

echo "✗ timed out waiting for warm-pool pods. Cluster state:"
kubectl -n "$NAMESPACE" get pods -o wide
kubectl -n "$NAMESPACE" describe pods -l app=meeting-worker | tail -50
kubectl -n "$NAMESPACE" logs deployment/meeting-joiner-api --tail=80 || true
exit 1
