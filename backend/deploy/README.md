# meeting-joiner — Kubernetes deployment

Generic reference manifests for running the standalone bot on any Kubernetes
cluster. Edit the placeholders, apply with `kubectl`, done.

These are intentionally *not* any particular organization's internal monorepo
manifests — those would typically live elsewhere and reference an internal
container registry, cert-manager `ClusterIssuer`, and internal hostnames
specific to that deployment.

## Files

| File | Purpose |
|---|---|
| `deployment.yaml` | Deployment for one bot worker. Scale via `replicas`. |
| `service.yaml` | ClusterIP service for the worker's health endpoint. |
| `configmap.example.yaml` | Non-secret env keys (`PORT`, tuning, feature flags). |
| `secret.example.yaml` | Secret env keys (`DATABASE_URL`, API keys). Replace placeholders. |
| `ingress.example.yaml` | Optional ingress with host placeholder. |

## Quick start

```bash
# 1. Build and push the image to YOUR registry
docker build -t YOUR_REGISTRY/meeting-joiner:1.0.0 ../
docker push YOUR_REGISTRY/meeting-joiner:1.0.0

# 2. Apply schema
psql "$DATABASE_URL" -f ../db/bootstrap.sql

# 3. Edit placeholders in configmap.example.yaml + secret.example.yaml
#    Replace YOUR_REGISTRY, YOUR_DATABASE_URL, etc.

# 4. Apply
kubectl apply -f configmap.example.yaml
kubectl apply -f secret.example.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.example.yaml   # optional
```

## Configuration

All env keys are documented in `../.env.example`. The ConfigMap covers the
non-secret subset; the Secret covers everything that should never end up
in plain YAML (DSNs, API keys).

If you vendor this into a larger monorepo with its own env-file source of
truth, keep the bundled `.env.example` (and therefore vendor consumers) in
sync with it yourself — ConfigMap/Secret edits here are NOT auto-synced.
