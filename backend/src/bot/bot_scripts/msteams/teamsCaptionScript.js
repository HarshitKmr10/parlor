'use strict';

// Teams caption capture.
//
// Teams publishes live closed-caption recognition results on the WebRTC
// "main-channel" data channel. This page-realm hook intercepts that channel,
// extracts recognitionResults, and forwards final/partial caption updates to
// Node. Node-side buffering decides when a caption becomes a transcript row.

const SCRIPT = `
(() => {
  if (window.__teamsCaptionChannelInstalled) return;
  window.__teamsCaptionChannelInstalled = true;

  const TAG = '[teams.caption-channel]';
  const wiredChannels = new WeakSet();
  const participantNames = Object.create(null);

  function log() { try { console.log.apply(console, [TAG].concat(Array.from(arguments))); } catch (_) {} }
  function warn() { try { console.warn.apply(console, [TAG].concat(Array.from(arguments))); } catch (_) {} }

  class UtteranceIdGenerator {
    constructor(generate = () => {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
      return 'caption-' + Date.now() + '-' + Math.random().toString(16).slice(2);
    }) {
      this._activeIds = new Map();
      this._generate = generate;
    }

    next(speakerKey = 'default', isFinal = false) {
      const key = String(speakerKey || 'default');
      let id = this._activeIds.get(key);
      if (!id) {
        id = this._generate();
        if (!isFinal) this._activeIds.set(key, id);
      } else if (isFinal) {
        this._activeIds.delete(key);
      }
      return id;
    }
  }

  const utteranceIdGenerator = new UtteranceIdGenerator();

  function getActiveCall() {
    try {
      const dbg = window.callingDebug && window.callingDebug.observableCall;
      if (dbg) return dbg;
    } catch (_) {}
    try {
      const ref = window.msteamscalling && window.msteamscalling.deref && window.msteamscalling.deref();
      const svc = ref && ref.callingService;
      if (svc && typeof svc.getActiveCall === 'function') return svc.getActiveCall();
    } catch (_) {}
    return null;
  }

  function refreshParticipantNames() {
    const call = getActiveCall();
    if (!call || !call.participants) return;
    try {
      call.participants.forEach(function (p) {
        if (!p || !p.id) return;
        const name = p.displayName || p.fullName || p.name;
        if (name) participantNames[String(p.id)] = String(name);
      });
    } catch (_) {}
  }

  function resolveSpeakerName(item) {
    refreshParticipantNames();
    const id = item && (item.userId || item.participantId || item.speakerId || item.deviceId);
    if (id != null && participantNames[String(id)]) return participantNames[String(id)];
    return item && (
      item.displayName ||
      item.userDisplayName ||
      item.speakerName ||
      item.participantDisplayName ||
      item.participantName ||
      item.name ||
      id
    );
  }

  function convertTimestampAudioSentToUnixTimeMs(timestampAudioSent) {
    const raw = Number(timestampAudioSent);
    if (!Number.isFinite(raw)) return null;
    const fractionalSecondsSince1900 = raw / 10000000;
    const fractionalSecondsSince1970 = fractionalSecondsSince1900 - 2208988800;
    const unixMs = Math.floor(fractionalSecondsSince1970 * 1000);
    return Number.isFinite(unixMs) && unixMs > 0 ? unixMs : null;
  }

  function parseJsonFromString(text) {
    if (typeof text !== 'string') return null;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch !== '[' && ch !== '{') continue;
      try { return JSON.parse(text.slice(i)); }
      catch (_) {}
    }
    return null;
  }

  function parseJsonFromBytes(bytes) {
    if (!bytes || typeof bytes.length !== 'number') return null;
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] !== 91 && bytes[i] !== 123) continue;
      try {
        const candidate = new TextDecoder().decode(bytes.slice(i));
        return JSON.parse(candidate);
      } catch (_) {}
    }
    return null;
  }

  async function decodeMainChannelData(data) {
    if (typeof data === 'string') return parseJsonFromString(data);
    if (data instanceof ArrayBuffer) return parseJsonFromBytes(new Uint8Array(data));
    if (ArrayBuffer.isView(data)) return parseJsonFromBytes(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
    if (data && typeof Blob !== 'undefined' && data instanceof Blob) {
      try { return parseJsonFromBytes(new Uint8Array(await data.arrayBuffer())); }
      catch (_) { return null; }
    }
    return null;
  }

  function forwardCaption(item) {
    if (!item || !item.text) return;
    const deviceId = item.userId || item.participantId || item.speakerId || item.deviceId || 'unknown';
    const isFinal = !!item.isFinal;
    const receivedAtMs = Date.now();
    const audioTimestampMs = convertTimestampAudioSentToUnixTimeMs(item.timestampAudioSent);
    const payload = {
      deviceId: String(deviceId),
      captionId: utteranceIdGenerator.next(deviceId, isFinal),
      text: String(item.text || '').trim(),
      audioTimestamp: item.timestampAudioSent || null,
      audioTimestampMs,
      receivedAtMs,
      isFinal,
      speakerName: resolveSpeakerName(item) || 'Unknown',
    };

    if (!payload.text) return;
    if (typeof window.__teamsBridgeOnCaptionUpdate === 'function') {
      try { window.__teamsBridgeOnCaptionUpdate(payload); }
      catch (e) { warn('caption bridge call failed', e && e.message); }
    }
  }

  async function handleMainChannelEvent(event) {
    try {
      const parsed = await decodeMainChannelData(event && event.data);
      if (!parsed || !parsed.recognitionResults) return;
      for (const item of parsed.recognitionResults) forwardCaption(item);
    } catch (e) {
      warn('main-channel decode failed', e && e.message);
    }
  }

  function wireDataChannel(channel) {
    if (!channel || wiredChannels.has(channel)) return;
    wiredChannels.add(channel);
    if (channel.label !== 'main-channel') return;
    channel.addEventListener('message', handleMainChannelEvent);
    log('main-channel wired');
  }

  window.__teamsCaptionsEnableClosedCaptions = function (language) {
    const call = getActiveCall();
    if (!call || typeof call.startClosedCaption !== 'function') return false;
    try { call.startClosedCaption(); } catch (_) {}
    if (language && typeof call.setClosedCaptionsLanguage === 'function') {
      const setLanguage = function () {
        try { call.setClosedCaptionsLanguage(language); } catch (_) {}
      };
      setLanguage();
      setTimeout(setLanguage, 1000);
      setTimeout(setLanguage, 3000);
      setTimeout(setLanguage, 5000);
    }
    return true;
  };

  window.__teamsCaptionChannelSnapshot = function () {
    refreshParticipantNames();
    return { participantNames: Object.assign({}, participantNames) };
  };

  const NativePC = window.RTCPeerConnection;
  if (!NativePC) {
    warn('no RTCPeerConnection; caption channel hook not installed');
    return;
  }

  function PatchedPC() {
    const pc = new NativePC(...arguments);
    pc.addEventListener('datachannel', function (event) {
      try { wireDataChannel(event && event.channel); } catch (_) {}
    });

    if (typeof pc.createDataChannel === 'function') {
      const nativeCreateDataChannel = pc.createDataChannel.bind(pc);
      pc.createDataChannel = function (label, options) {
        const channel = nativeCreateDataChannel(label, options);
        try { wireDataChannel(channel); } catch (_) {}
        return channel;
      };
    }
    return pc;
  }
  PatchedPC.prototype = NativePC.prototype;
  Object.setPrototypeOf(PatchedPC, NativePC);
  window.RTCPeerConnection = PatchedPC;

  log('installed');
})();
`;

module.exports = { SCRIPT };
