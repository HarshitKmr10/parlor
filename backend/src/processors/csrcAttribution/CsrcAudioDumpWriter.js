'use strict';

const fs = require('node:fs');
const path = require('node:path');

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const DEFAULT_MAX_SECONDS = 10 * 60;
const HEADER_REFRESH_MS = 5_000;

class CsrcAudioDumpWriter {
  constructor({
    logger = console,
    sampleRate = 48_000,
    participantId = 'unknown',
    participantName = null,
    provider = 'unknown',
    meetingId = null,
    baseDir = process.env.MSTEAMS_CSRC_AUDIO_DUMP_DIR || '/tmp/meeting-csrc-audio',
    maxSeconds = Number(process.env.MSTEAMS_CSRC_AUDIO_DUMP_MAX_SECONDS) || DEFAULT_MAX_SECONDS,
  } = {}) {
    this.logger = logger;
    this.sampleRate = Math.max(1, Number(sampleRate) || 48_000);
    this.participantId = String(participantId || 'unknown');
    this.participantName = participantName ? String(participantName) : null;
    this.provider = String(provider || 'unknown');
    this.meetingId = meetingId ? String(meetingId) : null;
    this.baseDir = baseDir;
    this.maxBytes = Math.max(1, maxSeconds) * this.sampleRate * 2;

    this._fd = null;
    this._path = null;
    this._metaPath = null;
    this._bytesWritten = 0;
    this._opened = false;
    this._disabled = false;
    this._truncated = false;
    this._lastHeaderRefreshMs = 0;
  }

  static isEnabled() {
    return TRUE_VALUES.has(String(process.env.MSTEAMS_CSRC_AUDIO_DUMP_ENABLED || '').toLowerCase());
  }

  get filePath() {
    return this._path;
  }

  write(pcm16Buffer) {
    if (this._disabled || !Buffer.isBuffer(pcm16Buffer) || pcm16Buffer.length === 0) return;
    try {
      this._ensureOpen();
      if (!this._fd) return;
      const remaining = this.maxBytes - this._bytesWritten;
      if (remaining <= 0) {
        this._markTruncated();
        return;
      }
      const chunk = pcm16Buffer.length > remaining ? pcm16Buffer.subarray(0, remaining) : pcm16Buffer;
      fs.writeSync(this._fd, chunk, 0, chunk.length, 44 + this._bytesWritten);
      this._bytesWritten += chunk.length;
      if (chunk.length < pcm16Buffer.length) this._markTruncated();
      this._refreshHeader(false);
    } catch (err) {
      this._disabled = true;
      this.logger.warn?.('[teams.csrc.dump] disabled after write failure', {
        err: err?.message,
        path: this._path,
      });
    }
  }

  close() {
    if (!this._fd) return;
    try {
      this._refreshHeader(true);
      this._writeMetadata(true);
      fs.closeSync(this._fd);
      this.logger.info?.('[teams.csrc.dump] finalized wav', {
        path: this._path,
        bytes: this._bytesWritten,
        duration_ms: Math.round(this._bytesWritten / (this.sampleRate * 2) * 1000),
        truncated: this._truncated,
      });
    } catch (err) {
      this.logger.warn?.('[teams.csrc.dump] close failed', { err: err?.message, path: this._path });
    } finally {
      this._fd = null;
    }
  }

  _ensureOpen() {
    if (this._opened) return;
    this._opened = true;
    const runId = sanitizePathPart(
      process.env.MSTEAMS_CSRC_AUDIO_DUMP_RUN_ID
      || this.meetingId
      || new Date().toISOString().replace(/[:.]/g, '-')
    );
    const dir = path.resolve(this.baseDir, runId);
    fs.mkdirSync(dir, { recursive: true });

    const speaker = sanitizePathPart(this.participantName || this.participantId).slice(0, 80) || 'unknown';
    const pid = sanitizePathPart(this.participantId).slice(-16) || 'unknown';
    const basename = `${Date.now()}-${sanitizePathPart(this.provider)}-${speaker}-${pid}`;
    this._path = path.join(dir, `${basename}.wav`);
    this._metaPath = path.join(dir, `${basename}.json`);
    this._fd = fs.openSync(this._path, 'w');
    fs.writeSync(this._fd, wavHeader(0, this.sampleRate), 0, 44, 0);
    this._writeMetadata(false);
    this.logger.info?.('[teams.csrc.dump] opened wav', {
      path: this._path,
      sampleRate: this.sampleRate,
      participant: this.participantName || this.participantId,
      provider: this.provider,
    });
  }

  _refreshHeader(force) {
    if (!this._fd) return;
    const now = Date.now();
    if (!force && now - this._lastHeaderRefreshMs < HEADER_REFRESH_MS) return;
    fs.writeSync(this._fd, wavHeader(this._bytesWritten, this.sampleRate), 0, 44, 0);
    this._lastHeaderRefreshMs = now;
    this._writeMetadata(false);
  }

  _markTruncated() {
    if (this._truncated) return;
    this._truncated = true;
    this._writeMetadata(false);
    this.logger.warn?.('[teams.csrc.dump] max dump duration reached', {
      path: this._path,
      max_bytes: this.maxBytes,
    });
  }

  _writeMetadata(closed) {
    if (!this._metaPath) return;
    const payload = {
      path: this._path,
      meeting_id: this.meetingId,
      participant_id: this.participantId,
      participant_name: this.participantName,
      provider: this.provider,
      sample_rate_hz: this.sampleRate,
      channels: 1,
      bits_per_sample: 16,
      bytes_written: this._bytesWritten,
      duration_ms: Math.round(this._bytesWritten / (this.sampleRate * 2) * 1000),
      truncated: this._truncated,
      closed,
      updated_at: new Date().toISOString(),
    };
    fs.writeFileSync(this._metaPath, JSON.stringify(payload, null, 2));
  }
}

function sanitizePathPart(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function wavHeader(dataBytes, sampleRate) {
  const safeDataBytes = Math.max(0, Math.min(Number(dataBytes) || 0, 0xffffffff - 36));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + safeDataBytes, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(safeDataBytes, 40);
  return header;
}

module.exports = { CsrcAudioDumpWriter, wavHeader };
