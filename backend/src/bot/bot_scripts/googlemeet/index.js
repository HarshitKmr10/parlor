'use strict';

// Google Meet bot — orchestrates join → admission → per-peer capture →
// streaming transcription → graceful exit. Architecture verified during
// the Phase 0 probe (Branch 2A, per-peer audio): each remote participant
// has its own RTCRtpReceiver, no CSRC routing required.
//
// Wires together:
//   - browser.js / join.js / admission.js / leave.js  (existing scaffolding)
//   - rosterWatcher.js + rosterObserverScript.js      (DOM tile watcher)
//   - perPeerCaptureScript.js                          (in-page audio tap)
//   - captureBridge.js                                 (Node-side ASR pool)
//   - shared/aloneness.js                              (graceful exit on solo)
//
// Persistence path matches Teams: segments → dbIntegration.appendTranscriptSegment
// against the meeting_joiner row's transcript.content array, which is
// what GET /meetings/transcripts reads.

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const { launchBrowser, closeBrowser, takeScreenshot } = require('./browser');
const { joinGoogleMeetMeeting } = require('./join');
const { waitForAdmission, checkMeetingStatus } = require('./admission');
const { leaveGoogleMeet, prepareForLeave, forceLeave } = require('./leave');
const { RosterWatcher } = require('./rosterWatcher');
const { CaptureBridge } = require('./captureBridge');
const { SCRIPT: ROSTER_OBSERVER_SCRIPT } = require('./rosterObserverScript');
const { SCRIPT: PER_PEER_CAPTURE_SCRIPT } = require('./perPeerCaptureScript');
const { SCRIPT: CAPTIONS_SCRAPER_SCRIPT } = require('./captionsScraperScript');
const { enableLiveCaptions } = require('./captions');
const { TRANSCRIPT_SOURCE, normalizeTranscriptSource } = require('./transcriptSource');
const { watchAloneness } = require('../shared/aloneness');

let dbIntegration = null;
try { dbIntegration = require('../../../storage/dbIntegration'); }
catch (_) { dbIntegration = null; }

let logger;
try { logger = require('../../../shared/logger'); }
catch (_) { logger = console; }

// Process-local registry of active bots, keyed by meetingDbId. Used by
// stopMeeting(meetingDbId) so the worker layer can request a graceful
// shutdown without holding a direct reference to the AbortController.
// Pods run a single bot today; if that ever changes, replace the Map
// with an LRU.
const _ACTIVE = new Map();

// Verifies the bot's mic is muted post-admission. Pre-admission mute
// (in join.js) runs on the lobby preview button; Meet sometimes
// re-enables the mic on the lobby→call transition. We retry up to
// MAX_MUTE_ATTEMPTS times: each attempt looks for a visible
// "Turn off microphone" button (aria says OFF only when the mic is
// currently ON), clicks it, and waits for the aria-label to flip to
// "Turn on microphone" (which appears only when the mic is OFF).
async function ensureMuted(page, logger) {
  const log = logger || console;
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const state = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button[aria-label]'));
      let turnOffBtn = null;
      let turnOnVisible = false;
      for (const b of buttons) {
        if (b.offsetParent === null) continue;
        const aria = (b.getAttribute('aria-label') || '').toLowerCase();
        if (/turn off (the |your )?microphone/i.test(aria)) turnOffBtn = b;
        else if (/turn on (the |your )?microphone/i.test(aria)) turnOnVisible = true;
      }
      if (turnOnVisible && !turnOffBtn) return { state: 'already_muted' };
      if (turnOffBtn) {
        turnOffBtn.click();
        return { state: 'clicked', aria: turnOffBtn.getAttribute('aria-label') };
      }
      return { state: 'no_button' };
    }).catch((e) => ({ state: 'error', err: e?.message }));

    if (state.state === 'already_muted') {
      log.info?.('[gmeet.mute] mic already muted post-admission');
      return true;
    }
    if (state.state === 'clicked') {
      log.info?.('[gmeet.mute] clicked mute (' + state.aria + '), verifying…');
      // Give Meet ~500 ms to flip the button's aria-label.
      await new Promise((r) => setTimeout(r, 500));
      const verified = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button[aria-label]'));
        for (const b of buttons) {
          if (b.offsetParent === null) continue;
          const aria = (b.getAttribute('aria-label') || '').toLowerCase();
          if (/turn on (the |your )?microphone/i.test(aria)) return true;
        }
        return false;
      }).catch(() => false);
      if (verified) {
        log.info?.('[gmeet.mute] verified muted');
        return true;
      }
      log.warn?.('[gmeet.mute] click registered but aria-label did not flip; retrying');
    } else if (state.state === 'no_button') {
      log.warn?.('[gmeet.mute] no microphone button visible (attempt ' + attempt + ')');
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  // Last-resort: keyboard shortcut (Ctrl+D / Cmd+D toggles mic in Meet).
  try {
    await page.bringToFront().catch(() => {});
    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+d' : 'Control+d');
    log.info?.('[gmeet.mute] sent ' + (isMac ? 'Cmd' : 'Ctrl') + '+D shortcut');
    await new Promise((r) => setTimeout(r, 500));
  } catch (_) { /* ignore */ }
  log.warn?.('[gmeet.mute] could not verify mute after ' + MAX_ATTEMPTS + ' attempts');
  return false;
}

// One-shot health monitor mirrored from the prior PulseAudio scaffold so
// the existing /health surfaces keep working without code changes.
class BotHealthMonitor {
  constructor() {
    this.startTime = Date.now();
    this.lastSegmentTs = null;
    this.segmentCount = 0;
    this.participantCount = 0;
    this.errors = [];
  }
  recordSegment() { this.lastSegmentTs = Date.now(); this.segmentCount += 1; }
  recordParticipantCount(n) { this.participantCount = n; }
  recordError(err) { this.errors.push({ ts: Date.now(), message: err?.message || String(err) }); }
  getStatus() {
    return {
      uptime: Date.now() - this.startTime,
      lastSegmentTs: this.lastSegmentTs,
      segmentCount: this.segmentCount,
      participantCount: this.participantCount,
      errorCount: this.errors.length,
      recentErrors: this.errors.slice(-5),
    };
  }
}

async function joinMeeting(meetingUrl, credentials = {}, options = {}) {
  const botName = credentials.name || options.botName || 'Meeting Bot';
  const meetingDbId = options.meetingDbId || null;
  const realTimeProcessor = options.realTimeProcessor || null;
  // RCA #38: tag every segment with session_number + wall_clock_ts so the
  // transcript can be stitched across rejoin sessions. msteams/joinMeeting.js
  // got this in the PR; the gmeet entry was missed.
  const sessionNumber = Number(
    process.env.SESSION_NUMBER || options.sessionNumber || 1
  );
  // Transcript source: 'audio_asr' (per-peer audio → AWS/Azure
  // streaming) or 'gmeet_captions' (scrape Meet's live captions, no
  // ASR cost). Mirrors Teams' MSTEAMS_TRANSCRIPT_SOURCE. Per-call
  // selection via options.transcriptSource (primary, matches Teams);
  // options.captureMode kept as a deprecated alias.
  const transcriptSource = normalizeTranscriptSource(options.transcriptSource || options.captureMode);
  // Signed-in (authenticated) join support. The storageState path may be passed
  // explicitly by the launcher (options.googleAuthStatePath) or resolved from
  // GOOGLE_AUTH_STATE_PATH inside browser.js. `authenticated` is the caller's
  // hint (the launcher knows whether it resolved a file); browser.js returns
  // the authoritative value after confirming the file exists.
  const googleAuthStatePath = options.googleAuthStatePath || process.env.GOOGLE_AUTH_STATE_PATH || null;
  const authRequested = options.authenticated !== undefined
    ? !!options.authenticated
    : (process.env.GOOGLE_MEET_USE_AUTH === 'true');
  // Internal mode flag — kept as a separate name so the rest of the
  // function reads naturally ('audio' / 'captions' is more readable
  // than the longer enum at every branch).
  const isCaptionsMode = transcriptSource === TRANSCRIPT_SOURCE.GMEET_CAPTIONS;
  const datetime = Date.now().toString();
  const savePath = options.savePath
    ? path.resolve(options.savePath, datetime)
    : path.resolve(path.join(__dirname, 'meeting_data'), datetime);
  fs.mkdirSync(savePath, { recursive: true });

  const meetingStartMs = Date.now();
  const segmentsPath = path.join(savePath, 'segments.jsonl');
  const segments = [];
  let segmentNumber = 0;
  let everSawHumans = false;
  // True only once a REAL connection is confirmed (roster has a human, or
  // audio frames flowed) and the meeting is flipped to `ongoing`. Used by the
  // catch handler to decide whether a thrown error is a failed-to-join (→ mark
  // the meeting `failed`) vs. a mid-meeting error after a genuine join.
  let joinConfirmed = false;
  let stopFlag = { stopped: false, reason: null };
  // Internal abort controller used to wake the run loop. The caller can
  // also pass `options.signal` (an AbortSignal) — when that fires, we
  // forward to the internal abort and tag stopFlag with reason
  // 'external_stop' so the bot leaves gracefully (clicks the leave
  // button, drains AWS sessions, closes browser) instead of being SIGKILL'd.
  const abortController = new AbortController();
  if (options.signal && typeof options.signal.addEventListener === 'function') {
    if (options.signal.aborted) {
      stopFlag = { stopped: true, reason: 'external_stop' };
      abortController.abort();
    } else {
      options.signal.addEventListener('abort', () => {
        if (stopFlag.stopped) return;
        stopFlag = { stopped: true, reason: 'external_stop' };
        abortController.abort();
      }, { once: true });
    }
  }
  // Track active joinMeeting calls so stopMeeting(meetingDbId) can find
  // and abort them. This is a process-local registry — fine for the
  // single-bot-per-pod model. If we ever go multi-bot per pod, swap the
  // map for an LRU keyed by meetingDbId.
  if (meetingDbId) _ACTIVE.set(meetingDbId, abortController);
  // Hard wall-clock cap. Mirrors Teams' MSTEAMS_MAX_MEETING_MS so a
  // bot doesn't pin a worker pod indefinitely on a meeting that
  // genuinely runs forever (e.g. a forgotten-open call or a 24/7
  // war-room). Default 8 h covers all-day workshops + leadership
  // reviews; override via GOOGLEMEET_MAX_MEETING_MS.
  const maxMeetingMs = parseInt(process.env.GOOGLEMEET_MAX_MEETING_MS || '28800000', 10); // 8h
  const maxMeetingTimer = setTimeout(() => {
    if (stopFlag.stopped) return;
    stopFlag = { stopped: true, reason: 'max_meeting_time' };
    logger.info?.('[gmeet.bot] max meeting time reached', { maxMeetingMs });
    abortController.abort();
  }, maxMeetingMs);
  if (typeof maxMeetingTimer.unref === 'function') maxMeetingTimer.unref();
  const healthMonitor = new BotHealthMonitor();

  logger.info?.(`[gmeet.bot] starting`, { meetingUrl, botName, meetingDbId, savePath, transcriptSource });

  let browser = null;
  let context = null;
  let page = null;
  let bridge = null;
  let alonenessPromise = Promise.resolve();

  try {
    const browserResult = await launchBrowser({
      storageStatePath: googleAuthStatePath,
      useAuth: authRequested,
    });
    browser = browserResult.browser;
    context = browserResult.context;
    page = browserResult.page;
    // browser.js returns the authoritative flag (true only when a storageState
    // file actually existed and was attached). Anonymous guest otherwise.
    const authenticated = !!browserResult.authenticated;
    logger.info?.('[gmeet.bot] auth mode', { authenticated, googleAuthStatePath });

    const roster = new RosterWatcher({ logger, botName });
    bridge = new CaptureBridge({
      logger,
      rosterWatcher: roster,
      botName,
      meetingStartMs,
      onSegment: async (segment) => {
        if (!segment) return;
        // Drop explicit partials — final segments are the ones we persist.
        // (PerParticipantStreamPool emits both; only kind === 'final' is
        // billable text.)
        if (segment.kind === 'partial') return;
        healthMonitor.recordSegment();
        segments.push(segment);
        await fsp.appendFile(segmentsPath, JSON.stringify(segment) + '\n').catch(() => {});

        if (dbIntegration && meetingDbId) {
          segmentNumber += 1;
          const startSec = Math.max(0, ((Number(segment.start_ms) || 0) - meetingStartMs) / 1000);
          const endSec = Math.max(startSec, ((Number(segment.end_ms) || 0) - meetingStartMs) / 1000);
          const wallClockTs = new Date().toISOString();
          const segmentData = {
            timestamp: wallClockTs,
            speaker: segment.speaker || 'Unknown',
            text: segment.text || '',
            startTime: startSec,
            endTime: endSec,
            confidence: null,
            chunk: segment.id,
            segmentNumber,
            isRealTime: true,
            // RCA #38: session tagging for cross-rejoin transcript stitching.
            session_number: sessionNumber,
            wall_clock_ts: wallClockTs,
            originalChunkData: {
              audioPath: null,
              chunkDuration: endSec - startSec,
            },
            meta: {
              participant_id: segment.diarization?.participant_id || null,
              language: segment.language,
              provider: segment.provider,
              kind: segment.kind,
              attribution_confidence: segment.attribution_confidence ?? null,
              platform: 'googlemeet',
            },
          };
          logger.info?.('[gmeet.bridge] persist', {
            n: segmentNumber, speaker: segmentData.speaker,
            attribution: segment.attribution_confidence, text_len: (segmentData.text || '').length,
            session: sessionNumber,
          });
          try {
            if (typeof dbIntegration.appendTranscriptSegmentWithSession === 'function') {
              await dbIntegration.appendTranscriptSegmentWithSession(meetingDbId, segmentData, {
                sessionNumber,
                wallClockTs,
              });
            } else {
              await dbIntegration.appendTranscriptSegment(meetingDbId, segmentData);
            }
          }
          catch (e) { logger.warn?.('[gmeet.bridge] dbIntegration append failed', e?.message); }
        }

        // Forward to legacy realTimeProcessor for any consumers that
        // hook in via that interface (forward-compat with Teams).
        if (realTimeProcessor && typeof realTimeProcessor.handleAttributedSegment === 'function') {
          try { await realTimeProcessor.handleAttributedSegment(segment); }
          catch (e) { logger.warn?.('[gmeet.bridge] processor handoff failed', e?.message); }
        }
      },
    });

    // Inject the in-page scripts BEFORE navigation. Roster observer
    // always runs (used for aloneness + speaker attribution in both
    // modes). The audio path also needs the per-peer WebRTC hook;
    // captions mode needs the caption scraper instead. We never run
    // both audio + captions at once in v1 — the user picks one mode
    // and the bot avoids spinning up resources for the other.
    await context.addInitScript(ROSTER_OBSERVER_SCRIPT);
    if (!isCaptionsMode) {
      await context.addInitScript(PER_PEER_CAPTURE_SCRIPT);
    } else {
      await context.addInitScript(CAPTIONS_SCRAPER_SCRIPT);
    }

    await roster.expose(page);
    await bridge.expose(page);
    // The AWS / Azure pool is only worth spinning up when audio frames
    // are flowing into the bridge. Captions mode skips it entirely —
    // saves the connection cost + the per-pid session minutes.
    if (!isCaptionsMode) bridge.start();

    // Live participants → DB (mirrors Teams). Throttled by content key
    // inside the watcher so this fires once per name-set change.
    if (dbIntegration && meetingDbId) {
      roster.setOnChange(async ({ list }) => {
        const botLower = String(botName || '').toLowerCase();
        const participants = list
          .filter((p) => p?.name)
          .filter((p) => !/bot/i.test(p.name) && p.name.toLowerCase() !== botLower)
          .map((p) => ({
            name: p.name,
            joinedAt: new Date().toISOString(),
            isPresent: true,
            source: 'roster_live',
          }));
        healthMonitor.recordParticipantCount(participants.length);
        if (participants.length > 0) everSawHumans = true;
        try { await dbIntegration.updateParticipants(meetingDbId, participants); }
        catch (err) { logger.warn?.('[gmeet.roster] participants update failed', err?.message); }
      });
    } else {
      roster.setOnChange(({ list }) => {
        const others = (list || []).filter((p) => p?.name && p.name.toLowerCase() !== botName.toLowerCase());
        healthMonitor.recordParticipantCount(others.length);
        if (others.length > 0) everSawHumans = true;
      });
    }

    await joinGoogleMeetMeeting(page, meetingUrl, botName, {
      screenshotPath: savePath,
      takeScreenshots: true,
      authenticated,
    });

    const admissionTimeout = parseInt(process.env.GOOGLE_MEET_ADMISSION_TIMEOUT_MS || '120000', 10);
    await waitForAdmission(page, admissionTimeout, { screenshotPath: savePath });

    // ---- Admission VERIFICATION gate (parity with the Teams bot) --------
    // waitForAdmission() detects the in-call control shell (hang-up button,
    // captions toggle, etc.). But Google renders that same shell in the
    // rejected / limbo state, so a button alone is NOT proof we truly joined
    // — a rejected bot would otherwise be flipped to `ongoing`, sit alone for
    // the full 20-min startup-alone window, and be mislabeled. The Teams bot
    // avoids this by also requiring a WebRTC track signal; we do the
    // equivalent here using signals the gmeet bot already tracks: a non-bot
    // participant in the roster (`everSawHumans`) or inbound audio frames.
    // A genuinely-admitted bot always has a host present, so this resolves in
    // a couple of seconds for real meetings; only false/limbo admissions burn
    // the full window.
    const joinVerifyMs = parseInt(process.env.GOOGLE_MEET_JOIN_VERIFY_MS || '75000', 10);
    {
      const verifyDeadline = Date.now() + joinVerifyMs;
      while (Date.now() < verifyDeadline && !abortController.signal.aborted) {
        const framesIn = bridge?.stats?.framesIn || 0;
        // Captions mode has NO audio frames (bridge.start() is skipped), so it
        // must also accept "captions started flowing" as proof of a real join
        // — otherwise a slow/flaky roster read could falsely fail a meeting the
        // bot genuinely joined. (gmeet_captions is the default mode.)
        const captionsPublished = bridge?.stats?.captionsPublished || 0;
        if (everSawHumans || framesIn > 0 || (isCaptionsMode && captionsPublished > 0)) {
          joinConfirmed = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
    if (!joinConfirmed) {
      // No roster, no audio after the grace window → the "admission" was a
      // rejected/limbo false positive. Bail and let the catch handler mark
      // the meeting `failed` with a precise reason.
      throw new Error('admission_unverified: bot never connected (no roster, no audio frames) — rejected or limbo');
    }

    // Notify caller that we're recording (parity with Teams).
    if (typeof options.onRecordingStarted === 'function') {
      try { options.onRecordingStarted(); } catch (_) { /* ignore */ }
    }

    await takeScreenshot(page, savePath, 'admitted').catch(() => {});

    // Verified-admitted → flip the meeting to `ongoing` and stamp
    // bot_join_time. Without this the meeting is stuck in `joining` and the
    // dashboard never shows it as live (the old PGQueuer bridge did this; the
    // warm-pool/sidecar path does not). Non-fatal.
    if (dbIntegration && meetingDbId) {
      try { await dbIntegration.markMeetingJoined(meetingDbId); }
      catch (e) { logger.warn?.('[gmeet.bot] markMeetingJoined failed', e?.message); }
    }

    // Post-admission mic mute. The pre-admission mute happens in the
    // lobby preview, but Meet sometimes re-enables the mic on
    // transition into the call (especially when the lobby preview
    // briefly switches focus). Without this, the bot can join with
    // mic ON — its own audio gets picked up as captions stamped
    // "You", and worse, broadcasts whatever's near the bot's
    // microphone. Verified-loop: click "Turn off microphone" if
    // visible, re-check, retry up to 3x.
    await ensureMuted(page, logger);

    // Prepare in-page leave function once the toolbar is mounted so
    // graceful exit doesn't depend on selector race conditions later.
    await prepareForLeave(page).catch((e) => {
      logger.warn?.('[gmeet.leave] prepare failed', e?.message);
    });

    // Captions mode: enable Meet's live captions. Done AFTER admission
    // because the captions toolbar button only renders inside the call.
    // Failure here isn't fatal — the in-page scraper will start
    // emitting the moment captions appear, even if the user enabled
    // them manually later.
    if (isCaptionsMode) {
      const enabled = await enableLiveCaptions(page, { logger }).catch((e) => {
        logger.warn?.('[gmeet.captions] enable threw', e?.message);
        return false;
      });
      logger.info?.('[gmeet.bot] captions enable result', { enabled });
    }

    // Aloneness watcher with useHistory: true — fixes the b00bbd6f-...
    // false positive where a flicker in the participant panel briefly
    // dropped the visible roster to 0 and the bot bailed mid-meeting.
    alonenessPromise = watchAloneness({
      roster,
      botName,
      logger,
      logTag: '[gmeet.aloneness]',
      useHistory: true,
      historyWindowMs: 30_000,
      recentAttributedSpeaker: () => bridge.getRecentAttributedSpeaker(),
      audioFreshMs: 60_000,
      signal: abortController.signal,
      onAlone: ({ everSawOthers, reason }) => {
        if (stopFlag.stopped) return;
        stopFlag = { stopped: true, reason: reason || (everSawOthers ? 'left_alone_timeout' : 'startup_alone_timeout') };
        abortController.abort();
      },
    });

    // Main run loop: poll Google's removal indicators (ended/disconnected)
    // and a stop flag set by external callers via the abort signal.
    const pollIntervalMs = 5_000;
    const runLoopStartMs = Date.now();
    // Deaf-capture watchdog (audio_asr only): if people are present but NO
    // remote audio receiver is ever hooked within this grace, the WebRTC
    // media path didn't attach (seen after rejoins where Meet doesn't
    // re-deliver media). We exit with a RECOVERABLE reason so the
    // orchestrator rejoins on a fresh pod rather than sitting silently deaf.
    // A hooked-but-silent track (legitimately quiet meeting) does NOT trip
    // this — we key on tracksHooked, not frames.
    const noAudioGraceMs = parseInt(process.env.GOOGLE_MEET_NO_AUDIO_TRACK_GRACE_MS || '90000', 10);
    while (!stopFlag.stopped && !abortController.signal.aborted) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      // External stop signal (e.g. SIGTERM in worker) wired through
      // abortController.
      if (abortController.signal.aborted) break;

      // Detect host-initiated removal / call-ended states.
      try {
        const status = await checkMeetingStatus(page);
        if (status?.removed) {
          stopFlag = { stopped: true, reason: 'meeting_ended' };
          break;
        }
      } catch (_) { /* page may be closed */ }

      // Periodic status log (every poll) so worker logs show liveness.
      const stats = bridge?.stats || {};
      logger.info?.('[gmeet.bot] status', {
        elapsed_s: Math.round((Date.now() - meetingStartMs) / 1000),
        transcript_source: transcriptSource,
        segments: segments.length,
        ...(!isCaptionsMode
          ? {
              frames_in: stats.framesIn,
              frames_pushed: stats.framesPushed,
              tracks_hooked: stats.tracksHooked || 0,
            }
          : { captions_published: stats.captionsPublished || 0 }),
      });

      // Deaf-capture self-heal: audio_asr, people present, but no audio
      // receiver ever hooked past the grace → media never attached. Exit
      // recoverable so we rejoin fresh instead of producing nothing.
      // HARD GUARD: never fire if we've actually produced transcript segments
      // OR received any audio frames — producing output means we are NOT deaf,
      // regardless of the (sometimes unreliable) track-hook signal. This
      // prevents abandoning a working meeting on a false negative.
      if (
        !isCaptionsMode &&
        everSawHumans &&
        segments.length === 0 &&
        (stats.framesIn || 0) === 0 &&
        (stats.tracksHooked || 0) === 0 &&
        Date.now() - runLoopStartMs > noAudioGraceMs
      ) {
        logger.warn?.('[gmeet.bot] no audio receiver hooked despite participants present — recycling (deaf capture)', {
          elapsed_s: Math.round((Date.now() - runLoopStartMs) / 1000),
          frames_in: stats.framesIn || 0,
        });
        stopFlag = { stopped: true, reason: 'audio_capture_no_tracks' };
        break;
      }

      // Liveness heartbeat so a dead pod (OOM / node loss) is detectable —
      // last_heartbeat_at going stale is the signal the reaper needs. Best-effort.
      if (dbIntegration && meetingDbId) {
        dbIntegration.updateHeartbeat(meetingDbId).catch(() => {});
      }
    }

    logger.info?.('[gmeet.bot] meeting loop exited', { reason: stopFlag.reason });

    if (dbIntegration && meetingDbId && stopFlag.reason) {
      try {
        await dbIntegration.recordExitReason(meetingDbId, stopFlag.reason, {
          platform: 'googlemeet',
          lived_ms: Date.now() - meetingStartMs,
          ever_saw_humans: everSawHumans,
        });
      } catch (err) {
        logger.warn?.('[gmeet.bot] recordExitReason failed', err?.message);
      }
    }

    await leaveGoogleMeet(page, stopFlag.reason || 'normal_exit').catch((e) => {
      logger.warn?.('[gmeet.leave] graceful leave failed', e?.message);
    });
    await takeScreenshot(page, savePath, 'final').catch(() => {});

    // Drain ASR sessions, then close browser.
    if (bridge) {
      await bridge.stop().catch((e) => logger.warn?.('[gmeet.bridge] stop failed', e?.message));
    }
    abortController.abort();
    await alonenessPromise.catch(() => {});
    await closeBrowser(browser);

    const finalParticipants = (Array.from(roster.byName ? Object.values(roster.byName) : [])
      .map((p) => ({ name: p.name }))
      .filter((p) => p.name && p.name.toLowerCase() !== botName.toLowerCase())
    );

    clearTimeout(maxMeetingTimer);
    if (meetingDbId) _ACTIVE.delete(meetingDbId);
    return {
      status: 'success',
      meetingUrl,
      botName,
      transcriptSource,
      savePath,
      duration: (Date.now() - meetingStartMs) / 1000,
      segmentsCount: segments.length,
      participants: finalParticipants,
      reason: stopFlag.reason || 'normal_exit',
      everSawHumans,
      healthStatus: healthMonitor.getStatus(),
    };
  } catch (err) {
    logger.error?.(`[gmeet.bot] fatal: ${err.message}`, err);
    healthMonitor.recordError(err);
    if (page && !page.isClosed?.()) {
      await takeScreenshot(page, savePath, 'error').catch(() => {});
    }

    // If we threw BEFORE confirming a real join, the bot never actually got
    // into the meeting — lobby rejection ("You can't join this video call"),
    // admission timeout, or a limbo false-positive. Record this as `failed`
    // with a precise reason so it isn't left stuck in `joining` or later
    // mislabeled `completed` by the orchestrator. (Errors AFTER joinConfirmed
    // are mid-meeting faults — left to the existing recoverable/exit path.)
    if (!joinConfirmed && dbIntegration && meetingDbId) {
      const msg = String(err?.message || '');
      let failReason = 'admission_failed';
      // A bot-detection block (visible reCAPTCHA challenge) is a distinct,
      // honest state — surface it as blocked_recaptcha rather than a generic
      // timeout/rejection so it isn't mislabeled. Ported from Vexa 391f661.
      // Checked first: its outcome tag is authoritative.
      if (err?.outcome === 'blocked' || msg.includes('blocked_recaptcha')) failReason = 'blocked_recaptcha';
      else if (msg.includes('admission_unverified')) failReason = 'admission_unverified';
      else if (/rejected/i.test(msg)) failReason = 'admission_rejected';
      else if (/timeout/i.test(msg)) failReason = 'admission_timeout';
      try {
        await dbIntegration.failMeeting(meetingDbId, failReason, {
          platform: 'googlemeet',
          message: msg.slice(0, 300),
          ever_saw_humans: everSawHumans,
        });
      } catch (e) { logger.warn?.('[gmeet.bot] failMeeting failed', e?.message); }
    }

    abortController.abort();
    if (bridge) await bridge.stop().catch(() => {});
    if (browser) await forceLeave(browser, context).catch(() => {});
    clearTimeout(maxMeetingTimer);
    if (meetingDbId) _ACTIVE.delete(meetingDbId);
    return {
      status: 'error',
      error: err.message,
      meetingUrl,
      botName,
      savePath,
      duration: (Date.now() - meetingStartMs) / 1000,
      everSawHumans,
      healthStatus: healthMonitor.getStatus(),
    };
  }
}

// External stop hook. Two call shapes:
//   stopMeeting(meetingDbId, reason)              — preferred
//   stopMeeting({ meetingDbId, reason })          — object form
// Returns { stopped: boolean, reason: string|null } so callers can
// tell whether anything was actually running. The bot itself will
// continue to drain ASR sessions, leave the call, and close the
// browser on the way out — joinMeeting()'s returned Promise resolves
// once that finishes.
async function stopMeeting(arg, reason) {
  const meetingDbId = typeof arg === 'object' && arg ? arg.meetingDbId : arg;
  const finalReason = typeof arg === 'object' && arg && arg.reason ? arg.reason : reason || 'external_stop';
  if (!meetingDbId) return { stopped: false, reason: 'no_meeting_id' };
  const ctl = _ACTIVE.get(meetingDbId);
  if (!ctl) return { stopped: false, reason: 'not_running' };
  if (ctl.signal.aborted) return { stopped: false, reason: 'already_stopping' };
  // Stash reason on the controller so the abort listener picks it up.
  // We can't pass arbitrary data through AbortSignal natively, so the
  // listener wrapper above checks stopFlag first and only overwrites
  // when not already stopped — meaning whichever caller wins, the
  // reason persists. (Aloneness sets stopFlag synchronously before
  // calling abort(); external stop sets reason 'external_stop'.)
  ctl.abort();
  return { stopped: true, reason: finalReason };
}

// Read-only snapshot of currently running bots (used by health/admin
// surfaces if/when the worker layer needs to enumerate active meetings).
function listActiveMeetings() {
  return Array.from(_ACTIVE.keys());
}

module.exports = {
  joinMeeting,
  stopMeeting,
  listActiveMeetings,
  BotHealthMonitor,
  // Re-export sub-modules so platformRouter and tests can call into them.
  launchBrowser,
  closeBrowser,
  joinGoogleMeetMeeting,
  waitForAdmission,
  leaveGoogleMeet,
  RosterWatcher,
  CaptureBridge,
};
