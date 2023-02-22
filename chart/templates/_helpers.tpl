{{/* vim: set filetype=mustache: */}}
{{/*
Expand the name of the chart.
*/}}
{{- define "relaynet-internet-gateway.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "relaynet-internet-gateway.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "relaynet-internet-gateway.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Generate image repository and possibly tag
*/}}
{{- define "relaynet-internet-gateway.image" -}}
{{ .Values.image.repository }}{{ ternary "" (printf ":%s" (.Values.image.tag | default .Chart.AppVersion)) .Values.tags.gwDev }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "relaynet-internet-gateway.labels" -}}
helm.sh/chart: {{ include "relaynet-internet-gateway.chart" . }}
{{ include "relaynet-internet-gateway.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "relaynet-internet-gateway.selectorLabels" -}}
app.kubernetes.io/name: {{ include "relaynet-internet-gateway.name" . }}
{{- if .Component }}
app.kubernetes.io/component: {{ .Component }}
{{- end }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Generate PoWeb host name
*/}}
{{- define "relaynet-internet-gateway.powebHost" -}}
{{ default (printf "poweb.%s" .Values.internetAddress) .Values.ingress.serviceDomains.poweb }}
{{- end }}

{{/*
Generate PoHTTP host name
*/}}
{{- define "relaynet-internet-gateway.pohttpHost" -}}
{{ default (printf "pohttp.%s" .Values.internetAddress) .Values.ingress.serviceDomains.pohttp }}
{{- end }}

{{/*
Generate CogRPC host name
*/}}
{{- define "relaynet-internet-gateway.cogrpcHost" -}}
{{ default (printf "cogrpc.%s" .Values.internetAddress) .Values.ingress.serviceDomains.cogrpc }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "relaynet-internet-gateway.serviceAccountName" -}}
{{- include "relaynet-internet-gateway.fullname" . }}
{{- end }}

{{/*
Generate digest of a rendered resource template
*/}}
{{- define "relaynet-internet-gateway.resourceDigest" -}}
{{- /* Truncate the digest to avoid making it easy to derive secret values */ -}}
{{- include (print $.Template.BasePath "/" .fileName) . | sha256sum | trunc 5 | quote }}
{{- end }}

{{/*
Keystore-related, non-secret environment variables.
*/}}
{{- define "relaynet-internet-gateway.keystoreNonSecretEnvVars" -}}
KEYSTORE_ADAPTER: {{ .Values.keystore.adapter }}
{{- if eq .Values.keystore.adapter "gcp" }}
KS_GCP_LOCATION: {{ .Values.keystore.location }}
KS_KMS_KEYRING: {{ .Values.keystore.kmsKeyring }}
KS_KMS_ID_KEY: {{ .Values.keystore.kmsIdKey }}
KS_KMS_SESSION_ENC_KEY: {{ .Values.keystore.kmsSessionEncryptionKey }}
{{- else if eq .Values.keystore.adapter "vault" }}
KS_VAULT_URL: {{ .Values.keystore.serverUrl }}
KS_VAULT_KV_PREFIX: {{ .Values.keystore.kvPrefix }}
{{- end }}
{{- end }}

{{/*
Keystore-related, secret environment variables.
*/}}
{{- define "relaynet-internet-gateway.keystoreSecretEnvVars" -}}
{{- if eq .Values.keystore.adapter "vault" }}
KS_VAULT_TOKEN: {{ .Values.keystore.token | b64enc }}
{{- end }}
{{- end }}