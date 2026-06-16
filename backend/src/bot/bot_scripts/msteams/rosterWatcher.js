'use strict';

// RosterWatcher — Node-side state for who is in the meeting and who is
// speaking when. The signal source is the in-page tile observer
// (tileObserverScript.js) which fires `__teamsBridgeOnRoster({ ts, list })`
// whenever a participant joins, leaves, or starts/stops speaking.
//
// We keep two pieces of state:
//   1. lastRoster / byName — current participant list, used for live
//      participant updates and as a fallback "solo human" attribution.
//   2. history — ring buffer of {ts, speakers[]} samples used by
//      getActiveSpeakerInWindow() to attribute STT chunks to a real name
//      based on who was actually speaking during the chunk's wall-clock
//      window.
//
// The previous implementation polled the People panel via Playwright's
// page.evaluate() every 4 s. That had two problems: it depended on the
// panel being open (often impossible on guest Teams), and the speaking
// flag was based on element existence (any unmuted participant) rather
// than the .vdi-frame-occlusion class signal that toggles in real time.

const HISTORY_MAX_SAMPLES = 1500; // ~25 min at one event/s, plenty for any meeting.

class RosterWatcher {
  constructor({ logger, botName } = {}) {
    this.logger = logger || console;
    this.botName = String(botName || '').toLowerCase();
    this.lastRoster = [];
    this.byName = {};
    this.history = []; // [{ ts: ms, speakers: [name, ...] }]
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

  // Expose the binding so the page-realm tile observer can push events.
  // Idempotent: subsequent calls are no-ops because Playwright forbids
  // re-registering the same exposed function name.
  async expose(page) {
    if (this._exposed) return;
    await page.exposeFunction('__teamsBridgeOnRoster', (payload) => {
      try { this.ingestRosterEvent(payload); }
      catch (e) { this.logger.warn?.('[teams.roster] ingest failed', e?.message); }
    });
    this._exposed = true;
  }

  // Compatibility shim. The previous API returned a stop function from
  // start(page); some call sites store and invoke it on shutdown. The
  // tile observer disconnects itself when the page closes, so we just
  // need a no-op stop here. Kept for backwards-compatible call sites.
  start(_page) {
    return () => {};
  }

  ingestRosterEvent({ ts, list } = {}) {
    if (!Array.isArray(list)) return;
    const eventTs = Number(ts) || Date.now();

    // Update current snapshot.
    this.lastRoster = list.map((entry) => ({
      name: String(entry?.name || '').trim(),
      speaking: !!entry?.speaking,
    })).filter((e) => e.name);

    const next = {};
    this.lastRoster.forEach((entry) => { next[entry.name] = entry; });
    this.byName = next;

    // Append a history sample.
    const speakers = this.lastRoster.filter((e) => e.speaking).map((e) => e.name);
    this.history.push({ ts: eventTs, speakers });
    while (this.history.length > HISTORY_MAX_SAMPLES) this.history.shift();

    // Fire onChange only when the participant *name* set actually changed.
    // Speaking-state churn fires several events per second; we don't want
    // each transition to round-trip to the DB.
    const namesKey = this.lastRoster.map((e) => e.name).sort().join('|');
    if (namesKey !== this._lastChangeKey) {
      this._lastChangeKey = namesKey;
      if (this._onChange) {
        try { this._onChange({ list: [...this.lastRoster], ts: eventTs }); }
        catch (e) { this.logger.warn?.('[teams.roster] onChange failed', e?.message); }
      }
    }
  }

  // Find the speaker who was active during [startMs, endMs]. We tally
  // cumulative speaking time per name across history samples that overlap
  // the window and return the top scorer. If the window predates our first
  // event (cold start) or no one was flagged speaking during it, return
  // null and let the speaker mapper apply its own fallbacks.
  getActiveSpeakerInWindow(startMs, endMs) {
    const sStart = Number(startMs);
    const sEnd = Number(endMs);
    if (!Number.isFinite(sStart) || !Number.isFinite(sEnd) || sEnd <= sStart) return null;
    if (this.history.length === 0) return null;

    const tally = new Map();
    for (let i = 0; i < this.history.length; i++) {
      const sample = this.history[i];
      const next = this.history[i + 1];
      // Each sample represents the period from its ts to the next event's
      // ts (or now for the freshest sample). Cap the freshest at +5s to
      // avoid attributing to a speaker who stopped seconds ago.
      const sampleEnd = next ? next.ts : Math.min(Date.now(), sample.ts + 5_000);
      const overlapStart = Math.max(sStart, sample.ts);
      const overlapEnd = Math.min(sEnd, sampleEnd);
      if (overlapEnd <= overlapStart) continue;
      const dur = overlapEnd - overlapStart;
      for (const name of sample.speakers) {
        // Always filter the bot out — the bot is muted, so any "speaking"
        // signal Teams attaches to the bot's tile is mixed-audio bleed
        // from a shared ancestor's .vdi-frame-occlusion class. Picking
        // the bot here would label every transcribed chunk as the bot.
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

  snapshot() {
    return Object.freeze({
      list: [...this.lastRoster],
      byName: { ...this.byName },
      // Legacy field kept for any callers — index-based mapping was
      // unsound (peerId from RTCPeerConnection counter ≠ panel index).
      // New code paths should use byName or getActiveSpeakerInWindow.
      byPeerId: {},
    });
  }
}

module.exports = { RosterWatcher };
