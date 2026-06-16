'use strict';

// Enable Google Meet live captions for the bot's browser session.
//
// Captions are per-user — the bot can enable them for itself regardless
// of host settings. Earlier revs of this file led with the `c` keyboard
// shortcut which proved unreliable in practice (depends on keyboard
// focus landing in the meeting area, which Meet doesn't guarantee
// post-admission). The current implementation:
//
//   1. Wait for the toolbar to fully render (Meet streams in toolbar
//      buttons gradually as the connection establishes).
//   2. Click the captions toolbar button directly. If the button is in
//      the More overflow menu (narrow viewport), open More and click
//      it from the menu.
//   3. Keyboard shortcut as a last-resort backstop.
//   4. Verify success by polling for the captions region.
//
// Detection selectors target Meet's stable jsname attributes first
// (jsname="tgaKEf" is the captions renderer; this has held across
// multiple UI revisions where class names rotated). role + aria-label
// fallbacks cover any future jsname change.

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const CAPTIONS_REGION_SELECTORS = [
  '[jsname="tgaKEf"]',
  '[role="region"][aria-label*="aption" i]',
  '[role="region"][aria-label*="caption" i]',
];

// Time to wait for Meet's bottom toolbar to mount after admission.
// Toolbar mount is slow on the Docker / Wolfi Chromium image —
// observed empirically: a "fast" toolbar that includes the captions
// button takes 1.5–3 s on Mac native Chromium but routinely 8–12 s
// inside the wolfi-base + Xvfb container, especially when the host
// account hasn't fully resolved yet. 15 s is the new ceiling. The
// flow also retries once on miss after a 5 s settle, so a transient
// slow mount can't permanently strand the bot in audio mode.
const TOOLBAR_RENDER_MS = 15_000;
const VERIFY_TIMEOUT_MS = 5_000;
const VERIFY_POLL_MS = 250;
const RETRY_AFTER_MISS_MS = 5_000;

async function isCaptionsRegionPresent(page) {
  return page.evaluate((selectors) => {
    for (const sel of selectors) {
      try { if (document.querySelector(sel)) return true; }
      catch (_) { /* ignore */ }
    }
    return false;
  }, CAPTIONS_REGION_SELECTORS).catch(() => false);
}

async function waitForCaptionsRegion(page, timeoutMs = VERIFY_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isCaptionsRegionPresent(page)) return true;
    await sleep(VERIFY_POLL_MS);
  }
  return false;
}

// Dumps all visible button aria-labels — diagnostic for when the
// captions button can't be found. Output is logged once per attempt so
// we can see what UI string Meet shipped this week.
async function diagnoseToolbar(page, log) {
  try {
    const labels = await page.evaluate(() => {
      const out = [];
      const btns = document.querySelectorAll('button[aria-label]');
      for (const b of btns) {
        if (b.offsetParent === null) continue;
        out.push(b.getAttribute('aria-label'));
      }
      return out;
    });
    log.info?.('[gmeet.captions] visible toolbar labels:', labels.slice(0, 40));
  } catch (_) { /* ignore */ }
}

// Click the captions button on the bottom toolbar. Returns the matched
// aria-label on success, null otherwise.
async function clickToolbarCaptionsButton(page, log) {
  const result = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button[aria-label]'));
    // Prefer the EXACT "Turn on captions" string, then loose matches.
    const ranked = [];
    for (const b of buttons) {
      if (b.offsetParent === null) continue;  // skip invisible/clipped
      const aria = b.getAttribute('aria-label') || '';
      const label = aria.toLowerCase();
      // Skip obvious non-captions buttons that share substrings
      // (e.g. "Captions settings" sub-controls — we only want the
      // top-level toggle that says "Turn on…").
      if (!label.includes('caption')) continue;
      // Skip the OFF toggle (already enabled).
      if (label.includes('turn off')) {
        return { matched: 'already_on', aria };
      }
      let score = 0;
      if (label === 'turn on captions') score = 100;
      else if (label.startsWith('turn on caption')) score = 90;
      else if (label === 'captions') score = 80;
      else if (label.includes('captions on')) score = 70;
      else score = 50;
      ranked.push({ btn: b, aria, score });
    }
    ranked.sort((a, b) => b.score - a.score);
    if (!ranked.length) return { matched: null };
    const top = ranked[0];
    top.btn.click();
    return { matched: 'clicked', aria: top.aria };
  }).catch(() => ({ matched: null }));

  if (result.matched === 'already_on') {
    log.info?.('[gmeet.captions] already enabled (toolbar shows "Turn off captions")');
    return 'already_on';
  }
  if (result.matched === 'clicked') {
    log.info?.('[gmeet.captions] clicked toolbar button: ' + result.aria);
    return result.aria;
  }
  return null;
}

// Open the More overflow menu and click the Captions item. Used when
// the toolbar is too narrow and the captions button has been hidden.
async function clickMoreMenuCaptions(page, log) {
  const moreOpened = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button[aria-label]'));
    for (const b of buttons) {
      const label = (b.getAttribute('aria-label') || '').toLowerCase();
      if (b.offsetParent === null) continue;
      if (label === 'more options' || label === 'more') {
        b.click();
        return true;
      }
    }
    return false;
  }).catch(() => false);
  if (!moreOpened) {
    log.info?.('[gmeet.captions] More menu not found in toolbar');
    return false;
  }
  log.info?.('[gmeet.captions] opened More menu');
  await sleep(800);

  const clicked = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"], button'));
    for (const el of items) {
      if (el.offsetParent === null) continue;
      const label = (el.getAttribute('aria-label') || el.textContent || '').trim().toLowerCase();
      if (
        label === 'turn on captions' ||
        label === 'captions' ||
        (label.startsWith('captions') && label.length < 30) ||
        (label.includes('caption') && !label.includes('off') && !label.includes('setting'))
      ) {
        el.click();
        return el.getAttribute('aria-label') || el.textContent.trim();
      }
    }
    return null;
  }).catch(() => null);

  if (clicked) {
    log.info?.('[gmeet.captions] clicked More menu item: ' + clicked);
    return true;
  }
  // Close the menu so it doesn't sit open if we couldn't find captions.
  try { await page.keyboard.press('Escape'); } catch (_) {}
  return false;
}

async function _attemptEnable(page, log, { renderTimeoutMs }) {
  // Wait for the captions button to actually mount in the toolbar.
  // Meet streams toolbar buttons in progressively after admission;
  // confirmed via the captions-debug harness (15 toolbar buttons
  // visible after a 5 s settle, vs 10 buttons + no captions when
  // probed too early).
  const toolbarReady = await page.waitForFunction(() => {
    const btns = document.querySelectorAll('button[aria-label]');
    for (const b of btns) {
      if (b.offsetParent === null) continue;
      const a = (b.getAttribute('aria-label') || '').toLowerCase();
      if (a.includes('caption')) return true;
    }
    return false;
  }, { timeout: renderTimeoutMs, polling: 250 }).then(() => true).catch(() => false);

  if (!toolbarReady) {
    log.warn?.('[gmeet.captions] captions button not in toolbar within '
      + (renderTimeoutMs / 1000) + 's');
    return false;
  }

  if (await isCaptionsRegionPresent(page)) {
    log.info?.('[gmeet.captions] already enabled');
    return true;
  }

  // ─── Strategy 1: direct toolbar click ───────────────────────────────
  const clicked = await clickToolbarCaptionsButton(page, log);
  if (clicked === 'already_on') return true;
  if (clicked) {
    if (await waitForCaptionsRegion(page)) {
      log.info?.('[gmeet.captions] enabled via toolbar click');
      return true;
    }
    log.warn?.('[gmeet.captions] toolbar click registered but captions region did not appear');
  }

  // ─── Strategy 2: More menu ─────────────────────────────────────────
  if (await clickMoreMenuCaptions(page, log)) {
    if (await waitForCaptionsRegion(page)) {
      log.info?.('[gmeet.captions] enabled via More menu');
      return true;
    }
    log.warn?.('[gmeet.captions] More menu click registered but captions region did not appear');
  }

  // ─── Strategy 3: keyboard shortcut backstop ────────────────────────
  try {
    await page.bringToFront().catch(() => {});
    await page.evaluate(() => {
      const main = document.querySelector('[role="main"]') || document.body;
      try { main.focus(); } catch (_) {}
    }).catch(() => {});
    await page.keyboard.press('c');
    log.info?.('[gmeet.captions] sent keyboard shortcut c');
    if (await waitForCaptionsRegion(page, 2_000)) {
      log.info?.('[gmeet.captions] enabled via keyboard shortcut');
      return true;
    }
  } catch (err) {
    log.warn?.('[gmeet.captions] keyboard fallback failed: ' + (err?.message || ''));
  }

  return false;
}

async function enableLiveCaptions(page, { logger } = {}) {
  const log = logger || console;
  log.info?.('[gmeet.captions] attempting to enable live captions');

  // First pass with the full 15 s toolbar-render budget.
  if (await _attemptEnable(page, log, { renderTimeoutMs: TOOLBAR_RENDER_MS })) return true;

  // Single retry after a 5 s settle. Catches the case where the
  // first attempt raced the toolbar mount — by 5 s later the
  // captions button is reliably present (verified empirically with
  // the captions-debug harness).
  log.info?.('[gmeet.captions] first pass missed; settling '
    + (RETRY_AFTER_MISS_MS / 1000) + 's and retrying');
  await sleep(RETRY_AFTER_MISS_MS);
  if (await _attemptEnable(page, log, { renderTimeoutMs: TOOLBAR_RENDER_MS })) return true;

  log.warn?.('[gmeet.captions] all enable strategies failed across 2 attempts; observer will pick up if captions appear later');
  await diagnoseToolbar(page, log);
  return false;
}

module.exports = { enableLiveCaptions, isCaptionsRegionPresent, CAPTIONS_REGION_SELECTORS };
