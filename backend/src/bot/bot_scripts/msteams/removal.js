'use strict';

const sel = require('./selectors');
const { raceAny, sleep } = require('./dom');

// Polls cheaply for "you were removed / meeting ended" markers while the
// meeting is running. Three signals (matches Vexa's checkForRemoval in
// recording.ts:1314-1352):
//
//   1. Strict selector match against text="..." nodes — fast Playwright path.
//   2. Body-text substring scan — catches phrasing variants Teams uses
//      (e.g. "the meeting has ended" vs "Meeting ended").
//   3. Visible Rejoin / Dismiss button — Teams shows this when the meeting
//      ended on the host side and the bot is parked in the post-meeting
//      state.
//
// Emits exactly once via onRemoved and returns. Cancellation is via the
// abort signal — caller passes a controller and aborts on leave.

const REMOVAL_PHRASES = [
  "you've been removed from this meeting",
  'you have been removed from this meeting',
  'removed from meeting',
  'meeting ended',
  'meeting has ended',
  'call ended',
  'connection lost',
  'unable to connect',
];

async function bodyTextOrButtonRemoval(page) {
  return page.evaluate((phrases) => {
    try {
      const bodyText = (document.body?.innerText || '').toLowerCase();
      for (const p of phrases) {
        if (bodyText.includes(p)) return { reason: 'body_text', match: p };
      }
      const buttons = Array.from(document.querySelectorAll('button'));
      for (const btn of buttons) {
        const txt = ((btn.textContent || btn.innerText || '') + '').trim().toLowerCase();
        const aria = ((btn.getAttribute('aria-label') || '') + '').toLowerCase();
        if (txt === 'rejoin' || txt === 'dismiss' || aria.includes('rejoin') || aria.includes('dismiss')) {
          if (btn.offsetWidth > 0 && btn.offsetHeight > 0) {
            const cs = window.getComputedStyle(btn);
            if (cs.display !== 'none' && cs.visibility !== 'hidden') {
              return { reason: 'rejoin_button', match: txt || aria };
            }
          }
        }
      }
      return null;
    } catch (_e) {
      return null;
    }
  }, REMOVAL_PHRASES).catch(() => null);
}

async function watchRemoval(page, { signal, intervalMs = 1_200, onRemoved }) {
  while (!signal?.aborted) {
    // Strict selector match first — this is what Playwright optimises for.
    const found = await raceAny(page, sel.removalMarkers, { timeoutMs: 200, intervalMs: 100 });
    if (found) {
      await found.handle.dispose().catch(() => {});
      if (typeof onRemoved === 'function') {
        try { onRemoved({ selector: found.selector, ts: Date.now(), via: 'selector' }); } catch (_) {}
      }
      return;
    }

    // Substring + button scan as a backup for phrasing variants the strict
    // selectors don't cover.
    const heuristic = await bodyTextOrButtonRemoval(page);
    if (heuristic) {
      if (typeof onRemoved === 'function') {
        try {
          onRemoved({
            selector: 'page.evaluate',
            via: heuristic.reason,
            match: heuristic.match,
            ts: Date.now(),
          });
        } catch (_) {}
      }
      return;
    }

    await sleep(intervalMs);
  }
}

module.exports = { watchRemoval, REMOVAL_PHRASES };
