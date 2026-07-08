'use strict';

const { sleep } = require('./dom');

// Enable Teams live captions for the bot's browser session.
//
// Captions are per-user, so the bot can always enable them for itself
// regardless of meeting host settings. Once enabled, the caption DOM
// elements ([data-tid="author"] + [data-tid="closed-caption-text"])
// appear in the page and are observed by the caption MutationObserver
// in recorderScript.js — those (speaker, text) pairs become our primary
// transcript signal.
//
// Flow:
//   More → (Captions OR Language and speech → Show live captions)

async function enableLiveCaptions(page, { logger, language = null } = {}) {
  const log = logger || console;
  log.info?.('[teams.captions] attempting to enable live captions');

  // Let the meeting UI settle. Without this the More menu can be unmounted.
  await sleep(3_000);

  const alreadyEnabled = await page.evaluate(
    () => !!document.querySelector('[data-tid="closed-caption-renderer-wrapper"]')
  ).catch(() => false);
  if (alreadyEnabled) {
    log.info?.('[teams.captions] already enabled');
    return true;
  }

  const programmaticResult = await page.evaluate((captionLanguage) => {
    if (typeof window.__teamsCaptionsEnableClosedCaptions !== 'function') {
      return { attempted: false, enabled: false };
    }
    return {
      attempted: true,
      enabled: !!window.__teamsCaptionsEnableClosedCaptions(captionLanguage),
    };
  }, language).catch(() => ({ attempted: false, enabled: false }));

  if (programmaticResult.enabled) {
    log.info?.('[teams.captions] enabled programmatically');
    return true;
  }
  if (programmaticResult.attempted) {
    log.warn?.('[teams.captions] programmatic enable failed, falling back to UI');
  }

  try {
    const moreButton = page.locator(
      '#callingButtons-showMoreBtn, button[aria-label="More"], button[aria-label="More options"], button[aria-label*="More" i]'
    ).first();
    await moreButton.click({ timeout: 8_000 });
    log.info?.('[teams.captions] clicked More menu');
    await sleep(1_000);

    const enableResult = await page.evaluate(() => {
      const visible = Array.from(
        document.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]')
      ).filter((el) => el.offsetParent !== null);
      const texts = visible.map((el) => (el.textContent || '').trim().toLowerCase());

      // Path A (guest): direct "Captions" menu item.
      for (const el of visible) {
        const t = (el.textContent || '').trim().toLowerCase();
        if (t === 'captions' || t === 'show live captions' || t === 'turn on live captions') {
          el.click();
          return { clicked: (el.textContent || '').trim(), path: 'direct' };
        }
      }
      // Path B (host): "Language and speech" → submenu.
      for (const el of visible) {
        const t = (el.textContent || '').toLowerCase();
        if (t.includes('language') && t.includes('speech')) {
          el.click();
          return { clicked: (el.textContent || '').trim(), path: 'submenu' };
        }
      }
      return { clicked: null, path: 'none', available: texts.join(' | ') };
    }).catch(() => ({ clicked: null, path: 'error' }));

    if (!enableResult.clicked) {
      log.warn?.('[teams.captions] could not find captions menu item', enableResult);
      try { await page.keyboard.press('Escape'); } catch (_) {}
      return false;
    }
    log.info?.('[teams.captions] clicked: ' + enableResult.clicked + ' (' + enableResult.path + ')');
    await sleep(1_000);

    if (enableResult.path === 'submenu') {
      const sub = await page.evaluate(() => {
        const items = document.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]');
        for (const el of items) {
          const t = (el.textContent || '').toLowerCase();
          if (t.includes('live captions') && el.offsetParent) {
            el.click();
            return (el.textContent || '').trim();
          }
        }
        return null;
      }).catch(() => null);
      if (sub) log.info?.('[teams.captions] clicked submenu: ' + sub);
      else log.warn?.('[teams.captions] could not find live captions in submenu');
      await sleep(1_500);
    }

    const verified = await page.evaluate(
      () => !!document.querySelector('[data-tid="closed-caption-renderer-wrapper"]')
    ).catch(() => false);
    if (verified) {
      log.info?.('[teams.captions] live captions enabled');
    } else {
      log.info?.('[teams.captions] menu clicked, wrapper not yet present — observer will pick up when it appears');
    }
    return true;
  } catch (err) {
    log.warn?.('[teams.captions] enable failed: ' + (err?.message || String(err)));
    try { await page.keyboard.press('Escape'); } catch (_) {}
    return false;
  }
}

module.exports = { enableLiveCaptions };
