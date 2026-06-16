'use strict';

// Composition root for the `webrtc_csrc` attribution mode.
//
// Two routing pipelines, picked at compose time by MSTEAMS_CSRC_ROUTING:
//
//   - 'floor_owner' (default) — TeamsFloorOwnerAttributionSource. Raw CSRC
//     observations + floor-owner stickiness on overlap. No state machine,
//     no speech-interval store, no 2 s lookback. Frames are attributed
//     directly off the CSRC poll observations.
//
//   - 'earliest_start' — TeamsCsrcAttributionSource. 5-of-5 debounce +
//     speech-interval store + earliest-start tiebreak (the original
//     pipeline, kept for A/B comparison and as a fallback).
//
// Both feed the same PerParticipantStreamPool; the pool doesn't know or
// care which routing decided each frame. The frame callback shape is
// identical across sources.

const { TeamsCsrcAttributionSource } = require('./TeamsCsrcAttributionSource');
const { TeamsFloorOwnerAttributionSource } = require('./TeamsFloorOwnerAttributionSource');
const { PerParticipantStreamPool } = require('./PerParticipantStreamPool');
const { pickAsrAdapterFactory } = require('./asrProvider');

function composeWebrtcCsrcAttribution({
  logger = console,
  meetingStartMs = Date.now(),
  region = process.env.AWS_REGION || 'us-east-1',
  languageCode = process.env.TRANSCRIPTION_LANGUAGE || 'en-US',
  sampleRate = 16_000,
  maxSessions = Number(process.env.MSTEAMS_CSRC_MAX_SESSIONS) || 4,
  meetingId = null,
  onSegment = () => {},
  onError = () => {},
} = {}) {
  const routingMode = process.env.MSTEAMS_CSRC_ROUTING === 'earliest_start'
    ? 'earliest_start'
    : 'floor_owner';
  const isFloor = routingMode === 'floor_owner';

  // ASR provider selection — shared with Google Meet's captureBridge so
  // both bots stay aligned on whichever streaming transcriber is
  // configured. See asrProvider.js for env semantics.
  //
  // floor_owner-only AWS quality knobs (sampleRate 48 kHz, partial
  // stability 'low', enableSpeakerLabel false): each per-participant
  // session sees a single speaker so re-diarization is wasted work, and
  // 'low' partial stability lets the model keep revising — better
  // final accuracy when we never display partials. These are AWS-only
  // and are confined to the floor branch so other adapter callers
  // (diarization, ResilientStreamer) keep their existing defaults.
  const { provider: asrProvider, factory: adapterFactory } = pickAsrAdapterFactory({
    extraAwsOpts: isFloor
      ? { partialResultsStability: 'low', enableSpeakerLabel: false }
      : {},
  });

  const pool = new PerParticipantStreamPool({
    logger,
    region,
    languageCode,
    sampleRate: isFloor ? 48_000 : sampleRate,
    maxSessions,
    meetingStartMs,
    meetingId,
    onSegment,
    onError,
    adapterFactory,
  });

  const sourceOpts = {
    logger,
    onFrame: ({ pcm, ts_ms, participant_id, participant_name }) => {
      pool.pushFrame({
        pid: participant_id,
        name: participant_name,
        pcm,
        ts_ms,
      });
    },
    onHealth: (h) => {
      if (!h.ok) logger.warn?.('[teams.csrc] degraded', h);
      else logger.info?.('[teams.csrc] healthy', h);
    },
  };

  const source = routingMode === 'floor_owner'
    ? new TeamsFloorOwnerAttributionSource({
        ...sourceOpts,
        resolveLagMs: Number(process.env.MSTEAMS_FLOOR_RESOLVE_LAG_MS) ||
          Number(process.env.MSTEAMS_FLOOR_QUEUE_LAG_MS) ||
          600,
        floorOwnerMinSoloMs: Number(process.env.MSTEAMS_FLOOR_MIN_SOLO_MS) || 300,
        preRollMs: Number(process.env.MSTEAMS_FLOOR_PRE_ROLL_MS) || 300,
        noiseNamePattern: process.env.MSTEAMS_FLOOR_NOISE_NAME_PATTERN,
      })
    : new TeamsCsrcAttributionSource(sourceOpts);

  pool.start();
  logger.info?.('[teams.csrc] routing mode', { mode: routingMode, asr: asrProvider });

  return {
    install: (context) => source.install(context),
    bindPage: (page) => source.bindPage(page),
    snapshot: (page) => source.snapshot(page),
    health: () => source.health(),
    stats: () => ({ source: source.stats(), pool: pool.stats() }),
    stop: async () => { await pool.stop(); },
  };
}

module.exports = { composeWebrtcCsrcAttribution };
