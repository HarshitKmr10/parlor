'use strict';

const sel = require('./selectors');
const { raceAny, clickAny, fillAny, sleep } = require('./dom');
const peerStreams = require('./peerStreamsScript');
const recorderScript = require('./recorderScript');
const tileObserver = require('./tileObserverScript');

// Pre-join orchestration. Each step takes a budget (ms). When the step's
// affordance does not appear within budget we move on rather than hang. The
// total worst-case here is bounded by the sum of step budgets, ~12 s.
//
// Note: we install the peer-stream + recorder hooks via addInitScript BEFORE
// any navigation. They live in the page realm and only ever do work after
// Teams creates RTCPeerConnections. That ordering is what makes per-speaker
// capture reliable.

async function installPageHooks(context, {
  recordingWindowMs,
  mixedStream = false,
  mixedFrameMs = 200,
  attributionMode = 'dom',
  captureAudio = true,
}) {
  // webrtc_csrc mode runs its own RTCPeerConnection wrapper + audio
  // interception (csrcAttributionScript, injected by CaptureBridge.expose()
  // via context.addInitScript). peerStreamsScript would race for the same
  // RTCPeerConnection patch chain and recorderScript would tap a parallel
  // audio path on the same tracks, both unnecessary and a source of subtle
  // double-consumption bugs. Skip them in this mode.
  if (captureAudio && attributionMode !== 'webrtc_csrc') {
    await context.addInitScript(peerStreams.SCRIPT);
    await context.addInitScript(recorderScript.buildScript({
      windowMs: recordingWindowMs,
      mixedStream,
      mixedFrameMs,
    }));
  }
  await context.addInitScript(tileObserver.SCRIPT);
  await context.addInitScript(TOGGLE_HELPER_SCRIPT);
}

// Helper installed in the page realm. Two strategies:
//   (A) Direct: button[aria-label] matches one of `directLabelMatchers` →
//       click it. Used by the corporate Teams flow where the camera /
//       mic toggle IS a labelled button.
//   (B) Indirect: find an "anchor" element (the menu button, e.g.
//       "Open video options") and walk to its nearest enclosing form
//       container. Inside that container look for any [role="switch"]
//       OR input[type="checkbox"] that is currently checked (aria-checked
//       or .checked) and click it. Used by the light-meetings flow where
//       the actual toggle has no descriptive aria-label.
const TOGGLE_HELPER_SCRIPT = `
window.clickToggleNear = function(anchorMatchers, directLabelMatchers) {
  function visible(el) { return el && el.offsetParent !== null; }

  // Strategy A: direct labelled button click.
  const buttons = Array.from(document.querySelectorAll('button[aria-label]'));
  for (const b of buttons) {
    const lab = b.getAttribute('aria-label') || '';
    if (visible(b) && directLabelMatchers.some((m) => m.test(lab))) {
      b.click();
      return { clicked: 'button:' + lab };
    }
  }

  // Strategy B: anchor + nearest checked toggle.
  let anchor = null;
  for (const b of buttons) {
    const lab = b.getAttribute('aria-label') || '';
    if (visible(b) && anchorMatchers.some((m) => m.test(lab))) {
      anchor = b;
      break;
    }
  }
  if (!anchor) return { clicked: null };

  // Walk up to a sensible scope: the prejoin tile/card. Cap the climb at
  // 6 levels to avoid scoping the whole document.
  let scope = anchor;
  for (let i = 0; i < 6 && scope.parentElement; i++) {
    scope = scope.parentElement;
    const candidates = [
      ...scope.querySelectorAll('[role="switch"]'),
      ...scope.querySelectorAll('input[type="checkbox"]'),
    ];
    for (const el of candidates) {
      if (!visible(el)) continue;
      const checked =
        el.getAttribute('aria-checked') === 'true' ||
        (el.tagName === 'INPUT' && el.checked);
      if (checked) {
        el.click();
        return { clicked: 'toggle:' + (el.getAttribute('aria-label') || el.tagName.toLowerCase()) };
      }
    }
  }
  return { clicked: null };
};
`;

async function warmUpMedia(page, { timer }) {
  return timer.measure('media.warmup', async () => {
    // Provoke device enumeration before Teams checks. If permissions or PA
    // routing are broken we want to know now, not 8 s into the join.
    await page.evaluate(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        stream.getTracks().forEach((t) => t.stop());
      } catch (_e) {
        // Permission may be denied in headless tests; not fatal here.
      }
    });
  });
}

async function navigateToMeeting(page, meetingUrl, { timer }) {
  return timer.measure('page.navigate', async () => {
    // Long navigation timeout: Teams' join URL chain can redirect through
    // launcher pages and the initial React bundle is heavy. 60 s matches
    // what's needed in the wild for cold sessions on free-meeting URLs.
    await page.goto(meetingUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    // The /meet/<id>?p=<pwd> URL often lands on a launcher screen that
    // tries to push the user into the desktop app. Click "Continue on this
    // browser" once; reachPrejoinReady() will re-click it up to 2 more
    // times if it persists past the React bootstrap.
    await clickAny(page, sel.continueOnBrowser, { timeoutMs: 3_000 });
  });
}

// The Teams web SPA paints a logo splash, then mounts React, then renders
// the prejoin form. On a cold session the React mount alone can take 10+
// seconds and a free-meeting URL can ping-pong through "Continue on this
// browser" twice. We poll a multi-signal "ready" predicate every 300 ms
// and re-click the Continue button up to 2 more times if it lingers.
// Override the cap via MSTEAMS_PREJOIN_MS.
async function reachPrejoinReady(page, { timer, logger }) {
  const log = logger || console;
  const timeoutMs = parseInt(process.env.MSTEAMS_PREJOIN_MS || '45000', 10);
  return timer.measure('prejoin.ready', async () => {
    const start = Date.now();
    let continueClickAttempts = 0;
    while (Date.now() - start < timeoutMs) {
      const found = await raceAny(page, sel.prejoinAnyControl, {
        timeoutMs: 300,
        intervalMs: 100,
      });
      if (found) {
        await found.handle.dispose().catch(() => {});
        return;
      }
      // If "Continue on this browser" is still showing, click it again
      // (max 2 retries).
      if (continueClickAttempts < 2) {
        const stillContinue = await raceAny(page, sel.continueOnBrowser, {
          timeoutMs: 200,
          intervalMs: 100,
        });
        if (stillContinue) {
          await stillContinue.handle.click({ delay: 30 }).catch(() => {});
          await stillContinue.handle.dispose().catch(() => {});
          continueClickAttempts += 1;
          log.info?.(`[teams.prejoin] re-clicked Continue (attempt ${continueClickAttempts})`);
        }
      }
      await sleep(300);
    }
    throw new Error('prejoin_controls_not_found');
  });
}

async function setDisplayName(page, name, { timer }) {
  return timer.measure('name.set', async () => {
    await fillAny(page, sel.nameInput, name, { timeoutMs: 1_500 });
  });
}

async function selectComputerAudio(page, { timer }) {
  return timer.measure('audio.select', async () => {
    await clickAny(page, sel.computerAudioRadio, { timeoutMs: 1_500 });
  });
}

// Free-anonymous Teams ("light-meetings") prejoin uses unlabelled
// [role="switch"] toggles next to the camera + mic *menu* buttons. The
// menu buttons DO have aria-labels ("Open video options", "Selected
// microphone: ..., open microphone options"). Strategy:
//   1. Find the menu button by aria-label match.
//   2. Walk DOM siblings/ancestors to find the nearest [role="switch"]
//      or input[type="checkbox"] that is currently checked.
//   3. Click it to flip OFF.
// Falls back to button[aria-label*="Turn off camera"] for the corporate
// /l/meetup-join/ flow which uses real buttons.
async function turnOffCamera(page, { timer, logger }) {
  return timer.measure('camera.off', async () => {
    const result = await page.evaluate(() => clickToggleNear(
      [/Open video options/i, /open camera options/i, /Camera options/i],
      [/Turn (off|stop) (camera|video)/i, /Camera is on/i],
    )).catch(() => ({ clicked: null }));
    (logger || console).info?.('[teams.prejoin] camera_off=' + (result.clicked || 'none'));
  });
}

async function muteMicPrejoin(page, { timer, logger }) {
  return timer.measure('mic.mute.prejoin', async () => {
    const result = await page.evaluate(() => clickToggleNear(
      [/Selected microphone/i, /open microphone options/i, /Microphone options/i],
      [/^Mute$/i, /Turn (off|mute) (mic|microphone)/i, /Microphone is on/i],
    )).catch(() => ({ clicked: null }));
    (logger || console).info?.('[teams.prejoin] mic_off=' + (result.clicked || 'none'));
  });
}

// Mute the mic AFTER admission using the Ctrl+Shift+M shortcut — it only
// fires reliably once the meeting page has focus, which is true
// post-admission. Calling this from joinMeeting.js rather than during
// prejoin (Teams ignores the shortcut on prejoin).
async function muteMicPostAdmission(page, { timer }) {
  return timer.measure('mic.mute', async () => {
    await page.keyboard.press('Control+Shift+M').catch(() => {});
  });
}

async function clickJoin(page, { timer }) {
  return timer.measure('click.join', async () => {
    const ok = await clickAny(page, sel.joinNow, { timeoutMs: 2_500 });
    if (!ok) throw new Error('join_button_not_found');
  });
}

async function joinMeetingFlow({ context, page, meetingUrl, name, timer, recordingWindowMs, logger, mixedStream = false, mixedFrameMs = 200, attributionMode = 'dom', captureAudio = true }) {
  await installPageHooks(context, { recordingWindowMs, mixedStream, mixedFrameMs, attributionMode, captureAudio });
  await warmUpMedia(page, { timer });
  await navigateToMeeting(page, meetingUrl, { timer });
  await reachPrejoinReady(page, { timer, logger });
  await setDisplayName(page, name, { timer });
  await selectComputerAudio(page, { timer });
  await turnOffCamera(page, { timer, logger });
  await muteMicPrejoin(page, { timer, logger });
  await clickJoin(page, { timer });
  // post-admission keyboard fallback in joinMeeting.js handles the case
  // where the prejoin mic toggle missed.
}

module.exports = { joinMeetingFlow, muteMicPostAdmission };
