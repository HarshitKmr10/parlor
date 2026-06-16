'use strict';

const { performance } = require('node:perf_hooks');

// Per-step budgets used for log tagging (over-budget logs as WARN).
// The actual timeouts live in the step implementations — these numbers
// only decide whether a span is "healthy" or surfaced to ops. Keep them
// aligned with realistic Teams web cold-start timings: navigate can take
// 8 s on a free-meeting URL with launcher redirect, and the Teams React
// SPA needs ~30 s to render the prejoin controls in the worst case.
const DEFAULT_BUDGET_MS = {
  'browser.launch': 4_000,
  'media.warmup': 1_500,
  'page.navigate': 8_000,
  'prejoin.ready': 30_000,
  'name.set': 1_000,
  'audio.select': 1_000,
  'mic.mute': 600,
  'click.join': 800,
  'admission.confirm': 8_000,
  'capture.start': 1_500,
};

class JoinTimer {
  constructor({ logger, budgets = {} } = {}) {
    this.logger = logger || console;
    this.budgets = { ...DEFAULT_BUDGET_MS, ...budgets };
    this.spans = new Map();
    this.completed = [];
    this.t0 = performance.now();
  }

  start(label) {
    if (this.spans.has(label)) return;
    this.spans.set(label, performance.now());
  }

  end(label, meta) {
    const t = this.spans.get(label);
    if (t === undefined) return null;
    this.spans.delete(label);
    const elapsed = Math.round(performance.now() - t);
    const budget = this.budgets[label];
    const overBudget = budget !== undefined && elapsed > budget;
    const span = Object.freeze({
      label,
      elapsed_ms: elapsed,
      budget_ms: budget ?? null,
      over_budget: overBudget,
      since_start_ms: Math.round(performance.now() - this.t0),
      meta: meta ?? null,
    });
    this.completed.push(span);
    const tag = overBudget ? 'WARN' : 'INFO';
    this.logger[overBudget ? 'warn' : 'info'](
      `[teams.timing] ${label}=${elapsed}ms budget=${budget ?? 'n/a'} ${tag}`,
      meta || ''
    );
    return span;
  }

  async measure(label, fn, meta) {
    this.start(label);
    try {
      const value = await fn();
      this.end(label, meta);
      return value;
    } catch (error) {
      this.end(label, { ...(meta || {}), error: error?.message });
      throw error;
    }
  }

  totalElapsedMs() {
    return Math.round(performance.now() - this.t0);
  }

  report() {
    return Object.freeze({
      total_ms: this.totalElapsedMs(),
      spans: [...this.completed],
    });
  }
}

module.exports = { JoinTimer, DEFAULT_BUDGET_MS };
