'use strict';

// Lightweight required-key validator. Run from boot scripts to fail
// fast when a misconfigured env tries to start the bot.
//
// Per the agreed standalone contract:
//   - DATABASE_URL is the only universally required key.
//   - Everything else is platform- or feature-gated and validated lazily.

const REQUIRED = Object.freeze(['DATABASE_URL']);

const PLATFORM_REQUIRED = Object.freeze({
  // Required when the bot is expected to join Zoom meetings.
  zoom: ['ZOOM_APP_CLIENT_ID', 'ZOOM_APP_CLIENT_SECRET'],
});

function assertRequired() {
  const missing = REQUIRED.filter((k) => !process.env[k] || process.env[k] === `<REQUIRED>`);
  if (missing.length === 0) return;
  process.stderr.write(
    `\n❌ meeting-joiner: missing required env keys: ${missing.join(', ')}\n` +
    `   See meeting-joiner/.env.example for the full env contract.\n\n`
  );
  process.exit(1);
}

function warnMissingForPlatform(platform) {
  const list = PLATFORM_REQUIRED[platform];
  if (!list) return;
  const missing = list.filter((k) => !process.env[k]);
  if (missing.length === 0) return;
  console.warn(
    `[meeting-joiner] platform=${platform} missing optional keys: ${missing.join(', ')}. ` +
    `Bot will not be able to join ${platform} meetings until they are set.`
  );
}

module.exports = { REQUIRED, PLATFORM_REQUIRED, assertRequired, warnMissingForPlatform };
