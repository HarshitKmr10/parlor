'use strict';

// CSRC-specific AWS Transcribe Streaming adapter.
//
// Keep this separate from streamingDiarizer/adapters/awsTranscribe.js because
// staging's diarization path imports that shared adapter directly. The CSRC
// pipeline has different lifecycle needs: each stream is already attributed to
// one participant, should avoid AWS speaker re-diarization, and can close
// naturally after bounded trailing silence without involving ResilientStreamer.

const { Buffer } = require('node:buffer');
const { awsClientConfigFromEnv } = require('../../utils/awsCredentials');

const TRAILING_SILENCE_MAX_MS = 1500;

class AwsCsrcTranscribeAdapter {
  constructor({
    logger = console,
    region = process.env.AWS_REGION || 'us-east-1',
    sampleRate = 16_000,
    languageCode = 'en-US',
    onSegment = () => {},
    onError = () => {},
    onReady = () => {},
    onClose = () => {},
    meetingStartMs = Date.now(),
    partialResultsStability = 'high',
    enableSpeakerLabel = true,
  } = {}) {
    this.provider = 'aws_transcribe';
    this.logger = logger;
    this.region = region;
    this.sampleRate = sampleRate;
    this.languageCode = languageCode;
    this.onSegment = onSegment;
    this.onError = onError;
    this.onReady = onReady;
    this.onClose = onClose;
    this.meetingStartMs = meetingStartMs;
    this.lastError = null;
    this.sessionId = null;

    this._client = null;
    this._closing = false;
    this.partialResultsStability = partialResultsStability;
    this.enableSpeakerLabel = enableSpeakerLabel;
    this._frameQueue = [];
    this._streamPromise = null;
    this._lastRealAudioMs = 0;
  }

  async connect() {
    const { TranscribeStreamingClient, StartStreamTranscriptionCommand } =
      require('@aws-sdk/client-transcribe-streaming');
    this._client = new TranscribeStreamingClient(awsClientConfigFromEnv({ region: this.region }));

    // Synthetic startup silence gets AWS to accept the HTTP/2 request before
    // the pool's pending frames drain. It must not count as real audio.
    this._frameQueue.push({
      buffer: Buffer.alloc(this.sampleRate * 2 * 0.04),
      real: false,
    });

    const self = this;
    const silenceFrame = Buffer.alloc(this.sampleRate * 2 * 0.1);
    const audioStream = (async function* () {
      while (!self._closing) {
        if (self._frameQueue.length > 0) {
          const frame = self._frameQueue.shift();
          if (frame.real) self._lastRealAudioMs = Date.now();
          yield { AudioEvent: { AudioChunk: frame.buffer } };
          continue;
        }

        if (self._lastRealAudioMs > 0
            && Date.now() - self._lastRealAudioMs > TRAILING_SILENCE_MAX_MS) {
          return;
        }

        yield { AudioEvent: { AudioChunk: silenceFrame } };
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    })();

    const command = new StartStreamTranscriptionCommand({
      LanguageCode: this.languageCode,
      MediaSampleRateHertz: this.sampleRate,
      MediaEncoding: 'pcm',
      AudioStream: audioStream,
      EnablePartialResultsStabilization: true,
      PartialResultsStability: this.partialResultsStability,
      ShowSpeakerLabel: this.enableSpeakerLabel,
    });

    this.logger.info?.('[teams.aws.csrc] connecting', { region: this.region, lang: this.languageCode });

    let response;
    try {
      response = await this._client.send(command);
      this.sessionId = response.SessionId || null;
    } catch (err) {
      this.lastError = err;
      this.logger.warn?.('[teams.aws.csrc] connect raw response', this._describeConnectError(err));
      throw err;
    }

    this.onReady();
    this._streamPromise = this._consume(response);
    this._streamPromise.then(
      () => {
        if (!this._closing) this.onClose();
      },
      (err) => {
        this.lastError = err;
        if (!this._closing) this.onClose(err);
      },
    );
  }

  pushFrame(pcm16Buffer) {
    if (this._closing) return;
    if (!Buffer.isBuffer(pcm16Buffer) || pcm16Buffer.length === 0) return;
    this._frameQueue.push({ buffer: pcm16Buffer, real: true });
  }

  heartbeat() {
    // The generator emits synthetic silence while idle. CSRC sessions close
    // naturally after bounded trailing silence, then lazy-respawn on the next
    // real participant frame.
  }

  async close() {
    this._closing = true;
    if (this._streamPromise) {
      try { await this._streamPromise; } catch (_) { /* swallow */ }
    }
  }

  _describeConnectError(err) {
    let raw = null;
    try {
      const resp = err?.$response;
      if (resp) {
        raw = {
          statusCode: resp.statusCode,
          headers: resp.headers,
          body: resp.body && typeof resp.body === 'object'
            ? (Buffer.isBuffer(resp.body) ? resp.body.toString('utf8') : JSON.stringify(resp.body))
            : String(resp.body || ''),
        };
      }
    } catch (_) { /* ignore - best-effort */ }
    return {
      name: err?.name,
      message: err?.message,
      statusCode: err?.$metadata?.httpStatusCode,
      raw,
    };
  }

  async _consume(response) {
    for await (const event of response.TranscriptResultStream) {
      if (this._closing) break;
      if (!event.TranscriptEvent) continue;
      const results = event.TranscriptEvent.Transcript?.Results || [];
      for (const result of results) {
        const isFinal = !result.IsPartial;
        for (const alt of (result.Alternatives || [])) {
          const transcript = alt.Transcript;
          if (!transcript || !transcript.trim()) continue;
          const items = alt.Items || [];
          const groups = groupItemsBySpeaker(items);
          for (const group of groups) {
            const startMs = this._secondsToWallMs(group.start);
            const endMs = this._secondsToWallMs(group.end);
            const segment = Object.freeze({
              speaker_idx: group.speaker != null ? `spk_${group.speaker}` : null,
              speaker_label: group.speaker != null ? String(group.speaker) : null,
              start_ms: startMs,
              end_ms: endMs,
              text: group.text,
              is_final: isFinal,
              provider: 'aws_transcribe',
              confidence: typeof group.confidence === 'number' ? group.confidence : null,
              words: group.items.map((it) => ({
                word: String(it.Content || '').trim(),
                start_ms: this._secondsToWallMs(parseFloat(it.StartTime || 0)),
                end_ms: this._secondsToWallMs(parseFloat(it.EndTime || 0)),
                speaker_idx: it.Speaker != null ? `spk_${it.Speaker}` : null,
                confidence: typeof it.Confidence === 'number' ? it.Confidence : null,
              })),
              raw: { result_id: result.ResultId, channel: result.ChannelId, session_id: this.sessionId },
            });
            try { this.onSegment(segment); }
            catch (e) { this.logger.warn?.('[teams.aws.csrc] onSegment threw', e?.message); }
          }
        }
      }
    }
  }

  _secondsToWallMs(secs) {
    return Math.round(this.meetingStartMs + Math.max(0, Number(secs) || 0) * 1000);
  }
}

function groupItemsBySpeaker(items) {
  if (!items || items.length === 0) return [];
  const groups = [];
  let current = null;
  for (const item of items) {
    const speaker = item.Speaker == null ? null : String(item.Speaker);
    const isPunct = item.Type === 'punctuation';
    if (!current || (current.speaker !== speaker && !isPunct)) {
      if (current) groups.push(current);
      current = {
        speaker,
        items: [item],
        start: parseFloat(item.StartTime || 0),
        end: parseFloat(item.EndTime || 0),
        _wordParts: isPunct ? [] : [String(item.Content || '').trim()],
      };
    } else {
      current.items.push(item);
      if (item.EndTime != null) current.end = Math.max(current.end, parseFloat(item.EndTime));
      if (!isPunct) current._wordParts.push(String(item.Content || '').trim());
      else if (current._wordParts.length > 0) current._wordParts[current._wordParts.length - 1] += String(item.Content || '');
    }
  }
  if (current) groups.push(current);
  for (const group of groups) {
    group.text = (group._wordParts || []).join(' ').trim();
  }
  return groups;
}

module.exports = { AwsCsrcTranscribeAdapter, groupItemsBySpeaker };
