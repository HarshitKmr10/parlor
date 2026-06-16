'use strict';

/**
 * pino JSON logger configured with OTel trace correlation.
 *
 * Replaces the file-based winston logger (`shared/logger.js`) in new code
 * paths — Promtail at `infra/monitoring/promtail.yml` picks up stdout and
 * ships to Loki, so local files are an unmanaged sink (gap G11).
 *
 * Trace correlation: pino-mixins reads the current OTel span context on every
 * log call, so traceId / spanId appear on each log line and Grafana can
 * jump from a log line to the corresponding trace in Tempo.
 *
 * The exported `logger` object exposes the same surface (`info`, `warn`,
 * `error`, `debug`) that existing bot code calls, so we drop in without
 * rewriting call sites.
 */

const pino = require('pino');
const { trace, context } = require('@opentelemetry/api');

function traceContextMixin() {
  const span = trace.getSpan(context.active());
  if (!span) return {};
  const spanContext = span.spanContext();
  if (!spanContext || !spanContext.traceId) return {};
  return {
    trace_id: spanContext.traceId,
    span_id: spanContext.spanId,
  };
}

function buildLogger(serviceName = 'meeting-worker-bot') {
  const level = (process.env.LOG_LEVEL || 'info').toLowerCase();
  return pino({
    name: serviceName,
    level,
    base: {
      service: serviceName,
      pod_name: process.env.POD_NAME || undefined,
      pod_namespace: process.env.POD_NAMESPACE || undefined,
      deployment_env: process.env.DEPLOYMENT_ENV || process.env.ENVIRONMENT,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    mixin: traceContextMixin,
    redact: {
      paths: [
        '*.password',
        '*.token',
        '*.secret',
        '*.authorization',
        'headers.authorization',
        'req.headers.authorization',
      ],
      remove: true,
    },
  });
}

const logger = buildLogger();

module.exports = {
  logger,
  buildLogger,
};
