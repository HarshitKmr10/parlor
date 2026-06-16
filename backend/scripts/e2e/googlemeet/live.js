#!/usr/bin/env node
'use strict';

// Live end-to-end driver for the Google Meet bot.
//
// Calls bot_scripts/googlemeet/joinMeeting.joinMeeting() the same way
// platformRouter does, captures health stats every 5s, dumps a report
// at scripts/e2e/googlemeet/out/<ts>/.
//
// Usage:
//   node scripts/e2e/googlemeet/live.js <meetUrl>
//                                       [--bot-name "AIOps Bot"]
//                                       [--seconds 90]
//
// What it validates:
//   - Browser launch + stealth init
//   - Meet join + admission flow
//   - Roster watcher (DOM tile observer feeds Node)
//   - Per-peer audio capture (frames flow into the bridge)
//   - Aloneness watcher with useHistory: true
//   - Graceful leave + browser teardown
//
// What it does NOT validate (without AWS creds):
//   - Actual transcript text (PerParticipantStreamPool will spawn
//     sessions but AwsCsrcTranscribeAdapter.connect() will error;
//     the bridge keeps the rest of the pipeline running).

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '..', '.env') });

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = {
    url: null, botName: 'AIOps Bot', seconds: 90,
    captureMode: process.env.GOOGLEMEET_TRANSCRIPT_SOURCE || 'audio_asr',
    out: process.env.LIVE_OUT_DIR || null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--bot-name') { args.botName = argv[++i]; continue; }
    if (a === '--seconds') { args.seconds = parseInt(argv[++i], 10); continue; }
    if (a === '--mode' || a === '--capture-mode') { args.captureMode = argv[++i]; continue; }
    if (a === '--out') { args.out = argv[++i]; continue; }
    if (!args.url && a.startsWith('http')) { args.url = a; continue; }
  }
  if (!args.url) {
    console.error('Usage: live.js <meetUrl> [--bot-name N] [--seconds S] [--mode audio_asr|gmeet_captions] [--out DIR]');
    process.exit(2);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  // --out / LIVE_OUT_DIR overrides the in-tree default. Required when
  // the script lives on a read-only bind-mount (the local-docker test
  // harness mounts scripts:ro), and convenient in any setup where the
  // caller wants artifacts collected somewhere predictable.
  const outDir = args.out
    ? path.join(args.out, ts)
    : path.join(__dirname, 'out', ts);
  fs.mkdirSync(outDir, { recursive: true });

  console.log('[e2e] meeting :', args.url);
  console.log('[e2e] bot name:', args.botName);
  console.log('[e2e] duration:', args.seconds, 's (auto-stop after this)');
  console.log('[e2e] mode    :', args.captureMode);
  console.log('[e2e] out dir :', outDir);
  console.log('[e2e] AWS creds:', process.env.AWS_ACCESS_KEY_ID ? 'present' : 'MISSING (audio mode would skip transcripts)');

  const { joinMeeting } = require(path.join(
    '..', '..', '..', 'src', 'bot', 'bot_scripts', 'googlemeet', 'joinMeeting',
  ));

  // Auto-stop hook: trigger the bot's aloneness path indirectly by
  // closing its browser. We don't have a public stop API yet — but the
  // joinMeeting function returns once aloneness fires OR the meeting
  // ends. So for a fixed-duration run we time out the whole call.
  const timeoutHandle = setTimeout(() => {
    console.log('\n[e2e] duration reached, exiting via process.exit (bot will leave on the way down)');
    process.exit(0);
  }, args.seconds * 1_000);
  if (timeoutHandle.unref) timeoutHandle.unref();

  console.log('[e2e] starting bot — please admit it from the host side');
  const result = await joinMeeting(args.url, { name: args.botName }, {
    botName: args.botName,
    savePath: outDir,
    captureMode: args.captureMode,
    onRecordingStarted: () => console.log('[e2e] recording started'),
  });

  clearTimeout(timeoutHandle);

  fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2));
  console.log('\n──────── live e2e summary ────────');
  console.log('status         :', result.status);
  console.log('reason         :', result.reason);
  console.log('duration_s     :', result.duration?.toFixed?.(1));
  console.log('segments       :', result.segmentsCount);
  console.log('participants   :', JSON.stringify(result.participants));
  console.log('everSawHumans  :', result.everSawHumans);
  console.log('health         :', JSON.stringify(result.healthStatus));
  console.log('artifacts      :', outDir);
  console.log('──────────────────────────────────\n');
}

main().catch((err) => {
  console.error('[e2e] fatal:', err);
  process.exit(1);
});
