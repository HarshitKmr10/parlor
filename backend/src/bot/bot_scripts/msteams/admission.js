'use strict';

const sel = require('./selectors');
const { raceFirst, sleep } = require('./dom');

// Event-driven admission machine. Three terminal states:
//   admitted    -> in-meeting markers visible
//   removed     -> Teams put up a "you've been removed / connection lost" toast
//   timeout     -> we waited longer than waitingRoomMs without admission
//
// Returning the resolved state is more useful than throwing because the caller
// can decide between escalation, retry and exit.

const TERMINAL = Object.freeze({
  ADMITTED: 'admitted',
  REMOVED: 'removed',
  TIMEOUT: 'timeout',
});

async function detectInitialState(page, { gateMs = 4_000 } = {}) {
  const found = await raceFirst(
    page,
    {
      [TERMINAL.ADMITTED]: sel.inMeetingMarkers,
      [TERMINAL.REMOVED]: sel.removalMarkers,
      lobby: sel.lobbyMarkers,
      prejoin: sel.joinNow,
    },
    { timeoutMs: gateMs, intervalMs: 100 }
  );
  if (!found) return { state: 'unknown', selector: null };
  await found.handle.dispose().catch(() => {});
  return { state: found.key, selector: found.selector };
}

// Admission resolves on whichever of these arrives first:
//   1. DOM in-meeting marker visible (#hangup-button etc.)
//   2. A remote WebRTC audio track attached — the page's RTCPeerConnection
//      hook fires this. If a remote track shows up, the bot is provably in
//      the meeting regardless of DOM state. This makes the detector robust
//      against Teams renaming data-tid attributes (which the legacy DOM-only
//      check kept getting bitten by).
//   3. Removal marker (kicked / connection lost / "couldn't connect").
//   4. Timeout cap (waitingRoomMs).
//
// Caller wires (2) by passing trackSignal — a Promise that resolves once
// the bridge sees its first track. We don't reach into the bridge here;
// joinMeeting.js plumbs the promise.
async function waitForAdmission(page, {
  waitingRoomMs = 60_000,
  intervalMs = 200,
  onState,
  trackSignal,
} = {}) {
  const deadline = Date.now() + waitingRoomMs;
  let lastEmitted = null;

  const emit = (state, meta) => {
    if (state === lastEmitted) return;
    lastEmitted = state;
    if (typeof onState === 'function') {
      try { onState(state, meta || {}); } catch (_) { /* ignore */ }
    }
  };

  // Fast path: WebRTC track event resolves admission instantly.
  let trackResolved = false;
  if (trackSignal && typeof trackSignal.then === 'function') {
    trackSignal.then(() => { trackResolved = true; }).catch(() => {});
  }

  while (Date.now() < deadline) {
    if (trackResolved) {
      return { state: TERMINAL.ADMITTED, selector: 'webrtc:track', elapsed_ms: waitingRoomMs - (deadline - Date.now()) };
    }
    const found = await raceFirst(
      page,
      {
        [TERMINAL.ADMITTED]: sel.inMeetingMarkers,
        [TERMINAL.REMOVED]: sel.removalMarkers,
        lobby: sel.lobbyMarkers,
      },
      { timeoutMs: intervalMs, intervalMs: 80 }
    );

    if (found) {
      await found.handle.dispose().catch(() => {});
      if (found.key === TERMINAL.ADMITTED || found.key === TERMINAL.REMOVED) {
        return { state: found.key, selector: found.selector, elapsed_ms: waitingRoomMs - (deadline - Date.now()) };
      }
      if (found.key === 'lobby') emit('awaiting_admission', { selector: found.selector });
    }
    await sleep(intervalMs);
  }
  return { state: TERMINAL.TIMEOUT, selector: null, elapsed_ms: waitingRoomMs };
}

module.exports = { TERMINAL, detectInitialState, waitForAdmission };
