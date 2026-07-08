'use strict';

/**
 * OpenTelemetry Node SDK initialization for the meeting-worker bot.
 *
 * Auto-instruments Node core (http, dns), Playwright, and pino so HTTP calls,
 * browser actions, and log lines flow into the same trace tree as the
 * Python API + sidecar.
 *
 * Must be required BEFORE any instrumented module — typically as the first
 * require in joinMeeting.js or via `node -r ./observability/otel-setup`.
 *
 * Feature flag: OTEL_ENABLED=false disables setup so local dev / emergency
 * scenarios can run without a collector.
 */

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const {
  SemanticResourceAttributes,
} = require('@opentelemetry/semantic-conventions');
const {
  OTLPTraceExporter,
} = require('@opentelemetry/exporter-trace-otlp-grpc');
const {
  OTLPMetricExporter,
} = require('@opentelemetry/exporter-metrics-otlp-grpc');
const {
  PeriodicExportingMetricReader,
} = require('@opentelemetry/sdk-metrics');
const {
  getNodeAutoInstrumentations,
} = require('@opentelemetry/auto-instrumentations-node');

const DEFAULT_OTLP_ENDPOINT =
  'http://otel-collector.monitoring.svc.cluster.local:4317';

let sdk = null;

function isEnabled() {
  const raw = (process.env.OTEL_ENABLED || 'true').trim().toLowerCase();
  return raw !== 'false';
}

function buildResource(serviceName) {
  return resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]:
      process.env.OTEL_SERVICE_NAME || serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]:
      process.env.SERVICE_VERSION || '1.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
      process.env.DEPLOYMENT_ENV || process.env.ENVIRONMENT || 'unknown',
    'k8s.pod.name': process.env.POD_NAME || undefined,
    'k8s.namespace.name': process.env.POD_NAMESPACE || undefined,
  });
}

function configureOtel(serviceName = 'meeting-worker-bot') {
  if (!isEnabled() || sdk !== null) {
    return sdk;
  }

  const endpoint = (
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT || DEFAULT_OTLP_ENDPOINT
  ).trim();

  sdk = new NodeSDK({
    resource: buildResource(serviceName),
    traceExporter: new OTLPTraceExporter({ url: endpoint }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: endpoint }),
      exportIntervalMillis: 30_000,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Filesystem auto-instrumentation produces too many spans for our
        // workload (Playwright tmp file churn). Disable.
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  try {
    sdk.start();
  } catch (err) {
    // We never want OTel init failure to keep the bot from joining a meeting.
    // The bot will run without telemetry rather than not run at all.
    // eslint-disable-next-line no-console
    console.error('[otel] init failed, continuing without telemetry:', err);
    sdk = null;
  }

  process.on('SIGTERM', () => shutdownOtel().catch(() => {}));
  process.on('SIGINT', () => shutdownOtel().catch(() => {}));

  return sdk;
}

async function shutdownOtel() {
  if (sdk === null) return;
  try {
    await sdk.shutdown();
  } finally {
    sdk = null;
  }
}

module.exports = {
  configureOtel,
  shutdownOtel,
};
