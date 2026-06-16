'use strict';

// Google Meet RosterWatcher — Node-side state for who is in the meeting
// and who is speaking when. Same public interface as Teams' RosterWatcher
// (expose / snapshot / history / getActiveSpeakerInWindow / start /
// setBotName / setOnChange) so the aloneness watcher and downstream
// consumers remain platform-agnostic.
//
// Signal source: an in-page tile observer (rosterObserverScript.js) that
// fires `__gmeetBridgeOnRoster({ ts, list })` whenever the participant
// panel mutates (join, leave, speaker animation toggle). Speaker
// detection uses Google's speaking-animation class names
// (Oaajhc/HX2H7/wEsLMd/OgVli) which were verified live during the Phase 0
// probe — Meet flips these classes on the tile when audio energy is
// detected, exactly the signal we need.

const HISTORY_MAX_SAMPLES = 1500;

class RosterWatcher {
  constructor({ logger, botName } = {}) {
    this.logger = logger || console;
    this.botName = String(botName || '').toLowerCase();
    this.lastRoster = [];
    this.byName = {};
    this.byParticipantId = {};
    this.history = [];
    this._onChange = null;
    this._lastChangeKey = '';
    this._exposed = false;
  }

  setBotName(name) {
    this.botName = String(name || '').toLowerCase();
  }

  _isBot(name) {
    if (!name) return false;
    const lower = String(name).toLowerCase();
    if (this.botName && lower === this.botName) return true;
    if (/bot/i.test(name)) return true;
    return false;
  }

  setOnChange(cb) {
    this._onChange = typeof cb === 'function' ? cb : null;
  }

  async expose(page) {
    if (this._exposed) return;
    await page.exposeFunction('__gmeetBridgeOnRoster', (payload) => {
      try { this.ingestRosterEvent(payload); }
      catch (e) { this.logger.warn?.('[gmeet.roster] ingest failed', e?.message); }
    });
    this._exposed = true;
  }

  start(_page) { return () => {}; }

  ingestRosterEvent({ ts, list } = {}) {
    if (!Array.isArray(list)) return;
    const eventTs = Number(ts) || Date.now();

    this.lastRoster = list.map((entry) => ({
      name: String(entry?.name || '').trim(),
      participantId: entry?.participantId || null,
      speaking: !!entry?.speaking,
    })).filter((e) => e.name);

    const byName = {};
    const byPid = {};
    for (const entry of this.lastRoster) {
      byName[entry.name] = entry;
      if (entry.participantId) byPid[entry.participantId] = entry;
    }
    this.byName = byName;
    this.byParticipantId = byPid;

    const speakers = this.lastRoster.filter((e) => e.speaking).map((e) => e.name);
    this.history.push({ ts: eventTs, speakers });
    while (this.history.length > HISTORY_MAX_SAMPLES) this.history.shift();

    const namesKey = this.lastRoster.map((e) => e.name).sort().join('|');
    if (namesKey !== this._lastChangeKey) {
      this._lastChangeKey = namesKey;
      if (this._onChange) {
        try { this._onChange({ list: [...this.lastRoster], ts: eventTs }); }
        catch (e) { this.logger.warn?.('[gmeet.roster] onChange failed', e?.message); }
      }
    }
  }

  getActiveSpeakerInWindow(startMs, endMs) {
    const sStart = Number(startMs);
    const sEnd = Number(endMs);
    if (!Number.isFinite(sStart) || !Number.isFinite(sEnd) || sEnd <= sStart) return null;
    if (this.history.length === 0) return null;

    const tally = new Map();
    for (let i = 0; i < this.history.length; i++) {
      const sample = this.history[i];
      const next = this.history[i + 1];
      const sampleEnd = next ? next.ts : Math.min(Date.now(), sample.ts + 5_000);
      const overlapStart = Math.max(sStart, sample.ts);
      const overlapEnd = Math.min(sEnd, sampleEnd);
      if (overlapEnd <= overlapStart) continue;
      const dur = overlapEnd - overlapStart;
      for (const name of sample.speakers) {
        if (this._isBot(name)) continue;
        tally.set(name, (tally.get(name) || 0) + dur);
      }
    }
    if (tally.size === 0) return null;
    let bestName = null;
    let bestDur = 0;
    for (const [name, dur] of tally.entries()) {
      if (dur > bestDur) { bestDur = dur; bestName = name; }
    }
    return bestName;
  }

  // Look up display name for a participantId. The per-peer capture
  // script learns participantId via the `data-participant-id` attribute
  // on each speaking tile and stamps it into every PCM frame, so the
  // bridge can resolve a stable name even when the speaking-class signal
  // is momentarily absent.
  nameForParticipantId(participantId) {
    if (!participantId) return null;
    const entry = this.byParticipantId[participantId];
    return entry ? entry.name : null;
  }

  snapshot() {
    return Object.freeze({
      list: [...this.lastRoster],
      byName: { ...this.byName },
      byParticipantId: { ...this.byParticipantId },
    });
  }
}

module.exports = { RosterWatcher };
