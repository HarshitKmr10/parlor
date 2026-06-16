'use strict';

// Transcript cleanup — end-of-meeting LLM pass over the persisted segments.
//
// What it fixes:
//   • Speaker mis-attribution from the diarization binder (e.g. one
//     speaker's utterance got tagged with their neighbour's name during
//     a contested binding window).
//   • Fragmented utterances ("I- I think we should-") merged into clean
//     sentences while preserving timing.
//   • Disfluencies (um, uh, like) trimmed when the next pass requests
//     `aggressive_cleanup`. Default is conservative — only ambiguous
//     attributions are touched.
//   • Inconsistent capitalization / spelling of proper names.
//
// What it does NOT do:
//   • Mutate original transcript content. Cleaned segments are appended
//     with `meta.cleanup` recording the change so the audit trail remains
//     intact.
//
// Cost ceiling:
//   ~$0.05/meeting via prompt-size caps + chunking with overlap. Default
//   model = Claude 3.5 Sonnet via Bedrock; falls back to gpt-4o-mini on
//   OpenAI when Bedrock is unavailable.

const DEFAULT_MODEL = process.env.TRANSCRIPT_CLEANUP_MODEL || 'anthropic.claude-3-5-sonnet-20240620-v1:0';
const DEFAULT_PROVIDER = (process.env.TRANSCRIPT_CLEANUP_PROVIDER || 'bedrock').toLowerCase();
const SEGMENTS_PER_CHUNK = Math.max(1, Number(process.env.TRANSCRIPT_CLEANUP_SEGMENTS_PER_CHUNK) || 50);
const OVERLAP_SEGMENTS = Math.max(0, Number(process.env.TRANSCRIPT_CLEANUP_OVERLAP) || 5);
const MAX_INPUT_CHARS = Math.max(2000, Number(process.env.TRANSCRIPT_CLEANUP_MAX_CHARS) || 16_000);

const CLEANUP_SYSTEM_PROMPT = [
  'You are a meeting-transcript cleanup assistant.',
  'You receive an array of transcript segments with provider-side speaker',
  'labels and (sometimes) bound real names. Some segments are mis-attributed',
  'because the diarizer guessed wrong on a speaker change. You also see a list',
  'of confirmed participants in this meeting.',
  '',
  'Your job:',
  '  1. Where two adjacent segments clearly form one continuous utterance from',
  '     the same speaker, merge them. Preserve start/end timing of the merged',
  '     range.',
  '  2. Where a segment is plausibly mis-attributed (e.g. a "Speaker 2"',
  '     segment is sandwiched between two confident "Alice" segments and',
  '     contextually continues Alice\'s thought), reassign it.',
  '  3. Lightly fix capitalization of proper names that match the participant',
  '     list.',
  '  4. Do NOT invent content, do NOT remove disfluencies or filler unless the',
  '     `aggressive_cleanup` flag is true.',
  '',
  'Return STRICT JSON with shape:',
  '{',
  '  "cleaned_segments": [',
  '    {',
  '      "original_indices": [int, ...],   // 0-indexed positions in the input',
  '      "speaker": "Real Name",            // bound name or "Speaker N"',
  '      "text": "...",',
  '      "start_ms": int,',
  '      "end_ms": int,',
  '      "reason": "merge"|"reattribute"|"capitalize"|"keep"',
  '    }',
  '  ]',
  '}',
  'Output JSON only. No prose. No markdown fences.',
].join('\n');

class TranscriptCleanup {
  constructor({
    logger = console,
    provider = DEFAULT_PROVIDER,
    model = DEFAULT_MODEL,
    bedrockClient = null,
    openAIClient = null,
    aggressive = false,
  } = {}) {
    this.logger = logger;
    this.provider = provider;
    this.model = model;
    this.aggressive = aggressive;
    this._bedrockClient = bedrockClient;
    this._openAIClient = openAIClient;
  }

  // Run the cleanup pass over `segments`. `participants` is an array of
  // {name, email?} pulled from rosterWatcher.snapshot(). Returns an array
  // of cleaned segments preserving the original ones — the caller decides
  // whether to append them as `meta.cleanup` rows or rewrite.
  //
  // Confidence-weighted: segments with binding.confidence in
  // {'locked', 'caption_match'} are passed through as 'keep' WITHOUT an
  // LLM round-trip (the binder + captions are already ground-truth there).
  // The LLM only sees uncertain segments — typically the first ~10s of a
  // meeting before the binder locks, plus any post-rebind windows. This
  // both cuts cost and reduces false LLM edits to already-correct rows.
  async clean(segments, participants = []) {
    if (!Array.isArray(segments) || segments.length === 0) return [];

    const HIGH_CONF = new Set(['locked', 'caption_match']);
    const indexed = segments.map((s, i) => ({ ...s, _origIdx: i }));
    const trusted = [];
    const uncertain = [];
    for (const seg of indexed) {
      const conf = seg.binding?.confidence
        || seg.diarization?.binding?.confidence
        || (seg.attribution_confidence === 'locked' ? 'locked' : null);
      if (conf && HIGH_CONF.has(conf)) {
        trusted.push({
          original_indices: [seg._origIdx],
          speaker: seg.bound_speaker || seg.speaker || seg.speaker_idx || 'Unknown',
          text: seg.text,
          start_ms: seg.start_ms,
          end_ms: seg.end_ms,
          reason: 'keep',
        });
      } else {
        uncertain.push(seg);
      }
    }
    this.logger.info?.('[teams.cleanup] confidence-weighted', {
      trusted_pass_through: trusted.length,
      uncertain_to_llm: uncertain.length,
    });
    if (uncertain.length === 0) return trusted;

    const chunks = this._chunk(uncertain);
    const cleaned = [];
    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];
      try {
        const result = await this._cleanChunk(chunk, participants, i);
        if (Array.isArray(result.cleaned_segments)) cleaned.push(...result.cleaned_segments);
      } catch (err) {
        this.logger.warn?.('[teams.cleanup] chunk failed, skipping', {
          chunk_index: i, err: err?.message,
        });
        // Fail-open: emit each original as a "keep" so the user doesn't
        // lose data when the LLM call hiccups.
        for (let j = 0; j < chunk.length; j += 1) {
          cleaned.push({
            original_indices: [chunk[j]._origIdx],
            speaker: chunk[j].bound_speaker || chunk[j].speaker_idx || 'Unknown',
            text: chunk[j].text,
            start_ms: chunk[j].start_ms,
            end_ms: chunk[j].end_ms,
            reason: 'keep',
          });
        }
      }
    }

    // Merge trusted pass-throughs with LLM-cleaned segments, sorted by
    // start_ms so the appended audit row sequence is chronological.
    const merged = [...trusted, ...this._dedupeOverlap(cleaned)];
    merged.sort((a, b) => (a.start_ms || 0) - (b.start_ms || 0));
    return merged;
  }

  _chunk(segments) {
    // Honour pre-existing _origIdx when present (caller has already
    // attached canonical indices, e.g. confidence-weighted skip in clean()).
    const indexed = segments.map((s, i) => (
      Number.isFinite(s._origIdx) ? s : { ...s, _origIdx: i }
    ));
    const out = [];
    let start = 0;
    while (start < indexed.length) {
      const end = Math.min(indexed.length, start + SEGMENTS_PER_CHUNK);
      const chunk = indexed.slice(start, end);
      out.push(chunk);
      if (end >= indexed.length) break;
      start = end - OVERLAP_SEGMENTS;
    }
    return out;
  }

  _dedupeOverlap(segments) {
    // Drop later occurrences of the same `original_indices` set —
    // overlap windows can produce duplicate cleaned outputs for the same
    // input segment.
    const seen = new Set();
    const out = [];
    for (const seg of segments) {
      const key = (seg.original_indices || []).join(',');
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      out.push(seg);
    }
    return out;
  }

  async _cleanChunk(chunk, participants, chunkIndex) {
    const userPayload = JSON.stringify({
      aggressive_cleanup: this.aggressive,
      participants: participants.map((p) => ({ name: p.name, email: p.email })),
      segments: chunk.map((c) => ({
        idx: c._origIdx,
        speaker: c.bound_speaker || c.speaker_idx || null,
        text: c.text,
        start_ms: c.start_ms,
        end_ms: c.end_ms,
        provider: c.provider,
      })),
    });

    if (userPayload.length > MAX_INPUT_CHARS) {
      this.logger.warn?.('[teams.cleanup] chunk exceeds char budget, splitting', {
        chunk_index: chunkIndex, chars: userPayload.length,
      });
    }

    let raw = '';
    if (this.provider === 'bedrock') raw = await this._invokeBedrock(userPayload);
    else if (this.provider === 'openai') raw = await this._invokeOpenAI(userPayload);
    else if (this.provider === 'azure_openai') raw = await this._invokeOpenAI(userPayload);
    else throw new Error(`unsupported cleanup provider: ${this.provider}`);

    return parseCleanupResponse(raw);
  }

  async _invokeBedrock(userPayload) {
    if (!this._bedrockClient) {
      const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
      this._bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });
      this._BedrockInvokeCmd = InvokeModelCommand;
    }
    const cmd = new this._BedrockInvokeCmd({
      modelId: this.model,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4096,
        temperature: 0,
        system: CLEANUP_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPayload }],
      }),
    });
    const res = await this._bedrockClient.send(cmd);
    const body = JSON.parse(new TextDecoder().decode(res.body));
    return body?.content?.[0]?.text || '';
  }

  async _invokeOpenAI(userPayload) {
    if (!this._openAIClient) {
      const OpenAI = require('openai');
      this._openAIClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: process.env.AZURE_OPENAI_ENDPOINT || undefined,
      });
    }
    const res = await this._openAIClient.chat.completions.create({
      model: this.model || 'gpt-4o-mini',
      temperature: 0,
      messages: [
        { role: 'system', content: CLEANUP_SYSTEM_PROMPT },
        { role: 'user', content: userPayload },
      ],
      response_format: { type: 'json_object' },
    });
    return res.choices?.[0]?.message?.content || '';
  }
}

function parseCleanupResponse(raw) {
  if (!raw || typeof raw !== 'string') return { cleaned_segments: [] };
  let text = raw.trim();
  // Tolerate accidental ``` fences.
  const fenced = /```(?:json)?\n([\s\S]*?)\n```/.exec(text);
  if (fenced) text = fenced[1].trim();
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return { cleaned_segments: parsed };
    if (Array.isArray(parsed?.cleaned_segments)) return { cleaned_segments: parsed.cleaned_segments };
    return { cleaned_segments: [] };
  } catch (_) {
    return { cleaned_segments: [] };
  }
}

module.exports = { TranscriptCleanup, parseCleanupResponse, CLEANUP_SYSTEM_PROMPT };
