'use strict';

// Page-realm probe for Google Meet WebRTC architecture.
//
// Goal: empirically answer "does Meet ship per-peer audio tracks, one
// mixed track with CSRC, or one mixed track with no CSRC routing
// signal?" before we commit to an attribution architecture.
//
// What it does in-page:
//   1. Hook RTCPeerConnection so every audio RTCRtpReceiver becomes
//      visible at window.__probe.receivers.
//   2. Expose window.__probe.snapshot() returning, for every receiver:
//        - track.id / track.label / track.muted
//        - getContributingSources() (CSRC list — Teams uses this to
//          identify which participant contributed RTP frames in a
//          mixed audio stream)
//        - getSynchronizationSources() (SSRC list — one per receiver in
//          unicast/per-peer architectures)
//   3. Expose window.__probe.domSpeakers() returning all tiles with
//      Google's speaking-animation class names alongside any visible
//      participant name. This is the fallback signal Vexa uses.
//
// Returned as a string so it can be passed verbatim to
// context.addInitScript() before navigation.

const SPEAKING_CLASSES = [
  'Oaajhc', 'HX2H7', 'wEsLMd', 'OgVli',
];

const SCRIPT = `
(() => {
  if (window.__probeInstalled) return;
  window.__probeInstalled = true;

  const TAG = '[gmeet.probe]';
  const SPEAKING_CLASSES = ${JSON.stringify(SPEAKING_CLASSES)};

  function log() {
    try { console.log.apply(console, [TAG].concat(Array.from(arguments))); } catch (_) {}
  }

  // ─── PeerConnection hook ─────────────────────────────────────────────
  const peerConnections = [];
  const OriginalRTCPeerConnection = window.RTCPeerConnection;

  function HookedRTCPeerConnection() {
    const pc = new OriginalRTCPeerConnection(...arguments);
    peerConnections.push(pc);
    pc.addEventListener('track', (event) => {
      try {
        log('track event', event.track && event.track.kind, event.track && event.track.id);
      } catch (_) {}
    });
    return pc;
  }
  HookedRTCPeerConnection.prototype = OriginalRTCPeerConnection.prototype;
  for (const k of Object.keys(OriginalRTCPeerConnection)) {
    HookedRTCPeerConnection[k] = OriginalRTCPeerConnection[k];
  }
  window.RTCPeerConnection = HookedRTCPeerConnection;

  // ─── Snapshot API exposed to Node ────────────────────────────────────
  function audioReceivers() {
    const out = [];
    for (let i = 0; i < peerConnections.length; i++) {
      const pc = peerConnections[i];
      let receivers = [];
      try { receivers = pc.getReceivers ? pc.getReceivers() : []; } catch (_) {}
      for (let j = 0; j < receivers.length; j++) {
        const r = receivers[j];
        const t = r.track;
        if (!t || t.kind !== 'audio') continue;
        out.push({ pcIdx: i, receiver: r, track: t });
      }
    }
    return out;
  }

  window.__probe = {
    pcCount: () => peerConnections.length,
    snapshot: () => {
      const audio = audioReceivers();
      const receivers = audio.map((entry) => {
        const r = entry.receiver;
        const t = entry.track;
        let csrcs = [];
        let ssrcs = [];
        try { csrcs = r.getContributingSources ? r.getContributingSources() : []; } catch (_) {}
        try { ssrcs = r.getSynchronizationSources ? r.getSynchronizationSources() : []; } catch (_) {}
        return {
          pcIdx: entry.pcIdx,
          trackId: t.id,
          trackLabel: t.label,
          trackMuted: t.muted,
          trackEnabled: t.enabled,
          trackReadyState: t.readyState,
          csrcs: csrcs.map((c) => ({
            source: c.source,
            timestamp: c.timestamp,
            audioLevel: c.audioLevel,
            rtpTimestamp: c.rtpTimestamp,
          })),
          ssrcs: ssrcs.map((s) => ({
            source: s.source,
            timestamp: s.timestamp,
            audioLevel: s.audioLevel,
            rtpTimestamp: s.rtpTimestamp,
          })),
        };
      });
      return {
        ts: Date.now(),
        pcCount: peerConnections.length,
        audioReceiverCount: audio.length,
        receivers,
      };
    },
    domSpeakers: () => {
      const speaking = [];
      const sel = SPEAKING_CLASSES.map((c) => '.' + c).join(',');
      let nodes = [];
      try { nodes = Array.from(document.querySelectorAll(sel)); } catch (_) {}
      for (const n of nodes) {
        let nameNode = n.closest('[data-participant-id]') || n.closest('[data-self-name]');
        let name = null;
        let participantId = null;
        if (nameNode) {
          participantId = nameNode.getAttribute('data-participant-id') ||
                          nameNode.getAttribute('data-self-name') || null;
          const nameEl = nameNode.querySelector('span.notranslate, [data-self-name], .zWGUib');
          if (nameEl) name = (nameEl.textContent || '').trim() || null;
        }
        speaking.push({ participantId, name, classes: Array.from(n.classList) });
      }
      // De-dupe by participantId (multiple speaking-class nodes per tile).
      const seen = new Set();
      const unique = [];
      for (const s of speaking) {
        const key = s.participantId || s.name || JSON.stringify(s.classes);
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(s);
      }
      return unique;
    },
    participantTiles: () => {
      const tiles = [];
      let nodes = [];
      try { nodes = Array.from(document.querySelectorAll('[data-participant-id]')); } catch (_) {}
      for (const n of nodes) {
        const id = n.getAttribute('data-participant-id');
        const nameEl = n.querySelector('span.notranslate, [data-self-name], .zWGUib');
        const name = nameEl ? (nameEl.textContent || '').trim() : null;
        tiles.push({ participantId: id, name });
      }
      return tiles;
    },
  };

  log('probe installed');
})();
`;

module.exports = { SCRIPT };
