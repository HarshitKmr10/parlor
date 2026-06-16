'use strict';

// This file is *string-injected* into the Teams page via addInitScript before
// Teams' own JS evaluates. It hooks the RTCPeerConnection prototype so that
// every remote audio track is also routed to a hidden <audio> element keyed
// by SDP mid + ssrc + msid metadata. The Node side reads those elements and
// records each speaker independently, which is what gives us clean per-speaker
// transcripts instead of a single mixed-blob attribution problem.
//
// Returned as a string so it can be passed verbatim to page.addInitScript.
// We deliberately keep this self-contained: no requires, no closures from the
// Node side, only the page realm.

const SCRIPT = `
(() => {
  if (window.__teamsTrackBridgeInstalled) return;
  window.__teamsTrackBridgeInstalled = true;

  const TAG = '[teams.bridge]';
  const tracks = new Map(); // trackId -> { el, peerId, kind, label }
  const meta = { peerCounter: 0, tracksSeen: 0 };
  // trackId -> RTCRtpReceiver, for CSRC polling at chunk boundaries.
  // Teams Web ships ONE mixed inbound audio track but the receiver's
  // exposes per-participant RTP source IDs via getContributingSources()
  // which we map to the actual speaker. The recorder consumes this map
  // below by calling __teamsBridgeGetCsrcs(trackId).
  window.__teamsAudioReceivers = window.__teamsAudioReceivers || new Map();
  window.__teamsBridgeGetCsrcs = function (trackId) {
    try {
      const rx = window.__teamsAudioReceivers.get(trackId);
      if (!rx || typeof rx.getContributingSources !== 'function') return [];
      return rx.getContributingSources().map(function (c) {
        return { source: c.source, audioLevel: c.audioLevel, timestamp: c.timestamp };
      });
    } catch (e) { return []; }
  };

  function attachTrack(track, streams, peerId) {
    if (track.kind !== 'audio') return;
    if (tracks.has(track.id)) return;
    let el = document.querySelector('audio[data-bridge-track="' + track.id + '"]');
    if (!el) {
      el = document.createElement('audio');
      el.setAttribute('data-bridge-track', track.id);
      el.setAttribute('data-bridge-peer', String(peerId));
      el.autoplay = true;
      el.muted = false;
      el.playsInline = true;
      el.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;';
      document.body.appendChild(el);
    }
    const stream = (streams && streams[0]) || new MediaStream([track]);
    el.srcObject = stream;
    el.play().catch(() => {});
    tracks.set(track.id, {
      id: track.id,
      peerId,
      kind: track.kind,
      label: track.label || ('peer-' + peerId),
      ssrc: null,
      addedAt: Date.now(),
    });
    meta.tracksSeen += 1;
    track.addEventListener('ended', () => {
      tracks.delete(track.id);
      el.srcObject = null;
      el.remove();
    });
    if (typeof window.__teamsBridgeOnTrack === 'function') {
      try {
        window.__teamsBridgeOnTrack({
          trackId: track.id,
          peerId,
          kind: track.kind,
          label: track.label,
        });
      } catch (_) { /* ignore */ }
    }
    try {
      console.log(
        TAG,
        'attached audio track',
        track.id,
        'peer', peerId,
        'label', track.label || '(empty)',
        'enabled', track.enabled,
        'muted', track.muted
      );
    } catch (_) {}
  }

  const NativePC = window.RTCPeerConnection;
  if (!NativePC) return;

  function PatchedPC(...args) {
    const pc = new NativePC(...args);
    const peerId = ++meta.peerCounter;
    pc.addEventListener('track', (event) => {
      try {
        attachTrack(event.track, event.streams, peerId);
        // Save the receiver so the recorder can call
        // getContributingSources() at chunk emission time. CSRC
        // exposes per-participant RTP source IDs even though Teams
        // ships a single mixed inbound audio track.
        if (event.track && event.track.kind === 'audio' && event.receiver) {
          window.__teamsAudioReceivers.set(event.track.id, event.receiver);
        }
      } catch (e) {
        try { console.warn(TAG, 'attachTrack failed', e); } catch (_) {}
      }
    });
    return pc;
  }
  PatchedPC.prototype = NativePC.prototype;
  Object.setPrototypeOf(PatchedPC, NativePC);
  window.RTCPeerConnection = PatchedPC;

  // Expose snapshot read for the Node side. Returning serialisable data only.
  window.__teamsBridgeSnapshot = () => ({
    tracksSeen: meta.tracksSeen,
    active: Array.from(tracks.values()),
  });
})();
`;

module.exports = { SCRIPT };
