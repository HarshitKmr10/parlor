#!/usr/bin/env node
'use strict';

// Phase 0 probe — measures which WebRTC architecture Google Meet uses,
// so we can pick between three Phase 2 implementation paths:
//
//   2A  per-peer audio receivers   — bind each receiver to a participant
//   2B  one mixed track + CSRC     — port the Teams CSRC pipeline
//   2C  one mixed track, no CSRC   — degenerate to single-stream + DOM
//
// Usage:
//   node scripts/probe/googlemeet/probe.js <meetUrl> [--bot-name "Probe Bot"]
//                                                    [--seconds 90]
//                                                    [--admit-timeout 180]
//
// Drops a JSON report at scripts/probe/googlemeet/out/<ts>/probe.json
// plus a one-page console summary classifying the architecture.

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '..', '.env') });

const fs = require('fs');
const path = require('path');

const { launchBrowser, closeBrowser, takeScreenshot } = require(
  path.join('..', '..', '..', 'src', 'bot', 'bot_scripts', 'googlemeet', 'browser'),
);
const { joinGoogleMeetMeeting } = require(
  path.join('..', '..', '..', 'src', 'bot', 'bot_scripts', 'googlemeet', 'join'),
);
const { waitForAdmission } = require(
  path.join('..', '..', '..', 'src', 'bot', 'bot_scripts', 'googlemeet', 'admission'),
);
const { SCRIPT: PROBE_SCRIPT } = require('./probeScript');

function parseArgs(argv) {
  const args = { url: null, botName: 'Probe Bot', seconds: 90, admitTimeout: 180 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--bot-name') { args.botName = argv[++i]; continue; }
    if (a === '--seconds') { args.seconds = parseInt(argv[++i], 10); continue; }
    if (a === '--admit-timeout') { args.admitTimeout = parseInt(argv[++i], 10); continue; }
    if (!args.url && a.startsWith('http')) { args.url = a; continue; }
  }
  if (!args.url) {
    console.error('Usage: probe.js <meetUrl> [--bot-name N] [--seconds S] [--admit-timeout S]');
    process.exit(2);
  }
  return args;
}

function summarize(samples) {
  // samples[i] = { ts, pcCount, audioReceiverCount, receivers, domSpeakers, tiles }
  if (samples.length === 0) {
    return { verdict: 'no-samples', detail: 'No snapshots captured.' };
  }

  const last = samples[samples.length - 1];

  // Receiver count distribution.
  const recvCounts = samples.map((s) => s.audioReceiverCount);
  const recvMin = Math.min(...recvCounts);
  const recvMax = Math.max(...recvCounts);
  const recvMode = recvCounts.sort((a, b) => a - b)[Math.floor(recvCounts.length / 2)];

  // CSRC firing across all samples.
  let totalCsrcReadings = 0;
  let totalCsrcWithSources = 0;
  const csrcSourceIds = new Set();
  const csrcByReceiver = new Map(); // trackId -> Set<source>
  for (const s of samples) {
    for (const r of s.receivers) {
      totalCsrcReadings += 1;
      if (r.csrcs.length > 0) {
        totalCsrcWithSources += 1;
        for (const c of r.csrcs) {
          csrcSourceIds.add(c.source);
          if (!csrcByReceiver.has(r.trackId)) csrcByReceiver.set(r.trackId, new Set());
          csrcByReceiver.get(r.trackId).add(c.source);
        }
      }
    }
  }

  // SSRC stability: a per-peer architecture has one stable SSRC per track.
  const ssrcByReceiver = new Map();
  for (const s of samples) {
    for (const r of s.receivers) {
      if (!ssrcByReceiver.has(r.trackId)) ssrcByReceiver.set(r.trackId, new Set());
      for (const ss of r.ssrcs) ssrcByReceiver.get(r.trackId).add(ss.source);
    }
  }

  // DOM speaker class observations.
  let domSpeakerSamples = 0;
  const domSpeakerNames = new Set();
  for (const s of samples) {
    if (s.domSpeakers && s.domSpeakers.length > 0) {
      domSpeakerSamples += 1;
      for (const d of s.domSpeakers) if (d.name) domSpeakerNames.add(d.name);
    }
  }

  // Tile count (excluding bot self) — rough participant count.
  const lastTileCount = (last.tiles || []).length;

  // Verdict logic.
  let verdict;
  let detail;
  if (recvMode >= 2 && totalCsrcWithSources === 0) {
    verdict = '2A_per_peer_or_mixed_no_csrc';
    detail = `Receivers stable at ${recvMode} but zero CSRC firing. Likely per-peer ` +
      'tracks (each receiver is one participant) — confirm by binding trackIds to ' +
      'tile names.';
  } else if (recvMode === 1 && totalCsrcWithSources > 0) {
    verdict = '2B_mixed_plus_csrc';
    detail = `One mixed audio receiver + ${csrcSourceIds.size} distinct CSRC source IDs ` +
      'firing. Port the Teams CSRC pipeline.';
  } else if (recvMode === 1 && totalCsrcWithSources === 0) {
    verdict = '2C_mixed_no_csrc';
    detail = 'One mixed audio receiver with no CSRC — degenerate to single-stream + ' +
      'DOM-class active-speaker fallback.';
  } else if (recvMode >= 2 && totalCsrcWithSources > 0) {
    verdict = 'hybrid';
    detail = 'Multiple receivers AND CSRC firing — unusual; inspect per-receiver csrc ' +
      'columns to decide.';
  } else {
    verdict = 'inconclusive';
    detail = 'Did not collect enough signal; rerun with more participants speaking.';
  }

  return {
    verdict,
    detail,
    samples: samples.length,
    receiverCount: { min: recvMin, max: recvMax, mode: recvMode },
    csrcReadings: totalCsrcReadings,
    csrcReadingsWithSources: totalCsrcWithSources,
    distinctCsrcSourceIds: csrcSourceIds.size,
    csrcSourcesPerReceiver: Array.from(csrcByReceiver.entries()).map(([trackId, set]) => ({
      trackId, distinctSources: set.size,
    })),
    ssrcsPerReceiver: Array.from(ssrcByReceiver.entries()).map(([trackId, set]) => ({
      trackId, distinctSsrcs: set.size,
    })),
    domSpeakerSamples,
    distinctDomSpeakerNames: Array.from(domSpeakerNames),
    lastTileCount,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(__dirname, 'out', ts);
  fs.mkdirSync(outDir, { recursive: true });

  console.log('[probe] meeting:', args.url);
  console.log('[probe] bot name:', args.botName);
  console.log('[probe] sample seconds:', args.seconds);
  console.log('[probe] out dir:', outDir);

  const { browser, context, page } = await launchBrowser({ headless: false });

  // Inject probe BEFORE navigation so the RTCPeerConnection hook is in
  // place by the time Meet creates its first PC.
  await context.addInitScript(PROBE_SCRIPT);

  // Page console → node logs.
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('[gmeet.probe]')) console.log('[page]', text);
  });

  let admitted = false;
  try {
    await joinGoogleMeetMeeting(page, args.url, args.botName, {
      screenshotPath: outDir,
      takeScreenshots: true,
    });

    console.log(`[probe] join requested — please admit "${args.botName}" from the host side`);
    console.log(`[probe] waiting up to ${args.admitTimeout}s for admission`);
    await waitForAdmission(page, args.admitTimeout * 1000, { screenshotPath: outDir });
    admitted = true;
  } catch (err) {
    console.error('[probe] join/admission failed:', err.message);
    await takeScreenshot(page, outDir, 'join_failed').catch(() => {});
    fs.writeFileSync(
      path.join(outDir, 'probe.json'),
      JSON.stringify({ error: err.message, admitted: false, args }, null, 2),
    );
    await closeBrowser(browser);
    process.exit(1);
  }

  console.log('[probe] admitted — sampling for', args.seconds, 'seconds');

  // Take a short pause so Meet has finished negotiating tracks before we
  // start sampling. CSRC takes a few hundred ms to begin firing.
  await page.waitForTimeout(3000);

  const samples = [];
  const start = Date.now();
  let i = 0;
  while ((Date.now() - start) / 1000 < args.seconds) {
    const sample = await page.evaluate(() => {
      if (!window.__probe) return null;
      return {
        ...window.__probe.snapshot(),
        domSpeakers: window.__probe.domSpeakers(),
        tiles: window.__probe.participantTiles(),
      };
    }).catch((e) => ({ error: e.message }));

    if (sample && !sample.error) {
      samples.push(sample);
      // Periodic stdout so we can watch live.
      if (i % 5 === 0) {
        const csrcFiring = sample.receivers.reduce((n, r) => n + r.csrcs.length, 0);
        const dom = (sample.domSpeakers || []).map((d) => d.name).filter(Boolean);
        console.log(
          `[probe] t=${((Date.now() - start) / 1000).toFixed(1)}s ` +
          `pcs=${sample.pcCount} audioRecvs=${sample.audioReceiverCount} ` +
          `csrcs_firing=${csrcFiring} tiles=${(sample.tiles || []).length} ` +
          `domSpeaking=[${dom.join(', ')}]`,
        );
      }
    }
    i += 1;
    await page.waitForTimeout(1000);
  }

  await takeScreenshot(page, outDir, 'final').catch(() => {});

  const summary = summarize(samples);
  const report = { args, admitted, samples, summary };
  fs.writeFileSync(path.join(outDir, 'probe.json'), JSON.stringify(report, null, 2));

  console.log('\n──────── probe summary ────────');
  console.log('verdict        :', summary.verdict);
  console.log('detail         :', summary.detail);
  console.log('samples        :', summary.samples);
  console.log('receivers      :', `min=${summary.receiverCount.min} max=${summary.receiverCount.max} mode=${summary.receiverCount.mode}`);
  console.log('csrc readings  :', `${summary.csrcReadingsWithSources}/${summary.csrcReadings} had sources`);
  console.log('distinct csrcs :', summary.distinctCsrcSourceIds);
  console.log('dom speakers   :', summary.distinctDomSpeakerNames.join(', ') || '(none)');
  console.log('tile count     :', summary.lastTileCount);
  console.log('full report    :', path.join(outDir, 'probe.json'));
  console.log('───────────────────────────────\n');

  await closeBrowser(browser);
}

main().catch((err) => {
  console.error('[probe] fatal:', err);
  process.exit(1);
});
