#!/usr/bin/env node
'use strict';

// Smallest possible repro of the Meet join flow against a real meeting
// URL. Designed for the local-docker test image: no DB, no AWS/Azure,
// no PerParticipantStreamPool — just launchBrowser + joinGoogleMeetMeeting,
// then dump whatever rejection diagnostic / admission state it lands on.
//
// Use this to validate selector tweaks (rejection vs admission vs
// name_input classification) in the same Chromium + Xvfb + PulseAudio
// environment prod runs in. Catches Docker-only false positives like
// the "Camera not found" / "Microphone not found" device-warning
// dialogs misclassifying as meeting rejections.
//
// Usage (inside the container):
//   node /app/scripts/local-docker/test-join.js <meetUrl>

require('dotenv').config({ path: '/app/.env' });

const path = require('path');
const fs = require('fs');

const { launchBrowser, closeBrowser, takeScreenshot } = require(
  '/app/src/bot/bot_scripts/googlemeet/browser',
);
const { joinGoogleMeetMeeting } = require(
  '/app/src/bot/bot_scripts/googlemeet/join',
);

async function main() {
  const meetingUrl = process.argv[2];
  if (!meetingUrl || !meetingUrl.startsWith('http')) {
    console.error('Usage: test-join.js <meetUrl>');
    process.exit(2);
  }
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join('/app/out', 'test-join', ts);
  fs.mkdirSync(outDir, { recursive: true });

  console.log('[local-docker] meeting:', meetingUrl);
  console.log('[local-docker] platform:', process.platform, 'arch:', process.arch);
  console.log('[local-docker] out dir :', outDir);

  const { browser, context, page } = await launchBrowser({ headless: false });
  page.on('console', (msg) => {
    const text = msg.text() || '';
    if (text.includes('GoogleMeet') || text.includes('gmeet') || msg.type() === 'error') {
      console.log('[page]', msg.type(), text);
    }
  });

  let result = { ok: false };
  try {
    await joinGoogleMeetMeeting(page, meetingUrl, 'Local Test Bot', {
      screenshotPath: outDir,
      takeScreenshots: true,
    });
    result = { ok: true, state: 'reached_lobby_or_admitted' };
    console.log('[local-docker] join flow returned without rejection');
    // Hold for 30 s so we can also see what the post-lobby state looks
    // like — admission flow takes time, and we want the screenshots.
    await page.waitForTimeout(30_000);
    await takeScreenshot(page, outDir, 'final').catch(() => {});
  } catch (err) {
    result = { ok: false, error: err.message };
    console.error('[local-docker] join flow threw:', err.message);
    // Dump diagnostics: every visible dialog, body text snippet, URL.
    try {
      const diag = await page.evaluate(() => {
        const dialogs = Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"]'))
          .filter((el) => el.offsetParent !== null)
          .map((el) => (el.textContent || '').trim());
        const buttons = Array.from(document.querySelectorAll('button[aria-label]'))
          .filter((el) => el.offsetParent !== null)
          .map((el) => el.getAttribute('aria-label'));
        const body = (document.body?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 500);
        return { url: location.href, dialogs, buttons: buttons.slice(0, 30), body };
      });
      console.log('[local-docker] DOM diagnostic:');
      console.log(JSON.stringify(diag, null, 2));
      fs.writeFileSync(path.join(outDir, 'diagnostic.json'), JSON.stringify(diag, null, 2));
    } catch (_) { /* page may have closed */ }
    await takeScreenshot(page, outDir, 'failure').catch(() => {});
  } finally {
    await closeBrowser(browser).catch(() => {});
  }

  fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2));
  console.log('[local-docker] result:', JSON.stringify(result));
  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  console.error('[local-docker] fatal:', err);
  process.exit(1);
});
