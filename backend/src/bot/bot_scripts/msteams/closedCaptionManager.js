'use strict';

class CaptionEntry {
  constructor(captionData, nowMs = Date.now()) {
    this.captionData = { ...captionData };
    this.createdAtMs = finiteNumber(captionData.receivedAtMs, nowMs);
    this.modifiedAtMs = this.createdAtMs;
    this.lastUpsertToDbAtMs = null;
    this.onlySaveFinalCaptions = true;
  }

  update(captionData, nowMs = Date.now()) {
    this.captionData = { ...this.captionData, ...captionData };
    this.modifiedAtMs = finiteNumber(captionData.receivedAtMs, nowMs);
  }

  shouldUpsertToDb({ shouldFlush = false, nowMs = Date.now() } = {}) {
    if (this.onlySaveFinalCaptions) {
      if (!this.captionData.isFinal && !shouldFlush) return false;
      if (!this.lastUpsertToDbAtMs) return true;
      return this.modifiedAtMs > this.lastUpsertToDbAtMs;
    }

    if (!this.lastUpsertToDbAtMs) {
      return (nowMs - this.createdAtMs > 1000) || shouldFlush;
    }

    return this.modifiedAtMs > this.lastUpsertToDbAtMs
      && ((nowMs - this.modifiedAtMs > 2000) || shouldFlush);
  }

  markUpsertedToDb(nowMs = Date.now()) {
    this.lastUpsertToDbAtMs = nowMs;
  }
}

class ClosedCaptionManager {
  constructor({ saveCaptionCallback, logger = console } = {}) {
    this.captions = new Map();
    this.saveCaptionCallback = typeof saveCaptionCallback === 'function'
      ? saveCaptionCallback
      : async () => {};
    this.logger = logger;
  }

  upsertCaption(captionData, nowMs = Date.now()) {
    const key = captionKey(captionData);
    if (!key) {
      this.logger.warn?.('[teams.captions.manager] dropping caption without stable key');
      return null;
    }

    if (this.captions.has(key)) {
      this.captions.get(key).update(captionData, nowMs);
    } else {
      this.captions.set(key, new CaptionEntry(captionData, nowMs));
    }
    return key;
  }

  async flushCaptions() {
    await this.processCaptions({ shouldFlush: true });
  }

  async processCaptions({ shouldFlush = false, nowMs = Date.now() } = {}) {
    for (const [key, entry] of Array.from(this.captions.entries())) {
      if (!entry.shouldUpsertToDb({ shouldFlush, nowMs })) continue;

      await this.saveCaptionCallback(this._messageFromEntry(entry));
      entry.markUpsertedToDb(nowMs);

      if (nowMs - entry.modifiedAtMs > 60_000) {
        this.captions.delete(key);
      }
    }
  }

  _messageFromEntry(entry) {
    const data = entry.captionData;
    const timestampMs = finiteNumber(data.audioTimestampMs, finiteNumber(data.timestampMs, entry.createdAtMs));
    const durationMs = Math.max(0, entry.modifiedAtMs - entry.createdAtMs);
    const deviceId = String(data.deviceId);
    const captionId = String(data.captionId);

    return {
      device_id: deviceId,
      caption_id: captionId,
      speaker_name: data.speakerName || data.participantName || data.displayName || deviceId,
      timestamp_ms: timestampMs,
      duration_ms: durationMs,
      text: String(data.text || '').trim(),
      source_uuid_suffix: `${deviceId}-${captionId}`,
      sample_rate: null,
      is_final: !!data.isFinal || !!data.is_final,
      audio_timestamp: data.audioTimestamp ?? null,
    };
  }
}

function captionKey(captionData) {
  if (!captionData || captionData.deviceId == null || captionData.captionId == null) return null;
  return `${captionData.deviceId}:${captionData.captionId}`;
}

function finiteNumber(value, fallback = null) {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

module.exports = { CaptionEntry, ClosedCaptionManager, captionKey };
