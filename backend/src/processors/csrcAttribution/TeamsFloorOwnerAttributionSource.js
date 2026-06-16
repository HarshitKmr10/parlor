'use strict';

// Node-side wrapper for the floor-owner attribution mode.
//
// Same public surface as TeamsCsrcAttributionSource (install/bindPage/
// snapshot/health/stats) so the composer can swap implementations behind
// one shape. The two sources never run together — composeWebrtcCsrcAttribution
// picks one based on MSTEAMS_CSRC_ROUTING.

const { Buffer } = require('node:buffer');
const csrcFloorOwnerScript = require('../../bot/bot_scripts/msteams/csrcFloorOwnerScript');

class TeamsFloorOwnerAttributionSource {
  constructor({
    logger = console,
    onFrame = () => {},
    onHealth = () => {},
    resolveLagMs = 600,
    queueLagMs = resolveLagMs,
    floorOwnerMinSoloMs = 300,
    preRollMs = 300,
    noiseNamePattern,
  } = {}) {
    this.logger = logger;
    this.onFrame = onFrame;
    this.onHealth = onHealth;
    this.resolveLagMs = resolveLagMs;
    this.queueLagMs = queueLagMs;
    this.floorOwnerMinSoloMs = floorOwnerMinSoloMs;
    this.preRollMs = preRollMs;
    this.noiseNamePattern = noiseNamePattern;
    this._installed = false;
    this._bound = false;
    this._lastHealth = { ok: true, reason: null, ts_ms: null };
    this._stats = {
      framesIn: 0,
      framesUnknown: 0,
      framesKnown: 0,
      bytesIn: 0,
      lastFrameTs: null,
    };
  }

  async install(context) {
    if (this._installed) return;
    const cfg = JSON.stringify({
      queueLagMs: this.queueLagMs,
      resolveLagMs: this.resolveLagMs,
      floorOwnerMinSoloMs: this.floorOwnerMinSoloMs,
      preRollMs: this.preRollMs,
      noiseNamePattern: this.noiseNamePattern,
    });
    // Bootstrap config script runs first; the main script reads it at IIFE entry.
    await context.addInitScript({ content: `window.__teamsFloorOwnerConfig = ${cfg};` });
    await context.addInitScript(csrcFloorOwnerScript.SCRIPT);
    this._installed = true;
    this.logger.info?.('[teams.floor.src] page script installed', {
      queueLagMs: this.queueLagMs,
      resolveLagMs: this.resolveLagMs,
      floorOwnerMinSoloMs: this.floorOwnerMinSoloMs,
      preRollMs: this.preRollMs,
      noiseNamePattern: this.noiseNamePattern,
    });
  }

  async bindPage(page) {
    if (this._bound) return;
    await page.exposeBinding(
      '__teamsFloorOwnerOnAttributedFrame',
      async (_source, payload) => {
        try { this._onAttributedFrame(payload); }
        catch (e) { this.logger.warn?.('[teams.floor.src] frame handler threw', e?.message); }
      }
    );
    await page.exposeBinding(
      '__teamsFloorOwnerOnHealth',
      async (_source, payload) => {
        try { this._onHealthEvent(payload); }
        catch (e) { this.logger.warn?.('[teams.floor.src] health handler threw', e?.message); }
      }
    );
    this._bound = true;
    this.logger.info?.('[teams.floor.src] page bindings wired');
  }

  _onAttributedFrame(payload) {
    if (!payload || !payload.pcm_b64) return;
    const pcm = Buffer.from(payload.pcm_b64, 'base64');
    if (!pcm.length) return;
    this._stats.framesIn += 1;
    this._stats.bytesIn += pcm.length;
    this._stats.lastFrameTs = Date.now();
    if (payload.participant_id === 'unknown') this._stats.framesUnknown += 1;
    else this._stats.framesKnown += 1;
    try {
      this.onFrame({
        pcm,
        ts_ms: Number(payload.ts_ms) || Date.now(),
        participant_id: String(payload.participant_id || 'unknown'),
        participant_name: payload.participant_name || null,
        sample_rate: Number(payload.sample_rate) || 16_000,
      });
    } catch (e) {
      this.logger.warn?.('[teams.floor.src] onFrame callback threw', e?.message);
    }
  }

  _onHealthEvent(payload) {
    if (!payload) return;
    const next = {
      ok: !!payload.ok,
      reason: payload.reason || null,
      ts_ms: Number(payload.ts_ms) || Date.now(),
    };
    this._lastHealth = next;
    this.logger.warn?.('[teams.floor.src] health change', next);
    try { this.onHealth(next); } catch (_) { /* ignore */ }
  }

  health() { return { ...this._lastHealth }; }
  stats() { return { ...this._stats }; }

  async snapshot(page) {
    if (!page) return null;
    try {
      return await page.evaluate(() =>
        (typeof window.__teamsFloorOwnerSnapshot === 'function')
          ? window.__teamsFloorOwnerSnapshot()
          : null
      );
    } catch (e) {
      this.logger.warn?.('[teams.floor.src] snapshot failed', e?.message);
      return null;
    }
  }
}

module.exports = { TeamsFloorOwnerAttributionSource };
