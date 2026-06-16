'use strict';

// Sidecar bot launcher (PR #3592 RCA #32).
//
// The sidecar's bot_supervisor.spawn() execs:
//     node <NODE_BOT_ENTRYPOINT> <platform>
// and sets MEETING_ID, MEETING_URL, BOT_NAME, SESSION_NUMBER,
// TRANSCRIPT_SOURCE, ORG_ID, MAX_DURATION_SECONDS as env vars.
//
// The PR pointed NODE_BOT_ENTRYPOINT at bot_scripts/index.js, which is
// actually a legacy Express HTTP server — wrong shape, missing deps
// (cors/helmet/express-rate-limit), and not what the sidecar contract
// describes. This file is the right shape: read env + platform argv,
// require the platform module, call joinMeeting().

require('dotenv').config({ override: false });

const path = require('node:path');

const platform = (process.argv[2] || process.env.PLATFORM || '').toLowerCase();
if (!platform) {
  console.error('[sidecar_launcher] platform argv missing (argv[2])');
  process.exit(2);
}

const supported = new Set(['msteams', 'msteams_playwright', 'googlemeet']);
if (!supported.has(platform)) {
  console.error(`[sidecar_launcher] unsupported platform: ${platform}`);
  process.exit(2);
}

const meetingUrl = process.env.MEETING_URL;
const meetingDbId = process.env.MEETING_ID;
const botName = process.env.BOT_NAME || 'Meeting Bot';
const sessionNumber = Number(process.env.SESSION_NUMBER || '1');
const transcriptSource = process.env.TRANSCRIPT_SOURCE || undefined;

if (!meetingUrl || !meetingDbId) {
  console.error('[sidecar_launcher] MEETING_URL and MEETING_ID env vars required');
  process.exit(2);
}

const platformModulePath = platform.startsWith('msteams')
  ? path.join(__dirname, 'msteams', 'joinMeeting')
  : path.join(__dirname, 'googlemeet');

console.log(`[sidecar_launcher] starting platform=${platform} meeting_id=${meetingDbId} session=${sessionNumber}`);

const mod = require(platformModulePath);
const joinMeeting = mod.joinMeeting || mod.joinTeamsMeeting;
if (typeof joinMeeting !== 'function') {
  console.error('[sidecar_launcher] platform module exposes no joinMeeting()');
  process.exit(3);
}

const credentials = { name: botName };
const options = {
  meetingDbId,
  sessionNumber,
  transcriptSource,
  botName,
};

(async () => {
  try {
    const result = await joinMeeting(meetingUrl, credentials, options);
    console.log(`[sidecar_launcher] joinMeeting returned: ${JSON.stringify(result)}`);
    process.exit(result && result.exitCode != null ? result.exitCode : 0);
  } catch (err) {
    console.error(`[sidecar_launcher] joinMeeting failed: ${err && err.message ? err.message : err}`);
    console.error(err && err.stack ? err.stack : '');
    process.exit(1);
  }
})();
