{{/*
=============================================================================
 Verdant Helm chart — shared template helpers
=============================================================================
*/}}

{{/*
Chart base name, truncated to 63 chars (Kubernetes name limit) and stripped
of any trailing dash so it is always a valid DNS label.
*/}}
{{- define "verdant.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Fully-qualified release name. Honors fullnameOverride, otherwise combines the
release name with the chart name (avoiding "release-release" duplication).
*/}}
{{- define "verdant.fullname" -}}
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
Chart label value, e.g. "verdant-0.1.0".
*/}}
{{- define "verdant.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Common labels applied to every object.
*/}}
{{- define "verdant.labels" -}}
helm.sh/chart: {{ include "verdant.chart" . }}
app.kubernetes.io/name: {{ include "verdant.name" . }}
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
Per-component name, e.g. "<release>-verdant-backend".
Usage: include "verdant.componentName" (dict "ctx" . "component" "backend")
*/}}
{{- define "verdant.componentName" -}}
{{- printf "%s-%s" (include "verdant.fullname" .ctx) .component | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Selector labels for a single component. Stable across upgrades — never put
volatile values (image tag, checksum) in here.
Usage: include "verdant.selectorLabels" (dict "ctx" . "component" "backend")
*/}}
{{- define "verdant.selectorLabels" -}}
app.kubernetes.io/name: {{ include "verdant.name" .ctx }}
app.kubernetes.io/instance: {{ .ctx.Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{/*
Full label set for a single component (common labels + component selector).
Usage: include "verdant.componentLabels" (dict "ctx" . "component" "backend")
*/}}
{{- define "verdant.componentLabels" -}}
{{ include "verdant.labels" .ctx }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{/*
Resolve a full image reference for a component.
Falls back to global.imageRegistry + global.imageTag (= appVersion) when the
component does not override them.
Usage: include "verdant.image" (dict "ctx" . "image" .Values.backend.image)
*/}}
{{- define "verdant.image" -}}
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
{{- define "verdant.pullPolicy" -}}
{{- default .ctx.Values.global.imagePullPolicy .image.pullPolicy -}}
{{- end -}}

{{/*
Name of the Secret that holds application secrets. Either an
externally-managed secret (existingSecret) or the chart-rendered one.
*/}}
{{- define "verdant.secretName" -}}
{{- if .Values.secrets.existingSecret -}}
{{- .Values.secrets.existingSecret -}}
{{- else -}}
{{- printf "%s-secrets" (include "verdant.fullname" .) -}}
{{- end -}}
{{- end -}}

{{/*
Name of the non-secret ConfigMap shared across services and bot pods.
This MUST match MEETING_JOINER_CONFIGMAP wired into the backend env so the
warm-pool dispatcher mounts the right ConfigMap onto bot pods.
*/}}
{{- define "verdant.configMapName" -}}
{{- printf "%s-config" (include "verdant.fullname" .) -}}
{{- end -}}

{{/*
ServiceAccount name used by the backend (and warm-pool bot pods).
*/}}
{{- define "verdant.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (printf "%s-bot" (include "verdant.fullname" .)) .Values.serviceAccount.name -}}
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
{{- define "verdant.inClusterDatabaseUrl" -}}
{{- $pg := .Values.postgres -}}
{{- $host := printf "%s-postgres" (include "verdant.fullname" .) -}}
{{- printf "postgresql://%s:%s@%s:5432/%s" $pg.auth.username $pg.auth.password $host $pg.auth.database -}}
{{- end -}}

{{/*
Render an envFrom block referencing the shared ConfigMap + Secret.
Usage: include "verdant.envFrom" .
*/}}
{{- define "verdant.envFrom" -}}
- configMapRef:
    name: {{ include "verdant.configMapName" . }}
- secretRef:
    name: {{ include "verdant.secretName" . }}
{{- end -}}

{{/*
Standard pod security context (non-root). Apps run fine as non-root; the bot
worker is the exception (browser sandbox), handled in its own template.
*/}}
{{- define "verdant.podSecurityContext" -}}
runAsNonRoot: true
runAsUser: 1001
fsGroup: 1001
seccompProfile:
  type: RuntimeDefault
{{- end -}}
