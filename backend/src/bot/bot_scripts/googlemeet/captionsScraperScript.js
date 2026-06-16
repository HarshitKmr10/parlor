'use strict';

// Page-realm captions scraper for Google Meet. Watches the live-captions
// region and emits one final segment per utterance to Node via
// window.__gmeetBridgeOnCaption.
//
// Architecture mirrors Teams' ClosedCaptionManager (PR #3507) in
// spirit: each in-flight utterance is a single entry that gets
// upserted as the text grows, and we only emit when it's "final"
// (stability window has elapsed, the entry was dropped from the DOM,
// or a different speaker took the slot).
//
// The key challenge for Meet vs Teams: Teams gets stable
// (deviceId, captionId) per-utterance from the WebRTC data channel.
// Meet's DOM has no such identifier. We solve it by keying on the
// DOM ELEMENT itself — the same row element across ticks IS the same
// utterance; a new element means a new one. Meet routinely rotates
// caption blocks (drops old ones, mounts new ones), so this gives us
// the right identity even when row indexes shuffle.
//
// Two layers of dedup:
//   1. Per-entry: emit only the suffix beyond what this entry already
//      emitted (handles "same DOM block keeps growing").
//   2. Per-speaker tail (last ~600 chars emitted): if Meet drops and
//      re-creates an element with overlapping content (rare but seen
//      in remount-during-monologue), strip any prefix that overlaps
//      with the speaker's recently-emitted ledger before emitting.

const SCRIPT = `
(() => {
  if (window.__gmeetCaptionsScraperInstalled) return;
  window.__gmeetCaptionsScraperInstalled = true;

  const TAG = '[gmeet.captions]';
  const REGION_SELECTORS = [
    '[jsname="tgaKEf"]',
    '[role="region"][aria-label*="aption" i]',
    '[role="region"][aria-label*="caption" i]',
  ];
  const POLL_MS = 500;
  const STABILITY_MS = 2_500;
  const MIN_TEXT_LEN = 4;
  const STATS_LOG_MS = 15_000;
  const SPEAKER_TAIL_KEEP_CHARS = 600;
  const NAME_SELECTORS = ['span.notranslate', '[data-self-name]', '.zWGUib'];
  const UI_DENYLIST = new Set([
    'jump to bottom', 'show captions', 'hide captions', 'turn on captions',
    'turn off captions', 'captions', 'live captions', 'translation',
    'jump to latest',
  ]);

  function log() { try { console.log.apply(console, [TAG].concat(Array.from(arguments))); } catch (_) {} }

  function findRegion() {
    for (const sel of REGION_SELECTORS) {
      try {
        const el = document.querySelector(sel);
        if (el) return el;
      } catch (_) { /* ignore */ }
    }
    return null;
  }

  function isUiBlock(row, text) {
    const lower = text.toLowerCase();
    if (UI_DENYLIST.has(lower)) return true;
    try {
      if (row.querySelector('button, [role="button"], a[role="button"]')) return true;
    } catch (_) { /* ignore */ }
    return false;
  }

  function parseRow(row) {
    const rowText = (row.textContent || '').trim();
    if (rowText.length < MIN_TEXT_LEN) return null;
    if (isUiBlock(row, rowText)) return null;

    // Speaker name node — short text, leaf (no nested text children).
    let nameNode = null;
    let textNode = null;
    const all = row.querySelectorAll('div, span');
    for (const n of all) {
      const t = (n.textContent || '').trim();
      if (!t) continue;
      const hasTextChild = Array.from(n.children).some((c) => (c.textContent || '').trim());
      if (hasTextChild) continue;
      if (t.length <= 50 && !nameNode) nameNode = n;
      else if (t.length > 4) textNode = n;
    }
    let speaker = nameNode ? (nameNode.textContent || '').trim() : null;
    let captionText = textNode ? (textNode.textContent || '').trim() : rowText;
    if (speaker && captionText.startsWith(speaker)) {
      captionText = captionText.slice(speaker.length).trim();
    }
    if (captionText.length < MIN_TEXT_LEN) return null;
    return { speaker, text: captionText };
  }

  // ─── Entry registry ──────────────────────────────────────────────────
  // Keyed by DOM element. Same element across ticks = same utterance.
  // When the element vanishes from region.children (Meet rotated it
  // off-screen), the entry's last text is emitted as final and the
  // entry is removed.
  //
  // entry shape:
  //   { id, speaker, text, firstSeenTs, lastChangedTs,
  //     emitted: bool, lastEmittedText: string }
  const entries = new Map();
  let nextEntryId = 1;

  // Per-speaker ledger (last 600 chars actually emitted to Node).
  // Used as a second-layer dedup when Meet remounts a DOM element
  // with text that overlaps a previous emission — without this, the
  // remount looks like a fresh entry to per-entry dedup, and we'd
  // re-emit the overlapping prefix.
  const speakerEmittedTail = new Map();

  function appendToSpeakerTail(speaker, text) {
    if (!speaker || !text) return;
    const prev = speakerEmittedTail.get(speaker) || '';
    const merged = (prev + ' ' + text).slice(-SPEAKER_TAIL_KEEP_CHARS);
    speakerEmittedTail.set(speaker, merged);
  }

  function stripSpeakerOverlap(speaker, candidate) {
    if (!speaker || !candidate) return candidate;
    const tail = speakerEmittedTail.get(speaker);
    if (!tail) return candidate;
    // Find longest suffix of tail that is a prefix of candidate.
    // Walk from longest to shortest; first hit wins.
    const maxLen = Math.min(tail.length, candidate.length);
    for (let n = maxLen; n >= 15; n -= 1) {
      const tailSuf = tail.slice(-n).trim();
      if (!tailSuf) continue;
      if (candidate.startsWith(tailSuf)) {
        return candidate.slice(tailSuf.length).trim();
      }
    }
    return candidate;
  }

  let stats = { emitted: 0, dedupedEmpty: 0, regionMissingTicks: 0, lastStatsLog: 0 };

  function bridgeEmit(speaker, text) {
    if (!text || text.length < MIN_TEXT_LEN) { stats.dedupedEmpty += 1; return; }
    if (typeof window.__gmeetBridgeOnCaption === 'function') {
      try {
        window.__gmeetBridgeOnCaption({
          speaker: speaker || null,
          text,
          ts_ms: Date.now(),
        });
        stats.emitted += 1;
        appendToSpeakerTail(speaker, text);
      } catch (e) { log('bridge call failed', e && e.message); }
    }
  }

  function maybeFlushEntry(entry, reason) {
    if (entry.emitted && entry.lastEmittedText === entry.text) return;

    // Layer 1: per-entry suffix. If we already emitted some text for
    // this entry, skip that prefix.
    let toEmit = entry.text;
    if (entry.lastEmittedText && entry.text.length > entry.lastEmittedText.length
      && entry.text.startsWith(entry.lastEmittedText)) {
      toEmit = entry.text.slice(entry.lastEmittedText.length).trim();
    }

    // Layer 2: per-speaker tail. Catches cases where Meet remounts
    // a DOM element with overlapping content (per-entry can't see
    // across element identity boundaries).
    toEmit = stripSpeakerOverlap(entry.speaker, toEmit);

    if (toEmit.length < MIN_TEXT_LEN) {
      // Nothing genuinely new — mark as fully emitted up-to-here so
      // we don't keep re-checking on every stability window.
      entry.emitted = true;
      entry.lastEmittedText = entry.text;
      return;
    }

    log('flush', reason, JSON.stringify({
      id: entry.id, speaker: entry.speaker,
      len_full: entry.text.length, len_emit: toEmit.length,
    }));
    bridgeEmit(entry.speaker, toEmit);
    entry.emitted = true;
    entry.lastEmittedText = entry.text;
  }

  function tick() {
    const region = findRegion();
    if (!region) {
      stats.regionMissingTicks += 1;
      return;
    }
    const now = Date.now();
    const visibleElements = new Set();
    const visibleRows = Array.from(region.children);

    for (const rowEl of visibleRows) {
      const block = parseRow(rowEl);
      if (!block) continue;
      visibleElements.add(rowEl);

      let entry = entries.get(rowEl);
      if (!entry) {
        entry = {
          id: 'cap-' + nextEntryId++,
          speaker: block.speaker,
          text: block.text,
          firstSeenTs: now,
          lastChangedTs: now,
          emitted: false,
          lastEmittedText: '',
        };
        entries.set(rowEl, entry);
        continue;
      }
      // Same DOM element, possibly updated text. Allow the speaker to
      // change too — Meet sometimes reuses elements when a different
      // person starts talking; treat that as a different utterance by
      // resetting lastEmittedText so the new content emits cleanly
      // (per-speaker ledger handles overlap if any).
      if (entry.speaker !== block.speaker) {
        // Flush the old utterance under the previous speaker before
        // we lose it.
        if (!entry.emitted) maybeFlushEntry(entry, 'speaker_changed');
        entry.speaker = block.speaker;
        entry.text = block.text;
        entry.lastChangedTs = now;
        entry.emitted = false;
        entry.lastEmittedText = '';
        continue;
      }
      if (entry.text !== block.text) {
        entry.text = block.text;
        entry.lastChangedTs = now;
        // Text grew (or changed) after our last emission → re-emit
        // (the SUFFIX, via maybeFlushEntry's per-entry layer) on the
        // next stability window.
        if (entry.emitted) entry.emitted = false;
      }
    }

    // DROPPED: entries whose DOM element is no longer in the region.
    // These were rotated off-screen by Meet — emit their final text
    // and clean up.
    for (const [el, entry] of Array.from(entries.entries())) {
      if (visibleElements.has(el)) continue;
      maybeFlushEntry(entry, 'dropped');
      entries.delete(el);
    }

    // STABILITY: visible entries that haven't changed for STABILITY_MS.
    for (const [el, entry] of entries) {
      if (entry.emitted) continue;
      if (now - entry.lastChangedTs >= STABILITY_MS) {
        maybeFlushEntry(entry, 'stable');
      }
    }

    if (now - stats.lastStatsLog >= STATS_LOG_MS) {
      stats.lastStatsLog = now;
      const pending = Array.from(entries.values()).filter((e) => !e.emitted).length;
      log('stats', JSON.stringify({
        entries_tracked: entries.size,
        entries_pending: pending,
        emitted: stats.emitted,
        deduped_empty: stats.dedupedEmpty,
        region_missing_ticks: stats.regionMissingTicks,
      }));
    }
  }

  function start() {
    log('captions scraper installed; polling every', POLL_MS, 'ms');
    setInterval(tick, POLL_MS);
    const bodyObserver = new MutationObserver(() => {
      const region = findRegion();
      if (!region || region.__gmeetObserverAttached) return;
      region.__gmeetObserverAttached = true;
      const inner = new MutationObserver(() => tick());
      inner.observe(region, { childList: true, subtree: true, characterData: true });
      log('inner observer attached to captions region');
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  // Diagnostics handle for tests / harnesses.
  window.__gmeetCaptionsSnapshot = () => ({
    entries_tracked: entries.size,
    entries: Array.from(entries.values()).map((e) => ({
      id: e.id, speaker: e.speaker, text_len: e.text.length,
      emitted: e.emitted, last_emitted_len: e.lastEmittedText.length,
    })),
    speaker_tails: Array.from(speakerEmittedTail.entries())
      .map(([s, t]) => ({ speaker: s, tail_len: t.length })),
    stats: { ...stats },
  });

  // Flush hook (SHUTDOWN). Caller invokes this on bot leave so the
  // last in-progress utterance gets persisted instead of dropped on
  // browser teardown.
  window.__gmeetCaptionsFlushAll = () => {
    let n = 0;
    for (const entry of entries.values()) {
      if (!entry.emitted) { maybeFlushEntry(entry, 'shutdown'); n += 1; }
    }
    return n;
  };
})();
`;

module.exports = { SCRIPT };
