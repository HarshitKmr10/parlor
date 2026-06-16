'use strict';

// WebRTC-layer "is the meeting still live?" watcher.
//
// peerStreamsScript.js patches RTCPeerConnection in the page realm and
// exposes window.__teamsBridgeSnapshot() returning { active: [...] } —
// the live list of remote audio tracks the bot is currently receiving.
// When the host ends the meeting (or the bot loses the call), Teams
// closes the peer connection; track.ended fires; the active array
// drops to 0. That is a WebRTC-layer ground-truth signal independent
// of:
//   - People panel DOM rendering (rosterWatcher fails when panel is
//     closed or lightExperience renders differently).
//   - Post-call text phrasing (removal.js text scan is brittle and
//     can't safely include phrases that participants might say
//     mid-call).
//   - Aloneness audio attribution (depends on rosterWatcher names).
//
// Activation rules:
//   1. We must observe `active.length >= 1` at least once before this
//      watcher is allowed to fire — protects against the join window
//      where no track has attached yet.
//   2. Once seen, require `emptyGraceMs` of continuous 0-active samples
//      before resolving. Teams can briefly drop tracks during simulcast
//      layer changes; a 30 s window avoids false positives without
//      meaningfully delaying real meeting-end detection.
//   3. If no track has been observed within `seenFirstWindowMs` from
//      start, the watcher gives up silently and lets aloneness handle
//      it. Protects against environments where the peer-stream hook
//      didn't install (e.g. Teams variant we don't know about).
//
// The polling is a single `page.evaluate(() => window.__teamsBridgeSnapshot?.())`
// per tick, so it's cheap — comparable to the aloneness 1 Hz roster
// snapshot.

const DEFAULTS = Object.freeze({
  pollIntervalMs: parseInt(process.env.MSTEAMS_TRACK_PRESENCE_POLL_MS || '2000', 10),
  emptyGraceMs: parseInt(process.env.MSTEAMS_TRACK_PRESENCE_EMPTY_GRACE_MS || '30000', 10),
  seenFirstWindowMs: parseInt(process.env.MSTEAMS_TRACK_PRESENCE_SEEN_FIRST_MS || '120000', 10),
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function snapshotActive(page) {
  return page.evaluate(() => {
    try {
      const fn = window.__teamsBridgeSnapshot;
      if (typeof fn !== 'function') return null;
      const snap = fn();
      if (!snap || !Array.isArray(snap.active)) return null;
      return { count: snap.active.length, tracksSeen: Number(snap.tracksSeen) || 0 };
    } catch (_) {
      return null;
    }
  }).catch(() => null);
}

async function watchTrackPresence(page, {
  signal,
  onEmpty,
  logger,
  pollIntervalMs = DEFAULTS.pollIntervalMs,
  emptyGraceMs = DEFAULTS.emptyGraceMs,
  seenFirstWindowMs = DEFAULTS.seenFirstWindowMs,
  logTag = '[teams.trackPresence]',
} = {}) {
  const log = logger || console;
  const startedAt = Date.now();
  let seenAnyTrack = false;
  let emptySince = null;
  let bridgeMissingLogged = false;

  while (!signal?.aborted) {
    const snap = await snapshotActive(page);

    if (snap == null) {
      // Bridge unavailable. Could be: page closed, page navigated, or
      // peerStreamsScript didn't install on this Teams variant. Log
      // once and keep polling — the bridge may appear later.
      if (!bridgeMissingLogged && Date.now() - startedAt > 10_000) {
        log.warn?.(`${logTag} __teamsBridgeSnapshot unavailable`);
        bridgeMissingLogged = true;
      }
      if (!seenAnyTrack && Date.now() - startedAt >= seenFirstWindowMs) {
        // No capture bridge / no track ever seen within the window → just
        // DISABLE this watcher and keep the bot running. The Teams
        // __teamsBridgeSnapshot track signal is unreliable — it can read 0
        // even while audio is flowing and transcripts are being captured
        // (confirmed live: an 8-person meeting transcribed fine with
        // tracksSeen=0). So we must NOT treat tracksSeen=0 as "deaf" and
        // leave/rejoin — that abandons working meetings.
        log.info?.(`${logTag} no remote tracks ever observed within seenFirstWindowMs, disabling watcher (keeping bot in meeting)`);
        return;
      }
      await sleep(pollIntervalMs);
      continue;
    }

    if (snap.count >= 1) {
      if (!seenAnyTrack) {
        seenAnyTrack = true;
        log.info?.(`${logTag} first remote audio track observed`, {
          active: snap.count,
          tracks_seen_total: snap.tracksSeen,
        });
      }
      if (emptySince != null) {
        log.info?.(`${logTag} track presence restored`, { active: snap.count });
        emptySince = null;
      }
    } else {
      // count === 0
      if (!seenAnyTrack) {
        if (Date.now() - startedAt >= seenFirstWindowMs) {
          // No track ever seen within the window → DISABLE the watcher and
          // keep the bot in the meeting. tracksSeen is unreliable on Teams
          // (reads 0 even while transcripts flow), so it must NOT trigger a
          // leave/rejoin. (See the bridge-unavailable branch above.)
          log.info?.(`${logTag} no remote tracks ever observed within seenFirstWindowMs, disabling watcher (keeping bot in meeting)`);
          return;
        }
      } else {
        if (emptySince == null) {
          emptySince = Date.now();
          log.info?.(`${logTag} all remote tracks gone, starting grace`, {
            grace_ms: emptyGraceMs,
            tracks_seen_total: snap.tracksSeen,
          });
        } else {
          const elapsed = Date.now() - emptySince;
          if (elapsed >= emptyGraceMs) {
            log.info?.(`${logTag} grace elapsed, signalling meeting end`, {
              elapsed_ms: elapsed,
              tracks_seen_total: snap.tracksSeen,
            });
            try {
              onEmpty?.({
                elapsedMs: elapsed,
                tracksSeen: snap.tracksSeen,
                reason: 'remote_tracks_gone',
              });
            } catch (e) {
              log.warn?.(`${logTag} onEmpty threw`, e?.message);
            }
            return;
          }
          const wholeSec = Math.floor(elapsed / 1000);
          if (wholeSec > 0 && wholeSec % 5 === 0) {
            log.info?.(`${logTag} empty`, {
              elapsed_sec: wholeSec,
              grace_ms: emptyGraceMs,
            });
          }
        }
      }
    }

    await sleep(pollIntervalMs);
  }
}

module.exports = { watchTrackPresence, DEFAULTS };
