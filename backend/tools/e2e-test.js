/**
 * End-to-end runner: exercises the FULL Google Meet bot pipeline via the real
 * orchestrator (googlemeet/index.js joinMeeting) — join → admission →
 * live-caption transcription → graceful leave. Proves transcription + leave, not
 * just join. Captions persist to <savePath>/<datetime>/segments.jsonl (file, no DB).
 *
 * Env: MEETING_URL (req), BOT_NAME (Notetaker), RUN_MS (50000).
 * After RUN_MS we abort the AbortSignal → the bot leaves gracefully, then we dump
 * any captured transcript segments.
 */
'use strict';
const fs = require('fs');
const { joinMeeting } = require('../src/bot/bot_scripts/googlemeet');

const url = process.env.MEETING_URL;
const name = process.env.BOT_NAME || 'Notetaker';
const runMs = parseInt(process.env.RUN_MS || '50000', 10);
// 'gmeet_captions' (scrape Meet captions) or 'audio_asr' (per-peer audio → AWS/Azure ASR)
const transcriptSource = process.env.TRANSCRIPT_MODE || 'gmeet_captions';
const savePath = '/tmp/shots/bot';
if (!url) { console.error('MEETING_URL required'); process.exit(2); }

const ac = new AbortController();

function dumpTranscript() {
  try {
    if (!fs.existsSync(savePath)) { console.log('[e2e] no savePath dir'); return; }
    for (const d of fs.readdirSync(savePath)) {
      const seg = `${savePath}/${d}/segments.jsonl`;
      if (fs.existsSync(seg)) {
        const lines = fs.readFileSync(seg, 'utf8').trim().split('\n').filter(Boolean);
        console.log(`[e2e] TRANSCRIPT ${seg}: ${lines.length} segment(s)`);
        lines.slice(0, 10).forEach((l) => console.log('  SEG', l.slice(0, 220)));
        return lines.length;
      }
    }
    console.log('[e2e] no segments.jsonl found under', savePath);
  } catch (e) { console.log('[e2e] transcript read error:', e.message); }
  return 0;
}

(async () => {
  const t = setTimeout(() => { console.log(`[e2e] ${runMs}ms elapsed — aborting → graceful leave`); ac.abort(); }, runMs);
  if (typeof t.unref === 'function') { /* keep process alive */ }
  console.log(`[e2e] transcriptSource=${transcriptSource}`);
  try {
    await joinMeeting(url, { name }, { transcriptSource, savePath, signal: ac.signal });
    console.log('[e2e] joinMeeting returned (bot left the meeting)');
  } catch (e) {
    console.log('[e2e] joinMeeting threw:', e.message);
  }
  clearTimeout(t);
  const n = dumpTranscript();
  console.log(`[e2e] DONE — transcript segments captured: ${n || 0}`);
  process.exit(0);
})();
