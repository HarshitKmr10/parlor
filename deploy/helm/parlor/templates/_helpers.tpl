{{/*
=============================================================================
 Parlor Helm chart — shared template helpers
=============================================================================
*/}}

{{/*
Chart base name, truncated to 63 chars (Kubernetes name limit) and stripped
of any trailing dash so it is always a valid DNS label.
*/}}
{{- define "parlor.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Fully-qualified release name. Honors fullnameOverride, otherwise combines the
release name with the chart name (avoiding "release-release" duplication).
*/}}
{{- define "parlor.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Chart label value, e.g. "parlor-0.1.0".
*/}}
{{- define "parlor.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Common labels applied to every object.
*/}}
{{- define "parlor.labels" -}}
helm.sh/chart: {{ include "parlor.chart" . }}
app.kubernetes.io/name: {{ include "parlor.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
{{- with .Values.commonLabels }}
{{ toYaml . }}
{{- end }}
{{- end -}}

{{/*
Per-component name, e.g. "<release>-parlor-backend".
Usage: include "parlor.componentName" (dict "ctx" . "component" "backend")
*/}}
{{- define "parlor.componentName" -}}
{{- printf "%s-%s" (include "parlor.fullname" .ctx) .component | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Selector labels for a single component. Stable across upgrades — never put
volatile values (image tag, checksum) in here.
Usage: include "parlor.selectorLabels" (dict "ctx" . "component" "backend")
*/}}
{{- define "parlor.selectorLabels" -}}
app.kubernetes.io/name: {{ include "parlor.name" .ctx }}
app.kubernetes.io/instance: {{ .ctx.Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{/*
Full label set for a single component (common labels + component selector).
Usage: include "parlor.componentLabels" (dict "ctx" . "component" "backend")
*/}}
{{- define "parlor.componentLabels" -}}
{{ include "parlor.labels" .ctx }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{/*
Resolve a full image reference for a component.
Falls back to global.imageRegistry + global.imageTag (= appVersion) when the
component does not override them.
Usage: include "parlor.image" (dict "ctx" . "image" .Values.backend.image)
*/}}
{{- define "parlor.image" -}}
{{- $ctx := .ctx -}}
{{- $img := .image -}}
{{- $registry := default $ctx.Values.global.imageRegistry $img.registry -}}
{{- $repo := $img.repository -}}
{{- $tag := default (default $ctx.Chart.AppVersion $ctx.Values.global.imageTag) $img.tag -}}
{{- if $registry -}}
{{- printf "%s/%s:%s" $registry $repo $tag -}}
{{- else -}}
{{- printf "%s:%s" $repo $tag -}}
{{- end -}}
{{- end -}}

{{/*
imagePullPolicy for a component, falling back to the global default.
*/}}
{{- define "parlor.pullPolicy" -}}
{{- default .ctx.Values.global.imagePullPolicy .image.pullPolicy -}}
{{- end -}}

{{/*
Name of the Secret that holds application secrets. Either an
externally-managed secret (existingSecret) or the chart-rendered one.
*/}}
{{- define "parlor.secretName" -}}
{{- if .Values.secrets.existingSecret -}}
{{- .Values.secrets.existingSecret -}}
{{- else -}}
{{- printf "%s-secrets" (include "parlor.fullname" .) -}}
{{- end -}}
{{- end -}}

{{/*
Name of the non-secret ConfigMap shared across services and bot pods.
This MUST match MEETING_JOINER_CONFIGMAP wired into the backend env so the
warm-pool dispatcher mounts the right ConfigMap onto bot pods.
*/}}
{{- define "parlor.configMapName" -}}
{{- printf "%s-config" (include "parlor.fullname" .) -}}
{{- end -}}

{{/*
ServiceAccount name used by the backend (and warm-pool bot pods).
*/}}
{{- define "parlor.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (printf "%s-bot" (include "parlor.fullname" .)) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{/*
Resolve the effective DATABASE_URL the apps should use.
- If postgres.enabled: build the in-cluster DSN from the Postgres values.
- Else: require externalDatabaseUrl (sourced from values or the existingSecret).
The DSN is delivered via the Secret (key DATABASE_URL); this helper is used to
populate that secret when postgres.enabled is true.
*/}}
{{- define "parlor.inClusterDatabaseUrl" -}}
{{- $pg := .Values.postgres -}}
{{- $host := printf "%s-postgres" (include "parlor.fullname" .) -}}
{{- printf "postgresql://%s:%s@%s:5432/%s" $pg.auth.username $pg.auth.password $host $pg.auth.database -}}
{{- end -}}

{{/*
Render an envFrom block referencing the shared ConfigMap + Secret.
Usage: include "parlor.envFrom" .
*/}}
{{- define "parlor.envFrom" -}}
- configMapRef:
    name: {{ include "parlor.configMapName" . }}
- secretRef:
    name: {{ include "parlor.secretName" . }}
{{- end -}}

{{/*
Standard pod security context (non-root). Apps run fine as non-root; the bot
worker is the exception (browser sandbox), handled in its own template.
*/}}
{{- define "parlor.podSecurityContext" -}}
runAsNonRoot: true
runAsUser: 1001
fsGroup: 1001
seccompProfile:
  type: RuntimeDefault
{{- end -}}
