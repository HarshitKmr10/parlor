'use strict';

// Shared ASR adapter factory. Both Teams' composeWebrtcCsrcAttribution
// (mixed track + CSRC routing) and Google Meet's captureBridge
// (per-peer audio receivers) feed PerParticipantStreamPool, so they
// need a consistent way to pick the streaming-transcription provider.
//
// Provider matrix (must stay in sync with Teams):
//   AWS Transcribe Streaming  — AwsCsrcTranscribeAdapter
//   Azure Speech Streaming    — AzureSpeechAdapter
//
// Selection is via the ASR_PROVIDER env var (cross-platform), with
// MSTEAMS_ASR_PROVIDER as a fallback so any prod / staging configs
// already pointed at Azure for Teams continue to work without a
// re-deploy. Default is AWS.
//
// Adapters are lazy-required inside the returned factory closure so
// callers that inject their own factory (tests, custom routes) never
// pay the SDK load cost — and so the Azure SDK only loads when the
// 'azure' branch is actually selected.

const PROVIDER_AWS = 'aws';
const PROVIDER_AZURE = 'azure';
const SUPPORTED_PROVIDERS = new Set([PROVIDER_AWS, PROVIDER_AZURE]);

function resolveProvider(explicit) {
  const candidates = [
    explicit,
    process.env.ASR_PROVIDER,
    process.env.MSTEAMS_ASR_PROVIDER,
  ];
  for (const c of candidates) {
    if (typeof c !== 'string') continue;
    const lower = c.trim().toLowerCase();
    if (SUPPORTED_PROVIDERS.has(lower)) return lower;
  }
  return PROVIDER_AWS;
}

// Returns { provider, factory } where factory is `(opts) → adapter`
// suitable for PerParticipantStreamPool. `extraAwsOpts` lets callers
// tweak AWS-specific knobs (e.g. floor-owner / per-peer single-speaker
// tuning) without rewriting the helper.
function pickAsrAdapterFactory({ provider, extraAwsOpts = {} } = {}) {
  const resolved = resolveProvider(provider);
  if (resolved === PROVIDER_AZURE) {
    return {
      provider: PROVIDER_AZURE,
      factory: (opts) => {
        const { AzureSpeechAdapter } = require('../streamingDiarizer/adapters/azureSpeech');
        return new AzureSpeechAdapter(opts);
      },
    };
  }
  return {
    provider: PROVIDER_AWS,
    factory: (opts) => {
      const { AwsCsrcTranscribeAdapter } = require('./AwsCsrcTranscribeAdapter');
      return new AwsCsrcTranscribeAdapter({ ...opts, ...extraAwsOpts });
    },
  };
}

module.exports = {
  pickAsrAdapterFactory,
  resolveProvider,
  PROVIDER_AWS,
  PROVIDER_AZURE,
  SUPPORTED_PROVIDERS,
};
