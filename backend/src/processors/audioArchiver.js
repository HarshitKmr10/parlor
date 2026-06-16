'use strict';

// Audio archiver — Phase 3 of the resilient-streaming plan.
//
// Streams the same PCM audio that goes to the diarizer, in parallel, into
// blob storage on a 10-second cadence. Enables three things downstream:
//
//   1. Crash recovery — if the meeting-worker dies mid-meeting, on next
//      boot the recovery scanner finds incomplete meetings and replays
//      audio from the archive into a fresh transcriber session,
//      catching the transcript up to the point of failure.
//   2. Replay with a different provider — if AssemblyAI mis-attributes,
//      operators can re-run the meeting through Deepgram or AWS Transcribe
//      from the archived audio without the user needing to re-meet.
//   3. Compliance / audit trail — full audio retention with lifecycle
//      rules (default: 7d hot, 30d cool, delete at 90d).
//
// Implementation:
//   • Bounded queue (default 64 chunks ≈ 10.6 minutes of audio at 10s
//     chunks) with drop-oldest policy on overflow. Crash-isolation: a
//     stuck blob upload doesn't backpressure the live transcription.
//   • Two parallel uploaders so a slow blob round-trip doesn't stall.
//   • Opus encoding via `@discordjs/opus` when available; falls back to
//     raw PCM16 WAV. Opus is ~8x smaller for the same intelligibility.
//   • Object naming: `meetings/{meeting_id}/audio/{seq:08d}.{ext}`.

const { Buffer } = require('node:buffer');

const DEFAULT_CHUNK_SECONDS = Number(process.env.AUDIO_ARCHIVE_CHUNK_SECONDS) || 10;
const DEFAULT_QUEUE_DEPTH = Number(process.env.AUDIO_ARCHIVE_QUEUE_DEPTH) || 64;

class AudioArchiver {
  constructor({
    logger = console,
    meetingId,
    storage,                 // { uploadObject({ key, body, contentType }) }
    enabled = (process.env.AUDIO_ARCHIVE_ENABLED || 'false').toLowerCase() === 'true',
    chunkSeconds = DEFAULT_CHUNK_SECONDS,
    sampleRate = 16_000,
    queueDepth = DEFAULT_QUEUE_DEPTH,
    encodeOpus = (process.env.AUDIO_ARCHIVE_OPUS || 'false').toLowerCase() === 'true',
  } = {}) {
    this.logger = logger;
    this.meetingId = meetingId;
    this.storage = storage;
    this.enabled = enabled && !!storage && !!meetingId;
    this.chunkSeconds = chunkSeconds;
    this.sampleRate = sampleRate;
    this.queueDepth = queueDepth;
    this.encodeOpus = encodeOpus;
    this._buffer = [];                    // pending PCM frames for current chunk
    this._bufferBytes = 0;
    this._chunkBytesTarget = chunkSeconds * sampleRate * 2; // 16-bit mono
    this._queue = [];                     // chunks awaiting upload
    this._seq = 0;
    this._stopRequested = false;
    this._uploaders = [];
    this.stats = { bytes_uploaded: 0, chunks_uploaded: 0, queue_drops: 0, upload_failures: 0 };
  }

  start() {
    if (!this.enabled || this._uploaders.length > 0) return;
    // Two parallel uploaders so a slow blob doesn't stall the queue.
    this._uploaders = [this._runUploader(0), this._runUploader(1)];
  }

  pushFrame(pcm16Buffer) {
    if (!this.enabled || this._stopRequested) return;
    if (!Buffer.isBuffer(pcm16Buffer) || pcm16Buffer.length === 0) return;
    this._buffer.push(pcm16Buffer);
    this._bufferBytes += pcm16Buffer.length;
    if (this._bufferBytes >= this._chunkBytesTarget) this._flushChunk();
  }

  async stop() {
    this._stopRequested = true;
    if (this._buffer.length > 0) this._flushChunk();
    if (this._uploaders.length > 0) {
      await Promise.allSettled(this._uploaders);
    }
  }

  _flushChunk() {
    const seq = ++this._seq;
    const pcm = Buffer.concat(this._buffer, this._bufferBytes);
    this._buffer = [];
    this._bufferBytes = 0;
    if (this._queue.length >= this.queueDepth) {
      this._queue.shift();
      this.stats.queue_drops += 1;
      this.logger.warn?.('[teams.archiver] queue full, dropping oldest chunk', {
        meeting_id: this.meetingId, seq,
      });
    }
    this._queue.push({ seq, pcm });
  }

  async _runUploader(workerId) {
    while (!this._stopRequested || this._queue.length > 0) {
      const item = this._queue.shift();
      if (!item) {
        if (this._stopRequested) break;
        await new Promise((r) => setTimeout(r, 100));
        continue;
      }
      try {
        const { body, ext, contentType } = await this._encode(item.pcm);
        const key = `meetings/${this.meetingId}/audio/${String(item.seq).padStart(8, '0')}.${ext}`;
        await this.storage.uploadObject({ key, body, contentType });
        this.stats.chunks_uploaded += 1;
        this.stats.bytes_uploaded += body.length;
      } catch (err) {
        this.stats.upload_failures += 1;
        this.logger.warn?.('[teams.archiver] upload failed', {
          worker: workerId, seq: item.seq, err: err?.message,
        });
        // Don't re-queue on failure — the queue is for crash recovery, not
        // perfect durability. Persistent upload failures fire the alert.
      }
    }
  }

  async _encode(pcmBuffer) {
    if (this.encodeOpus) {
      try {
        const { OpusEncoder } = require('@discordjs/opus');
        const enc = new OpusEncoder(this.sampleRate, 1);
        const opus = enc.encode(pcmBuffer);
        return { body: opus, ext: 'opus', contentType: 'audio/ogg; codecs=opus' };
      } catch (err) {
        this.logger.warn?.('[teams.archiver] opus encode failed, falling back to wav', err?.message);
      }
    }
    // WAV fallback — adds a 44-byte header to make the chunk standalone-playable.
    return { body: pcmToWav(pcmBuffer, this.sampleRate), ext: 'wav', contentType: 'audio/wav' };
  }
}

function pcmToWav(pcm, sampleRate) {
  const header = Buffer.alloc(44);
  const total = 36 + pcm.length;
  header.write('RIFF', 0);
  header.writeUInt32LE(total, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm], header.length + pcm.length);
}

module.exports = { AudioArchiver, pcmToWav };
