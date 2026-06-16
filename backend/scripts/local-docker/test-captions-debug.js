#!/usr/bin/env node
'use strict';

// Debug-only harness for the Meet captions enable flow. Joins the
// meeting like the real bot, then walks the toolbar AND opens the
// More menu, dumping every visible item (text, role, aria-label,
// visibility, click target) to a JSON file on the host.
//
// Use this when captions enable fails ("captions enable result
// { enabled: false }"): the dumped JSON shows exactly what aria
// strings / menu items Meet rendered in this UI rev / locale, so
// we can fix captions.js to match.

require('dotenv').config({ path: '/app/.env' });

const fs = require('fs');
const path = require('path');

const { launchBrowser, closeBrowser, takeScreenshot } = require(
  '/app/src/bot/bot_scripts/googlemeet/browser',
);
const { joinGoogleMeetMeeting } = require(
  '/app/src/bot/bot_scripts/googlemeet/join',
);
const { waitForAdmission } = require(
  '/app/src/bot/bot_scripts/googlemeet/admission',
);

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function dumpAllInteractables(page) {
  return page.evaluate(() => {
    const visible = (el) => el && el.offsetParent !== null;
    const summarize = (el) => ({
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role'),
      jsname: el.getAttribute('jsname'),
      ariaLabel: el.getAttribute('aria-label'),
      tooltip: el.getAttribute('data-tooltip'),
      text: (el.textContent || '').trim().slice(0, 100),
      classes: (el.getAttribute('class') || '').split(/\s+/).slice(0, 4).join(' '),
    });
    const buttons = Array.from(document.querySelectorAll('button[aria-label], button[data-tooltip]'))
      .filter(visible).map(summarize);
    const menuItems = Array.from(document.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]'))
      .filter(visible).map(summarize);
    const tooltipsAndDialogs = Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"], [role="tooltip"]'))
      .filter(visible).map(summarize);
    return { buttons, menuItems, tooltipsAndDialogs, url: location.href };
  }).catch((e) => ({ error: e.message }));
}

async function clickFirst(page, predicate) {
  return page.evaluate((pred) => {
    const fn = new Function('label', 'role', 'text', 'return (' + pred + ')(label, role, text);');
    const candidates = Array.from(document.querySelectorAll('button[aria-label], [role="menuitem"], [role="button"]'));
    for (const el of candidates) {
      if (el.offsetParent === null) continue;
      const label = el.getAttribute('aria-label') || '';
      const role = el.getAttribute('role') || el.tagName.toLowerCase();
      const text = (el.textContent || '').trim();
      try {
        if (fn(label, role, text)) {
          el.click();
          return { clicked: true, label, role, text };
        }
      } catch (_) { /* skip */ }
    }
    return { clicked: false };
  }, predicate.toString());
}

async function main() {
  const meetingUrl = process.argv[2];
  if (!meetingUrl || !meetingUrl.startsWith('http')) {
    console.error('Usage: test-captions-debug.js <meetUrl>');
    process.exit(2);
  }
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join('/app/out', 'captions-debug', ts);
  fs.mkdirSync(outDir, { recursive: true });
  console.log('[captions-debug] meeting:', meetingUrl);
  console.log('[captions-debug] out dir:', outDir);

  const { browser, context, page } = await launchBrowser({ headless: false });
  page.on('console', (msg) => {
    const text = msg.text() || '';
    if (text.includes('GoogleMeet') || text.includes('gmeet')) console.log('[page]', msg.type(), text);
  });

  try {
    await joinGoogleMeetMeeting(page, meetingUrl, 'Captions Debug Bot', {
      screenshotPath: outDir, takeScreenshots: true,
    });
    await waitForAdmission(page, 240_000, { screenshotPath: outDir });
    console.log('[captions-debug] admitted, settling for 5 s before probing');
    await sleep(5_000);
    await takeScreenshot(page, outDir, 'admitted_settled').catch(() => {});

    // (1) snapshot the toolbar before opening anything
    const beforeMore = await dumpAllInteractables(page);
    fs.writeFileSync(path.join(outDir, '01-before-more.json'), JSON.stringify(beforeMore, null, 2));
    console.log('[captions-debug] step 1 — toolbar buttons (', beforeMore.buttons?.length, '):');
    (beforeMore.buttons || []).forEach((b) => console.log('   •', JSON.stringify(b)));

    // (2) open the More menu by exact aria-label match
    console.log('[captions-debug] opening More menu…');
    const moreClick = await clickFirst(page, (label/* , role, text */) => {
      const l = (label || '').toLowerCase();
      return l === 'more options' || l === 'more';
    });
    console.log('[captions-debug] more click:', JSON.stringify(moreClick));
    await sleep(1_500);
    await takeScreenshot(page, outDir, 'more_menu_open').catch(() => {});

    // (3) snapshot menu items
    const moreOpen = await dumpAllInteractables(page);
    fs.writeFileSync(path.join(outDir, '02-more-menu-items.json'), JSON.stringify(moreOpen, null, 2));
    console.log('[captions-debug] step 3 — menu items (', moreOpen.menuItems?.length, '):');
    (moreOpen.menuItems || []).forEach((m) => console.log('   •', JSON.stringify(m)));

    // (4) try to click captions item
    console.log('[captions-debug] attempting to click a captions menu item…');
    const captionsClick = await clickFirst(page, (label, role, text) => {
      const t = (label || text || '').toLowerCase();
      // Match any menu item / button whose text or aria mentions
      // captions, but NOT things like "captions settings".
      return t.includes('caption') && !t.includes('setting');
    });
    console.log('[captions-debug] captions click:', JSON.stringify(captionsClick));
    await sleep(1_500);

    // (5) snapshot AFTER the click — did a submenu / region appear?
    const afterClick = await dumpAllInteractables(page);
    fs.writeFileSync(path.join(outDir, '03-after-captions-click.json'), JSON.stringify(afterClick, null, 2));
    await takeScreenshot(page, outDir, 'after_captions_click').catch(() => {});

    // (6) check whether the captions region [jsname="tgaKEf"] is now in the DOM
    const regionPresent = await page.evaluate(() => {
      const sels = [
        '[jsname="tgaKEf"]',
        '[role="region"][aria-label*="aption" i]',
        '[role="region"][aria-label*="caption" i]',
      ];
      const found = [];
      for (const sel of sels) {
        try { if (document.querySelector(sel)) found.push(sel); } catch (_) {}
      }
      return found;
    });
    console.log('[captions-debug] captions region selectors that match now:', JSON.stringify(regionPresent));
    fs.writeFileSync(path.join(outDir, '04-region-present.json'), JSON.stringify(regionPresent, null, 2));

    // (7) settle 5 s and take final screenshot — captions region may
    // mount asynchronously after the click
    await sleep(5_000);
    await takeScreenshot(page, outDir, 'final').catch(() => {});

    console.log('\n[captions-debug] artifacts written to', outDir);
  } catch (err) {
    console.error('[captions-debug] fatal:', err.message);
    await takeScreenshot(page, outDir, 'error').catch(() => {});
  } finally {
    await closeBrowser(browser).catch(() => {});
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
