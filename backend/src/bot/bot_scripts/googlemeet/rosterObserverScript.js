'use strict';

// Page-realm tile observer for Google Meet. Mirrors the pattern Teams
// uses but with Meet-specific selectors verified during the Phase 0
// probe:
//   - Participant tiles carry `data-participant-id`
//   - Display names live in `span.notranslate` (with fallbacks)
//   - Active-speaker animation toggles classes
//     `Oaajhc / HX2H7 / wEsLMd / OgVli` on a descendant of the tile
//
// We coalesce mutations through a 200 ms debounce so the binding is
// called at most ~5x/s during heavy churn, and then push a normalised
// `[{ participantId, name, speaking }]` list to Node via
// `window.__gmeetBridgeOnRoster`.

const SCRIPT = `
(() => {
  if (window.__gmeetRosterObserverInstalled) return;
  window.__gmeetRosterObserverInstalled = true;

  const TAG = '[gmeet.roster]';
  const SPEAKING_CLASSES = ['Oaajhc', 'HX2H7', 'wEsLMd', 'OgVli'];
  const NAME_SELECTORS = ['span.notranslate', '[data-self-name]', '.zWGUib'];
  const TILE_SELECTOR = '[data-participant-id]';
  const DEBOUNCE_MS = 200;

  function log() {
    try { console.log.apply(console, [TAG].concat(Array.from(arguments))); } catch (_) {}
  }

  function findName(tile) {
    for (const sel of NAME_SELECTORS) {
      const el = tile.querySelector(sel);
      if (el && el.textContent) {
        const txt = el.textContent.trim();
        if (txt) return txt;
      }
    }
    const selfName = tile.getAttribute('data-self-name');
    if (selfName && selfName.trim()) return selfName.trim();
    return null;
  }

  function isTileSpeaking(tile) {
    for (const cls of SPEAKING_CLASSES) {
      if (tile.querySelector('.' + cls)) return true;
      if (tile.classList && tile.classList.contains(cls)) return true;
    }
    return false;
  }

  function buildRoster() {
    const tiles = Array.from(document.querySelectorAll(TILE_SELECTOR));
    // De-dupe by participantId (Meet renders the active-speaker tile
    // and the spotlight tile as separate DOM nodes for the same human;
    // we only want one entry per identity).
    const byPid = new Map();
    for (const tile of tiles) {
      const pid = tile.getAttribute('data-participant-id');
      if (!pid) continue;
      const name = findName(tile);
      if (!name) continue;
      const speaking = isTileSpeaking(tile);
      const existing = byPid.get(pid);
      if (existing) {
        // Merge: a participant has multiple tiles; treat as speaking if
        // ANY of them shows the speaking class.
        existing.speaking = existing.speaking || speaking;
      } else {
        byPid.set(pid, { participantId: pid, name, speaking });
      }
    }
    return Array.from(byPid.values());
  }

  let pending = null;
  function flush() {
    pending = null;
    let list;
    try { list = buildRoster(); }
    catch (e) { log('roster build failed', e && e.message); return; }
    try {
      if (typeof window.__gmeetBridgeOnRoster === 'function') {
        window.__gmeetBridgeOnRoster({ ts: Date.now(), list });
      }
    } catch (e) {
      log('bridge failed', e && e.message);
    }
  }

  function schedule() {
    if (pending) return;
    pending = setTimeout(flush, DEBOUNCE_MS);
  }

  // Bootstrap: emit one initial sample once the meeting body is present,
  // then watch for mutations on the meeting container subtree.
  function startObserver() {
    const target = document.querySelector('[jsname="BOHaEe"]') || document.body;
    const observer = new MutationObserver(schedule);
    observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-participant-id', 'aria-label'],
    });
    log('observer installed on', target.tagName + (target.id ? '#' + target.id : ''));
    flush();
    // Also poll every 2 s as a safety net — Meet sometimes mutates DOM
    // outside the observed subtree (e.g. participant panel in a portal).
    setInterval(schedule, 2_000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }
})();
`;

module.exports = { SCRIPT };
