'use strict';

// Node-side wrapper around the page-realm CSRC attribution script.
// Responsibilities:
//   - Inject the script via context.addInitScript before navigation.
//   - Expose the two bindings the page script calls:
//       __teamsBridgeOnAttributedFrame({pcm_b64, ts_ms, participant_id,
//                                       participant_name, sample_rate})
//       __teamsCsrcOnHealth({ok, reason?, ts_ms})
//   - Decode pcm_b64 → Buffer, forward to onFrame callback.
//   - Track health and surface the last failure reason via .health().
//
// Has no opinion about what consumes the frames downstream — that's the
// PerParticipantStreamPool's job. Composition is wired in
// composeWebrtcCsrcAttribution.

const { Buffer } = require('node:buffer');
const csrcAttributionScript = require('../../bot/bot_scripts/msteams/csrcAttributionScript');

class TeamsCsrcAttributionSource {
  constructor({
    logger = console,
    onFrame = () => {},
    onHealth = () => {},
  } = {}) {
    this.logger = logger;
    this.onFrame = onFrame;
    this.onHealth = onHealth;
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

  // Inject the page-realm script into a Playwright context. Call this
  // BEFORE navigation so the script runs as soon as the page boots.
  async install(context) {
    if (this._installed) return;
    await context.addInitScript(csrcAttributionScript.SCRIPT);
    this._installed = true;
    this.logger.info?.('[teams.csrc.src] page script installed');
  }

  // Bind the page-realm callbacks to a specific page. Must be called once
  // the page object exists (typically right after context.newPage()).
  async bindPage(page) {
    if (this._bound) return;
    await page.exposeBinding(
      '__teamsBridgeOnAttributedFrame',
      async (_source, payload) => {
        try { this._onAttributedFrame(payload); }
        catch (e) { this.logger.warn?.('[teams.csrc.src] frame handler threw', e?.message); }
      }
    );
    await page.exposeBinding(
      '__teamsCsrcOnHealth',
      async (_source, payload) => {
        try { this._onHealthEvent(payload); }
        catch (e) { this.logger.warn?.('[teams.csrc.src] health handler threw', e?.message); }
      }
    );
    this._bound = true;
    this.logger.info?.('[teams.csrc.src] page bindings wired');
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
      this.logger.warn?.('[teams.csrc.src] onFrame callback threw', e?.message);
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
    this.logger.warn?.('[teams.csrc.src] health change', next);
    try { this.onHealth(next); } catch (_) { /* ignore */ }
  }

  health() { return { ...this._lastHealth }; }
  stats() { return { ...this._stats }; }

  async snapshot(page) {
    if (!page) return null;
    try {
      return await page.evaluate(() =>
        (typeof window.__teamsCsrcSnapshot === 'function')
          ? window.__teamsCsrcSnapshot()
          : null
      );
    } catch (e) {
      this.logger.warn?.('[teams.csrc.src] snapshot failed', e?.message);
      return null;
    }
  }
}

module.exports = { TeamsCsrcAttributionSource };
