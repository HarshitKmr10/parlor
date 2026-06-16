#!/usr/bin/env node
'use strict';

/**
 * replay-meeting — re-transcribe an archived meeting through a fresh
 *                  ResilientStreamer with optional provider override.
 *
 * Lists `meetings/{meeting_id}/audio/{seq}.{ext}` objects from the
 * configured blob backend, decodes each chunk back to PCM16 (Opus → PCM
 * via ffmpeg if available; WAV → strip header), and replays them at
 * either real-time pace or 10x for batch into a fresh streamer.
 *
 * Use-cases:
 *   1. Debug: a live meeting got bad attribution; re-run with the same
 *      provider to confirm reproducibility, then with a different one to
 *      compare diff.
 *   2. Backfill: AssemblyAI was down during a meeting → re-transcribe
 *      from archive against AWS / Deepgram.
 *   3. Tuning: changing binder thresholds or warmup window — replay a
 *      known-bad meeting and verify the change actually improved it.
 *
 * Output: a `transcript_replay` JSON file with the cleaned-up segments.
 * Optionally writes back to the meeting_joiner row's transcript.replays
 * array (--write-back) so the dashboard can diff/show replay attempts.
 *
 * USAGE:
 *   node tools/replay-meeting/index.js \
 *     --meeting-id <uuid> \
 *     [--provider assemblyai|aws_transcribe|deepgram] \
 *     [--rate realtime|fast] \
 *     [--out path.json] \
 *     [--write-back]
 */

const fs = require('node:fs/promises');
const path = require('node:path');
const { Buffer } = require('node:buffer');

const argv = parseArgv(process.argv.slice(2));
if (argv.help || !argv['meeting-id']) {
  console.error([
    'replay-meeting — re-transcribe an archived meeting',
    '',
    'Usage:',
    '  node tools/replay-meeting/index.js --meeting-id <uuid> [options]',
    '',
    'Options:',
    '  --meeting-id <uuid>        (required) The meeting to replay',
    '  --provider <name>          assemblyai (default) | aws_transcribe | deepgram',
    '  --rate <mode>              realtime (default) | fast',
    '  --out <path>               Where to write the replay transcript JSON',
    '  --write-back               Also persist into meeting_joiner.transcript.replays',
    '  --help                     Show this help',
  ].join('\n'));
  process.exit(argv.help ? 0 : 1);
}

const MEETING_ID = argv['meeting-id'];
const PROVIDER = (argv.provider || 'assemblyai').toLowerCase();
const RATE = (argv.rate || 'realtime').toLowerCase();
const OUT_PATH = argv.out || `replay_${MEETING_ID}_${PROVIDER}_${Date.now()}.json`;
const WRITE_BACK = !!argv['write-back'];

(async function main() {
  const { ResilientStreamer } = require('../../src/processors/streamingDiarizer');
  const { ObjectStorage } = require('../../src/storage/objectStorage');

  const storage = new ObjectStorage({ logger: console });
  if (!storage.isReady()) {
    die('No object storage backend configured (AZURE_STORAGE_CONNECTION_STRING or S3 creds).');
  }

  console.error(`[replay] meeting=${MEETING_ID} provider=${PROVIDER} rate=${RATE}`);

  // List archived audio chunks. Each backend has its own list call; we
  // implement listObjects on demand here so we don't have to plumb it into
  // ObjectStorage.uploadObject's interface.
  const chunks = await listArchivedChunks(storage, MEETING_ID);
  if (chunks.length === 0) {
    die(`No archived audio chunks under meetings/${MEETING_ID}/audio/. Was AUDIO_ARCHIVE_ENABLED=true during the meeting?`);
  }
  console.error(`[replay] ${chunks.length} chunks found, total ~${humanBytes(chunks.reduce((s, c) => s + c.size, 0))}`);

  const segments = [];
  const streamer = new ResilientStreamer({
    logger: console,
    provider: PROVIDER,
    config: {
      apiKey: PROVIDER === 'assemblyai' ? process.env.ASSEMBLYAI_API_KEY
            : PROVIDER === 'deepgram' ? process.env.DEEPGRAM_API_KEY
            : undefined,
      maxSpeakers: Number(process.env.ASSEMBLYAI_MAX_SPEAKERS) || 6,
      languageCode: process.env.TRANSCRIPTION_LANGUAGE || 'en-US',
      meetingStartMs: Date.now(),
    },
    onSegment: (s) => { segments.push(s); },
    onPartial: () => { /* drop partials in replay */ },
    onError: (e) => console.error('[replay] streamer error:', e?.message),
  });
  await streamer.start();

  // Decode each chunk back to raw PCM and push it into the streamer.
  // Realtime pace = sleep `chunk_seconds` between chunks. Fast = no sleep.
  const chunkSeconds = Number(process.env.AUDIO_ARCHIVE_CHUNK_SECONDS) || 10;
  const sleep = RATE === 'realtime' ? (ms) => new Promise((r) => setTimeout(r, ms)) : () => Promise.resolve();
  for (const chunk of chunks) {
    const body = await downloadChunk(storage, chunk.key);
    const pcm = decodeChunkToPcm(body, chunk.key);
    if (!pcm || pcm.length === 0) {
      console.error(`[replay] skip ${chunk.key} — could not decode`);
      continue;
    }
    // Push in 200ms slices so the streamer's pacing/heartbeat sees a
    // realistic ingestion rate.
    const sliceBytes = 16_000 * 2 * 0.2;
    for (let off = 0; off < pcm.length; off += sliceBytes) {
      streamer.pushFrame(pcm.subarray(off, Math.min(off + sliceBytes, pcm.length)));
    }
    await sleep(chunkSeconds * 1_000);
  }

  // Wait a beat for any in-flight finals to land, then close.
  await new Promise((r) => setTimeout(r, 5_000));
  await streamer.stop();

  console.error(`[replay] captured ${segments.length} segments`);

  await fs.writeFile(OUT_PATH, JSON.stringify({
    meeting_id: MEETING_ID,
    provider: PROVIDER,
    rate: RATE,
    chunks: chunks.length,
    segments,
    replayed_at: new Date().toISOString(),
  }, null, 2));
  console.error(`[replay] wrote ${OUT_PATH}`);

  if (WRITE_BACK) {
    console.error('[replay] --write-back is a stub today; the next iteration adds a transcript_replay row writer');
  }
})().catch((err) => die(err.message || String(err)));

// ─── Storage helpers ────────────────────────────────────────────────────

async function listArchivedChunks(storage, meetingId) {
  if (storage.backend === 'azure') {
    const containerClient = storage._azure.client.getContainerClient(storage._azure.containerName);
    const out = [];
    for await (const blob of containerClient.listBlobsFlat({ prefix: `meetings/${meetingId}/audio/` })) {
      out.push({ key: blob.name, size: blob.properties?.contentLength || 0 });
    }
    out.sort((a, b) => a.key.localeCompare(b.key));
    return out;
  }
  if (storage.backend === 's3') {
    const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
    const out = [];
    let continuationToken;
    do {
      const res = await storage._s3.client.send(new ListObjectsV2Command({
        Bucket: storage._s3.bucket,
        Prefix: `meetings/${meetingId}/audio/`,
        ContinuationToken: continuationToken,
      }));
      for (const obj of (res.Contents || [])) {
        out.push({ key: obj.Key, size: obj.Size || 0 });
      }
      continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (continuationToken);
    out.sort((a, b) => a.key.localeCompare(b.key));
    return out;
  }
  return [];
}

async function downloadChunk(storage, key) {
  if (storage.backend === 'azure') {
    const containerClient = storage._azure.client.getContainerClient(storage._azure.containerName);
    const blockBlob = containerClient.getBlockBlobClient(key);
    const buf = await blockBlob.downloadToBuffer();
    return buf;
  }
  if (storage.backend === 's3') {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const res = await storage._s3.client.send(new GetObjectCommand({
      Bucket: storage._s3.bucket, Key: key,
    }));
    const chunks = [];
    for await (const c of res.Body) chunks.push(c);
    return Buffer.concat(chunks);
  }
  return null;
}

function decodeChunkToPcm(body, key) {
  if (key.endsWith('.wav')) {
    // Strip the 44-byte WAV header.
    return body.slice(44);
  }
  if (key.endsWith('.opus')) {
    try {
      const { OpusEncoder } = require('@discordjs/opus');
      const dec = new OpusEncoder(16_000, 1);
      return dec.decode(body);
    } catch (err) {
      console.error('[replay] opus decode failed (install @discordjs/opus or convert to wav):', err.message);
      return null;
    }
  }
  console.error(`[replay] unknown chunk format: ${key}`);
  return null;
}

// ─── Argv + utilities ───────────────────────────────────────────────────

function parseArgv(args) {
  const out = {};
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next === undefined || next.startsWith('--')) { out[key] = true; }
      else { out[key] = next; i += 1; }
    }
  }
  return out;
}

function humanBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function die(msg) {
  console.error(`[replay] ERROR: ${msg}`);
  process.exit(1);
}
