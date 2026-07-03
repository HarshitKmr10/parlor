'use strict';

// Page-realm speaker observer — Vexa-style.
//
// Watches the gallery video tiles directly (not the People panel) and emits
// (name, speaking) snapshots to Node whenever the speaking state of any
// participant changes. Two reasons this beats panel polling:
//
//   1. Tiles are always rendered in the meeting view; the People panel may
//      not be openable on guest/lightExperience Teams.
//   2. Speaking detection is event-driven (MutationObserver on the
//      voice-level-stream-outline element + .vdi-frame-occlusion class)
//      instead of a 4 s poll, so the speaker we attribute to an audio
//      chunk is the one who was actually speaking when the chunk recorded.

const SCRIPT = `
(() => {
  if (window.__teamsTileObserverInstalled) return;
  window.__teamsTileObserverInstalled = true;

  const TAG = '[teams.tiles]';
  try { console.log(TAG, 'installed'); } catch (_) {}

  // Vexa's selectors — the union of every Teams gallery tile shape we've
  // seen. New Teams variants land here over time; add to this list rather
  // than the name selectors below if you discover a new tile container.
  const PARTICIPANT_SELECTORS = [
    '[data-tid*="participant"]',
    '[data-tid*="roster-item"]',
    '[data-tid*="video-tile"]',
    '[data-tid*="videoTile"]',
    '.participant-tile',
    '.video-tile',
  ];

  // Vexa's name selectors — try these in order inside each tile. The
  // obfuscated div class first (Teams' build-time hash for the name node)
  // because data-tid attributes are absent on lightExperience tiles.
  const NAME_SELECTORS = [
    'div[class*="___2u340f0"]',
    '[data-tid*="display-name"]',
    '[data-tid*="participant-name"]',
    '[data-tid*="user-name"]',
    '.ms-Persona-primaryText',
    '[aria-label*="name"]',
    'span[title]',
    '[title*="name"]',
    '.participant-name',
    '.display-name',
    '.user-name',
    '.roster-item-name',
    '.video-tile-name',
  ];

  // Substrings that mean "this is a button/icon label, not a person's
  // name" — Teams reuses the same DOM shape for control affordances.
  const FORBIDDEN_NAME_SUBSTRINGS = [
    'more_vert', 'mic_off', 'mic', 'videocam', 'videocam_off',
    'present_to_all', 'devices', 'speaker', 'speakers', 'microphone',
    'camera', 'camera_off', 'share', 'chat', 'participant', 'user',
  ];

  const VOICE_SELECTOR = '[data-tid="voice-level-stream-outline"]';
  const VDI_CLASS = 'vdi-frame-occlusion';

  const tileState = new Map(); // element → { name, isSpeaking, observers }
  let lastEmitKey = '';

  function isPlausibleName(raw) {
    if (!raw) return false;
    const trimmed = raw.trim();
    if (trimmed.length < 2 || trimmed.length > 50) return false;
    const lower = trimmed.toLowerCase();
    if (FORBIDDEN_NAME_SUBSTRINGS.some((s) => lower.includes(s))) return false;
    return true;
  }

  function extractName(el) {
    for (const sel of NAME_SELECTORS) {
      let nameEl;
      try { nameEl = el.querySelector(sel); } catch (_) { continue; }
      if (!nameEl) continue;
      const raw = (nameEl.textContent || nameEl.innerText
        || nameEl.getAttribute('title') || nameEl.getAttribute('aria-label')
        || '').trim();
      if (isPlausibleName(raw)) return raw;
    }
    // Tile-level fallbacks. lightExperience often puts the participant
    // name only on the tile's own aria-label (e.g. "Alice Wong, video on")
    // with no descendant name node. Pull it from there if no descendant
    // name selector hit.
    const tileAria = el.getAttribute && el.getAttribute('aria-label');
    if (tileAria) {
      const candidate = tileAria.split(',')[0].trim();
      if (isPlausibleName(candidate)) return candidate;
    }
    const tileTitle = el.getAttribute && el.getAttribute('title');
    if (isPlausibleName(tileTitle)) return tileTitle.trim();
    // Last resort for the new Teams tile shape: the participant-avatar
    // element renders an <img src=".../avatar?displayName=Jane%20Doe
    // &size=HR196x196">. The displayName query param is the cleanest
    // possible source of the participant's name when no aria label is set.
    let avatarImg;
    try { avatarImg = el.querySelector('img[src*="displayName="]'); } catch (_) { avatarImg = null; }
    if (avatarImg) {
      const src = avatarImg.getAttribute('src') || '';
      const m = src.match(/[?&]displayName=([^&]+)/);
      if (m) {
        try {
          const decoded = decodeURIComponent(m[1].replace(/\\+/g, ' ')).trim();
          if (isPlausibleName(decoded)) return decoded;
        } catch (_) {}
      }
    }
    return null;
  }

  // The element our selector union matches may be a sub-component of the
  // actual tile (e.g. participant-avatar, which contains only the headshot
  // image). Walk up to the nearest ancestor that also contains a
  // voice-level-stream-outline element — that's the enclosing tile and
  // the right scope for both name extraction and speaking detection.
  // Cap the climb at 8 levels so we don't accidentally promote to body.
  function findTileContainer(el) {
    let cur = el;
    for (let i = 0; i < 8 && cur; i++) {
      let voice = null;
      try { voice = cur.querySelector(VOICE_SELECTOR); } catch (_) {}
      if (voice) return cur;
      cur = cur.parentElement;
    }
    return el;
  }

  // Speaking detection mirrors Vexa: voice-level-stream-outline must exist
  // (means the participant has audio routing), and .vdi-frame-occlusion
  // must be present on it or any ancestor (means audio energy threshold
  // is currently met). The class toggles in real time — this is why we
  // observe attribute mutations on it instead of polling.
  function checkSpeaking(el) {
    let voice;
    try { voice = el.querySelector(VOICE_SELECTOR); } catch (_) { voice = null; }
    if (!voice) return { hasSignal: false, speaking: false };
    let cur = voice;
    while (cur) {
      if (cur.classList && cur.classList.contains(VDI_CLASS)) {
        return { hasSignal: true, speaking: true };
      }
      cur = cur.parentElement;
    }
    return { hasSignal: true, speaking: false };
  }

  function emitRoster() {
    // Build dedup'd list across tiles — gallery + sidebar may render the
    // same person twice. If any instance is speaking, the merged entry is
    // marked speaking.
    const merged = new Map();
    tileState.forEach((tile) => {
      if (!tile.name) return;
      const prev = merged.get(tile.name);
      if (!prev || tile.isSpeaking) {
        merged.set(tile.name, { name: tile.name, speaking: !!tile.isSpeaking });
      }
    });
    const list = [...merged.values()];
    const key = list.map((p) => p.name + ':' + (p.speaking ? '1' : '0')).sort().join('|');
    if (key === lastEmitKey) return;
    lastEmitKey = key;
    if (typeof window.__teamsBridgeOnRoster === 'function') {
      try { window.__teamsBridgeOnRoster({ ts: Date.now(), list }); }
      catch (e) { try { console.warn(TAG, 'roster bridge call failed', e && e.message); } catch (_) {} }
    }
  }

  // One-shot dump of a tile's structure when name extraction fails. Lets
  // us discover the right selectors on a new Teams variant from the logs.
  // Capped at 3 dumps total so a meeting full of unmatched tiles can't
  // flood the log.
  let unmatchedDumps = 0;
  function dumpTileShape(el) {
    if (unmatchedDumps >= 3) return;
    unmatchedDumps += 1;
    try {
      const tid = el.getAttribute && el.getAttribute('data-tid');
      const aria = el.getAttribute && el.getAttribute('aria-label');
      const innerTids = [];
      el.querySelectorAll('[data-tid]').forEach((c) => {
        const t = c.getAttribute('data-tid');
        if (t && innerTids.length < 20) innerTids.push(t);
      });
      const html = (el.outerHTML || '').slice(0, 600);
      console.log(TAG, 'unmatched-tile', { data_tid: tid, aria_label: aria, inner_tids: innerTids, html_head: html });
    } catch (_) {}
  }

  function observeTile(rawEl) {
    // Promote the matched element to its enclosing tile container — the
    // smallest ancestor that also contains the voice-level signal. The
    // participant-avatar div alone has the name (in its <img src>) but
    // not the speaking signal; the parent has both.
    const el = findTileContainer(rawEl);
    if (tileState.has(el)) return;
    const name = extractName(el);
    if (!name) {
      dumpTileShape(el);
      return; // tile not yet ready; the sweep loop will retry.
    }

    const tile = { name, isSpeaking: false, observers: [] };
    tileState.set(el, tile);
    try { console.log(TAG, 'tile observed', name); } catch (_) {}

    const recheck = () => {
      if (!el.isConnected) return;
      const result = checkSpeaking(el);
      if (!result.hasSignal) return;
      const wasSpeaking = tile.isSpeaking;
      tile.isSpeaking = result.speaking;
      if (wasSpeaking !== result.speaking) {
        try { console.log(TAG, name, result.speaking ? 'speaking' : 'silent'); } catch (_) {}
        emitRoster();
      }
    };

    let voice;
    try { voice = el.querySelector(VOICE_SELECTOR); } catch (_) { voice = null; }
    if (voice) {
      const o = new MutationObserver(recheck);
      try {
        o.observe(voice, { attributes: true, attributeFilter: ['class', 'style', 'aria-hidden'] });
        tile.observers.push(o);
      } catch (_) {}
    }
    // Container observer: catches voice-level being added/removed and any
    // subtree restructure that would invalidate the voice-element handle.
    const containerObs = new MutationObserver(recheck);
    try {
      containerObs.observe(el, { childList: true, subtree: true });
      tile.observers.push(containerObs);
    } catch (_) {}

    recheck();
    emitRoster();
  }

  function detachTile(el) {
    const tile = tileState.get(el);
    if (!tile) return;
    for (const o of tile.observers) {
      try { o.disconnect(); } catch (_) {}
    }
    tileState.delete(el);
    emitRoster();
  }

  let lastSweepShape = '';
  function sweep() {
    let elems;
    try {
      elems = document.querySelectorAll(PARTICIPANT_SELECTORS.join(', '));
    } catch (_) { elems = []; }
    const seen = new Set();
    elems.forEach((el) => { observeTile(el); seen.add(el); });
    // Drop tiles that left the DOM since last sweep.
    tileState.forEach((_state, el) => {
      if (!seen.has(el) || !el.isConnected) detachTile(el);
    });
    // Surface a per-shape diagnostic when the sweep result changes (number
    // of tiles or number with names extracted), so we can tell whether
    // selectors are matching at all on a given Teams variant.
    let withName = 0;
    tileState.forEach((s) => { if (s.name) withName += 1; });
    const shape = elems.length + ':' + withName;
    if (shape !== lastSweepShape) {
      lastSweepShape = shape;
      try { console.log(TAG, 'sweep', { tiles_matched: elems.length, observed_with_name: withName, observed_total: tileState.size }); } catch (_) {}
    }
  }

  setInterval(sweep, 1_000);
  setTimeout(sweep, 500);

  // Diagnostic: 6s after install, if nothing matched the participant
  // selectors, dump a sample of the data-tid values present in the DOM.
  // Lets us discover the right selector for whatever Teams variant we're
  // running into without redeploying.
  setTimeout(() => {
    if (tileState.size > 0) return;
    try {
      const tids = new Set();
      document.querySelectorAll('[data-tid]').forEach((el) => {
        const t = el.getAttribute('data-tid');
        if (t) tids.add(t);
      });
      const sample = [...tids].slice(0, 40);
      console.log(TAG, 'no tiles matched, data-tid sample:', sample);
    } catch (_) {}
  }, 6_000);

  window.__teamsTileObserverStop = () => {
    tileState.forEach((_s, el) => detachTile(el));
  };
})();
`;

module.exports = { SCRIPT };
