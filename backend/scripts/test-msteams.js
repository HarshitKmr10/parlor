#!/usr/bin/env node
'use strict';

// One-shot smoke test for the MS Teams bot module.
// Usage:
//   node scripts/test-msteams.js "<meeting_url>" [bot_name]
// Reads .env from the meeting-joiner root.
//
// Streams every transcribed segment as it lands and prints a timing report
// when the bot leaves (Ctrl+C is clean — it triggers leaveMeeting()).

require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });

const path = require('node:path');
const fs = require('node:fs');
const { joinMeeting } = require('../src/bot/bot_scripts/msteams/joinMeeting');

const meetingUrl = process.argv[2];
const botName = process.argv[3] || process.env.BOT_NAME || 'AIOps Test Bot';

if (!meetingUrl) {
  console.error('Usage: node scripts/test-msteams.js "<teams_meeting_url>" [bot_name]');
  process.exit(2);
}

console.log('--------------------------------------------------------------------');
console.log(' MS Teams v2 smoke test');
console.log('--------------------------------------------------------------------');
console.log(' meeting_url :', meetingUrl);
console.log(' bot_name    :', botName);
console.log(' provider    :', process.env.LLM_PROVIDER || 'openai');
console.log(' chunk_ms    :', process.env.MSTEAMS_CHUNK_MS || '5000');
console.log(' lobby_ms    :', process.env.MSTEAMS_LOBBY_MS || '60000');
console.log(' headless    :', process.env.MSTEAMS_HEADLESS || 'false');
console.log(' dump_audio  :', process.env.MSTEAMS_DUMP_AUDIO || 'false');
console.log('--------------------------------------------------------------------');

// Inject a fake real-time processor so the bridge has somewhere to deliver
// segments without pulling the full database stack into this smoke test.
const segments = [];
const realTimeProcessor = {
  async handleAttributedSegment(segment) {
    segments.push(segment);
    const ts = new Date(segment.start_ms).toISOString().slice(11, 19);
    const speaker = String(segment.speaker || 'Unknown').padEnd(20);
    const text = String(segment.text || '').slice(0, 140);
    console.log(`[${ts}] ${speaker} :: ${text}`);
  },
};

const meetingDir = path.join('/tmp', 'msteams_test', String(Date.now()));
fs.mkdirSync(meetingDir, { recursive: true });
console.log(' meeting_dir :', meetingDir);
console.log('');

let abortRequested = false;
process.on('SIGINT', () => {
  if (abortRequested) process.exit(130);
  abortRequested = true;
  console.log('\n[harness] SIGINT received — bot will leave the meeting cleanly. Press Ctrl+C again to force-quit.');
});

(async () => {
  const result = await joinMeeting(
    meetingUrl,
    { name: botName },
    {
      realTimeProcessor,
      meetingDbId: 'smoke-test',
      meetingDir,
      // Cap to 10 minutes for a quick smoke; remove for real meetings.
      maxMeetingMs: parseInt(process.env.MSTEAMS_MAX_MEETING_MS || '600000', 10),
    }
  );

  console.log('\n--------------------------------------------------------------------');
  console.log(' Result');
  console.log('--------------------------------------------------------------------');
  console.log(' success         :', result.success);
  if (!result.success) console.log(' error           :', result.error);
  console.log(' segments        :', segments.length);
  console.log(' segments_path   :', result.segmentsPath);
  console.log(' meeting_dir     :', result.meetingDir);
  console.log(' exit_reason     :', JSON.stringify(result.exitReason || null));
  console.log('');
  console.log(' Timing (per step):');
  for (const span of (result.timing?.spans || [])) {
    const tag = span.over_budget ? '[OVER]' : '[ok]  ';
    const budget = span.budget_ms != null ? `/${span.budget_ms}ms` : '';
    console.log(`   ${tag} ${span.label.padEnd(20)} ${String(span.elapsed_ms).padStart(5)}ms${budget.padStart(8)}  @+${span.since_start_ms}ms`);
  }
  console.log(`   total_ms = ${result.timing?.total_ms}`);
  console.log('--------------------------------------------------------------------');

  process.exit(result.success ? 0 : 1);
})().catch((err) => {
  console.error('[harness] fatal:', err);
  process.exit(1);
});
