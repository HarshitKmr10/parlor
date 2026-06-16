'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { JoinTimer } = require('./timing');
const { launchBrowser, newSession } = require('./browser');
const { joinMeetingFlow, muteMicPostAdmission } = require('./join');
const { detectInitialState, waitForAdmission, TERMINAL } = require('./admission');
const { watchRemoval } = require('./removal');
const { watchTrackPresence } = require('./trackPresence');
const { leaveMeeting } = require('./leave');
const { CaptureBridge } = require('./captureBridge');
const { TranscriptionAdapter } = require('./transcription');
const { RosterWatcher } = require('./rosterWatcher');
const { watchAloneness } = require('../shared/aloneness');
const { enableLiveCaptions } = require('./captions');
const { TRANSCRIPT_SOURCE, normalizeTranscriptSource } = require('./transcriptSource');

// dbIntegration is the canonical path that the GET /meetings/transcripts
// endpoint reads from (via meetingJoinerService.getMeetingJoinerById).
// Bypass realTimeProcessor.handleAttributedSegment / appendChunk — those
// methods don't exist on RealTimeMeetingProcessor, so segments would be
// silently dropped at persistence.
let dbIntegration;
try { dbIntegration = require('../../../storage/dbIntegration'); }
catch (_) { dbIntegration = null; }

let logger;
try { logger = require('../../observability').logger; }
catch (_) {
  try { logger = require('../../../shared/logger'); }
  catch (_e) { logger = console; }
}

const { startHeartbeat, reportState, stopHeartbeat } = require('../../heartbeat');

// Exit-reason classification. Terminal reasons mean the meeting is truly
// over and the orchestrator should NOT rejoin. Recoverable reasons indicate
// the bot lost the meeting due to transient infrastructure or platform
// issues, and the orchestrator should re-dispatch on a fresh pod.
const TERMINAL_REASONS = new Set([
  'removed', 'removed_before_admission', 'admission_timeout', 'max_meeting_time',
  'alone', 'bot_kicked', 'org_max_duration', 'memory_pressure',
]);
const RECOVERABLE_REASONS = new Set([
  'trackGone', 'network_error', 'platform_disconnect',
  'subprocess_crash', 'sigterm_during_active', 'pod_evicted',
]);

function classifyExitReason(reason) {
  if (!reason) return 'unknown';
  if (TERMINAL_REASONS.has(reason)) return 'terminal';
  if (RECOVERABLE_REASONS.has(reason)) return 'recoverable';
  return 'unknown';
}

// Deterministic "never got into the meeting" outcomes. When the join throws
// one of these BEFORE admission was confirmed, the bot must write `failed`
// authoritatively (parity with the Google Meet bot) so the orchestrator can't
// later mislabel it `completed` — otherwise a meeting the bot never joined
// shows up as a success and hides the real join rate. Returns the canonical
// fail reason, or null when the error is post-admission or genuinely
// recoverable (Playwright crash, etc.) and the existing re-dispatch path owns it.
const PRE_ADMISSION_FAIL_REASONS = new Set([
  'admission_timeout',
  'removed_before_admission',
]);

function preAdmissionFailReason(joinConfirmed, errReason) {
  if (joinConfirmed) return null;
  return PRE_ADMISSION_FAIL_REASONS.has(errReason) ? errReason : null;
}

// SIGTERM handler — the K8s pod is being drained. Report a recoverable
// exit so the rejoin orchestrator hands the meeting to a fresh pod.
let _activeJoinAbort = null;

process.on('SIGTERM', () => {
  try {
    stopHeartbeat({ exit_reason: 'sigterm_during_active', classification: 'recoverable' });
  } catch (_) {}
  if (_activeJoinAbort) {
    try { _activeJoinAbort.abort(); } catch (_) {}
  }
  process.exit(0);
});

const DEFAULTS = Object.freeze({
  recordingWindowMs: parseInt(process.env.MSTEAMS_CHUNK_MS || '5000', 10),
  // Lobby wait before giving up on admission. 60s was far too short — hosts
  // routinely take minutes to click "Admit", so the bot would leave before
  // being let in (then a late Allow admitted no one). Matched to Google Meet's
  // 240s admission window (GOOGLE_MEET_ADMISSION_TIMEOUT_MS) for parity.
  waitingRoomMs: parseInt(process.env.MSTEAMS_LOBBY_MS || '240000', 10),
  joinFlowBudgetMs: parseInt(process.env.MSTEAMS_JOIN_BUDGET_MS || '15000', 10),
  // Maximum wall-clock duration the bot will stay in a single
  // meeting before forcibly leaving with reason 'max_meeting_time'.
  // Raised from 2 h to 8 h to cover all-day workshops, leadership
  // reviews, and recurring sync sessions that legitimately run past
  // the old 2-hour ceiling and were silently being cut off.
  maxMeetingMs: parseInt(process.env.MSTEAMS_MAX_MEETING_MS || '28800000', 10), // 8h
  alonenessGraceMs: parseInt(process.env.MSTEAMS_ALONE_GRACE_MS || '300000', 10), // 5min
});

function envFlag(name, defaultValue = true) {
  const raw = process.env[name];
  if (raw == null || raw === '') return defaultValue;
  return String(raw).toLowerCase() !== 'false';
}

async function joinMeeting(meetingUrl, credentials = {}, options = {}) {
  if (!meetingUrl) throw new Error('meetingUrl required');
  const name = credentials.name || options.botName || 'Meeting Bot';
  const opts = { ...DEFAULTS, ...options };
  const realTimeProcessor = options.realTimeProcessor || null;
  const meetingDbId = options.meetingDbId || null;
  const sessionNumber = Number(process.env.SESSION_NUMBER || options.sessionNumber || 1);
  // Flipped true once the admission state machine resolves ADMITTED. Drives the
  // catch handler's decision to write `failed` for pre-admission throws.
  let joinConfirmed = false;
  const meetingDir = options.meetingDir || makeMeetingDir(meetingDbId);

  const timer = new JoinTimer({ logger });
  let browser;
  let context;
  let page;
  const removalCtl = new AbortController();
  _activeJoinAbort = removalCtl;
  let rosterStop = null;
  let heartbeatStopped = false;
  const stopHeartbeatOnce = (finalState) => {
    if (heartbeatStopped) return;
    heartbeatStopped = true;
    try { stopHeartbeat(finalState || {}); } catch (_) { /* ignore */ }
  };

  try {
    await fsp.mkdir(meetingDir, { recursive: true });
    try { startHeartbeat({ meeting_id: meetingDbId, session_number: sessionNumber }); }
    catch (_) { /* heartbeat is observability — never block the join */ }
    browser = await timer.measure('browser.launch', () => launchBrowser({ logger }));
    context = await newSession(browser, { name });
    page = await context.newPage();

    // Forward in-page console + page errors to Node logs so we can see
    // what the AudioWorklet, peer-stream hook, and recorder are actually
    // doing. Without this, page-realm errors (Blob URL / CSP / autoplay)
    // are silent and the bot looks healthy on the outside while the
    // capture pipeline is dead. Filter to teams-tagged messages + errors
    // to keep the volume manageable.
    page.on('console', (msg) => {
      const text = msg.text() || '';
      if (text.startsWith('[teams.') || msg.type() === 'error') {
        logger.info?.('[teams.page]', msg.type(), text);
      }
    });
    page.on('pageerror', (err) => {
      logger.warn?.('[teams.page] pageerror', err?.message || String(err));
    });

    const captureRoot = path.join(meetingDir, 'audio');
    const scratchRoot = path.join(meetingDir, 'scratch');
    await fsp.mkdir(captureRoot, { recursive: true }).catch(() => {});
    await fsp.mkdir(scratchRoot, { recursive: true }).catch(() => {});

    const roster = new RosterWatcher({ logger, botName: name });
    const segments = [];
    const segmentsPath = path.join(meetingDir, 'segments.jsonl');
    let segmentNumber = 0;
    const meetingStartMs = Date.now();

    // Resolved on the first remote audio track the page-realm bridge sees.
    // Used as the strongest possible "we are admitted" signal — if a remote
    // track attaches, the bot is provably in the meeting regardless of DOM.
    let firstTrackResolve;
    const firstTrack = new Promise((resolve) => { firstTrackResolve = resolve; });

    const attributionMode = (process.env.MSTEAMS_ATTRIBUTION_MODE || 'dom').toLowerCase();
    const transcriptSource = normalizeTranscriptSource(options.transcriptSource);
    const captureAudio = transcriptSource !== TRANSCRIPT_SOURCE.TEAMS_CAPTIONS;
    logger.info?.('[teams.bridge] capture config', { attributionMode, transcriptSource, captureAudio });

    const transcription = captureAudio && attributionMode !== 'webrtc_csrc'
      ? new TranscriptionAdapter({ logger })
      : null;
    if (transcription) {
      logger.info?.('[teams.transcribe] provider', { provider: transcription.providerName });
    } else if (transcriptSource === TRANSCRIPT_SOURCE.TEAMS_CAPTIONS) {
      logger.info?.('[teams.transcribe] skipped (Teams captions selected)', { transcriptSource });
    } else {
      logger.info?.('[teams.transcribe] skipped (webrtc_csrc owns ASR pipeline)', { attributionMode });
    }

    const bridge = new CaptureBridge({
      logger,
      transcription,
      scratchDir: scratchRoot,
      dumpDir: process.env.MSTEAMS_DUMP_AUDIO === 'true' ? captureRoot : null,
      // Pass the watcher itself, not just a snapshot, so the bridge can
      // call getActiveSpeakerInWindow() at chunk-process time rather than
      // freezing a stale roster at start-of-meeting.
      roster: () => roster.snapshot(),
      rosterWatcher: roster,
      meetingStartMs,
      attributionMode,
      transcriptSource,
      dbIntegration,
      meetingId: meetingDbId,
      botName: name,
      onTrack: (info) => {
        if (firstTrackResolve) { firstTrackResolve(info); firstTrackResolve = null; }
      },
      onSegment: async (segment) => {
        // Drop only EXPLICIT partials. The diarizer marks Turn shapes as
        // 'partial' or 'final'; the per-track WAV path uses other `kind`
        // values ('segments', etc.) for finalised segments — treat those
        // as finals too. The earlier finals-only check
        // `kind === 'final' || is_final === true` was matching the
        // diarizer shape and silently dropping every per-track segment,
        // which is why staging meeting 9836550c-... was producing AWS
        // Transcribe text in logs but persisting zero rows to the DB.
        if (!segment) return;
        const isExplicitPartial = segment.kind === 'partial'
          || (segment.is_final === false && segment.kind !== 'caption');
        if (isExplicitPartial) return;
        segments.push(segment);
        await fsp.appendFile(segmentsPath, JSON.stringify(segment) + '\n').catch(() => {});

        // Persist directly to the meeting_joiner row's transcript.content
        // array — that's what GET /meetings/transcripts reads. dbIntegration
        // does its own dedupe + short-text filter (<10 chars).
        if (dbIntegration && meetingDbId) {
          segmentNumber += 1;
          const startSec = Math.max(0, ((Number(segment.start_ms) || 0) - meetingStartMs) / 1000);
          const endSec = Math.max(startSec, ((Number(segment.end_ms) || 0) - meetingStartMs) / 1000);
          // confidence MUST be numeric (Optional[float] in
          // TranscriptEntry pydantic model). Pass null until we have a real
          // numeric provider score. The attribution-source label moves into
          // meta.attribution_confidence so it stays available without
          // breaking response validation.
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
            session_number: sessionNumber,
            wall_clock_ts: wallClockTs,
            originalChunkData: {
              audioPath: null,
              chunkDuration: endSec - startSec,
            },
            meta: {
              peer_id: segment.peer_id,
              track_id: segment.track_id,
              language: segment.language,
              provider: segment.provider,
              kind: segment.kind,
              source: segment.source ?? null,
              device_id: segment.device_id ?? null,
              caption_id: segment.caption_id ?? null,
              is_final: segment.is_final ?? null,
              audio_timestamp: segment.audio_timestamp ?? null,
              attribution_confidence: segment.attribution_confidence ?? null,
            },
          };
          logger.info?.('[teams.bridge] persist', {
            n: segmentNumber,
            speaker: segmentData.speaker,
            attribution: segment.attribution_confidence,
            kind: segment.kind,
            text_len: (segmentData.text || '').length,
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
          catch (e) { logger.warn?.('[teams.bridge] dbIntegration append failed', e?.message); }
        }

        // Best-effort handoff to legacy realTimeProcessor for any consumers
        // that hook in via the older interface. Both methods are absent on
        // RealTimeMeetingProcessor today; this is here for forward-compat.
        if (realTimeProcessor && typeof realTimeProcessor.handleAttributedSegment === 'function') {
          try { await realTimeProcessor.handleAttributedSegment(segment); }
          catch (e) { logger.warn?.('[teams.bridge] processor handoff failed', e?.message); }
        } else if (realTimeProcessor && typeof realTimeProcessor.appendChunk === 'function') {
          try {
            await realTimeProcessor.appendChunk({
              chunk: segment.id,
              speaker: segment.speaker,
              text: segment.text,
              start_ms: segment.start_ms,
              end_ms: segment.end_ms,
              meta: { peer_id: segment.peer_id, language: segment.language },
            });
          } catch (e) {
            logger.warn?.('[teams.bridge] appendChunk failed', e?.message);
          }
        }
      },
    });
    await bridge.expose(page);
    // Wire the in-page tile observer (gallery-based speaker detection) into
    // the rosterWatcher. This must happen before navigation so the binding
    // is ready when the tile observer's first sweep runs.
    await roster.expose(page);

    await joinMeetingFlow({
      context, page, meetingUrl, name, timer, logger,
      recordingWindowMs: opts.recordingWindowMs,
      attributionMode,
      captureAudio,
    });

    // Admission state machine. Race three signals:
    //   1. DOM in-meeting marker visible (#hangup-button)
    //   2. First remote WebRTC audio track attached (firstTrack promise)
    //   3. Removal marker (kicked / connection lost)
    // Any of (1) or (2) means we are admitted. (3) means we never made it.
    const initial = await detectInitialState(page, { gateMs: 4_000 });
    logger.info?.('[teams.admission] initial', initial);

    if (initial.state !== TERMINAL.ADMITTED) {
      const result = await timer.measure('admission.confirm', () =>
        waitForAdmission(page, {
          waitingRoomMs: opts.waitingRoomMs,
          trackSignal: firstTrack,
          onState: (state, meta) => logger.info?.('[teams.admission] state', state, meta),
        })
      );
      if (result.state === TERMINAL.TIMEOUT) {
        throw new Error('admission_timeout');
      }
      if (result.state === TERMINAL.REMOVED) {
        throw new Error('removed_before_admission');
      }
      logger.info?.('[teams.admission] admitted', { via: result.selector, elapsed_ms: result.elapsed_ms });
      try { reportState({ state: 'admitted', admitted_at: new Date().toISOString() }); }
      catch (_) { /* observability only */ }
    } else {
      try { reportState({ state: 'admitted', admitted_at: new Date().toISOString() }); }
      catch (_) { /* observability only */ }
    }

    // Past the admission gate — the bot is provably in the meeting (in-meeting
    // DOM marker or a real WebRTC track). Mark it so a later throw is treated
    // as a mid-meeting fault, not a "never joined" failure.
    joinConfirmed = true;

    // Admitted → flip the meeting to `ongoing` and stamp bot_join_time (parity
    // with googlemeet/index.js). The warm-pool/sidecar path has no Python
    // bridge to do this, so without it the meeting stays stuck in `joining`
    // and never shows as live. Non-fatal.
    if (dbIntegration && meetingDbId) {
      try { await dbIntegration.markMeetingJoined(meetingDbId); }
      catch (e) { logger.warn?.('[teams.admission] markMeetingJoined failed', e?.message); }
    }

    // Wait briefly for the meeting toolbar to render after admission, then
    // robustly toggle off mic + camera by walking aria-labels in-page. This
    // is more reliable than static selectors because Teams renames the
    // attributes more often than its English aria-label patterns change.
    const toggleResult = await page.evaluate(() => {
      const labels = [];
      const btns = Array.from(document.querySelectorAll('button[aria-label]'));
      for (const b of btns) {
        const a = b.getAttribute('aria-label') || '';
        const visible = b.offsetParent !== null;
        labels.push({ label: a, visible });
      }
      const findClick = (predicate) => {
        const btn = btns.find((b) => b.offsetParent !== null && predicate(b.getAttribute('aria-label') || ''));
        if (btn) { btn.click(); return btn.getAttribute('aria-label'); }
        return null;
      };
      // Mic: prefer "Mute" or "Turn off mic" — these appear when mic is currently ON.
      const micClicked = findClick((l) =>
        /^Mute(\b|$)/i.test(l) || /Turn (off|mute) (mic|microphone)/i.test(l)
      );
      // Camera: prefer "Turn off camera/video" — appears when camera is currently ON.
      const camClicked = findClick((l) =>
        /Turn (off|stop) (camera|video)/i.test(l)
      );
      return { micClicked, camClicked, labels };
    }).catch(() => ({ micClicked: null, camClicked: null, labels: [] }));

    logger.info?.('[teams.toolbar] mic_clicked=' + (toggleResult.micClicked || 'none')
      + '  camera_clicked=' + (toggleResult.camClicked || 'none'));
    if (!toggleResult.micClicked || !toggleResult.camClicked) {
      // Surface the actual aria-labels so we can adjust the regexes if Teams
      // changes them. Logged once per meeting, only when toggles missed.
      const visibleLabels = toggleResult.labels.filter((l) => l.visible).map((l) => l.label);
      logger.info?.('[teams.toolbar] visible button labels:', visibleLabels.slice(0, 30));
    }

    // Belt-and-braces: keyboard shortcut as a last resort if the toolbar
    // click missed. Vexa relies on this exclusively; we use it as fallback.
    if (!toggleResult.micClicked) {
      await muteMicPostAdmission(page, { timer }).catch(() => {});
    }

    // Live participants: push each roster change to the DB so the dashboard
    // can render real names without waiting for meeting completion. The
    // watcher already throttles by content key, so this only fires when the
    // set of participant names actually changes.
    if (dbIntegration && meetingDbId) {
      roster.setOnChange(async ({ list }) => {
        const botNameLower = String(name || '').toLowerCase();
        const participants = list
          .filter((p) => p?.name)
          .filter((p) => !/bot/i.test(p.name) && p.name.toLowerCase() !== botNameLower)
          .map((p) => ({
            name: p.name,
            joinedAt: new Date().toISOString(),
            isPresent: true,
            source: 'roster_live',
          }));
        try { await dbIntegration.updateParticipants(meetingDbId, participants); }
        catch (err) { logger.warn?.('[teams.roster] participants update failed', err?.message); }
      });
    }

    rosterStop = roster.start(page);
    bridge.roster = roster.snapshot.bind(roster);

    // Teams captions mode needs captions enabled because Teams' own ASR is
    // the transcript source. Other modes keep the previous opt-out flag.
    const shouldEnableCaptions = transcriptSource === TRANSCRIPT_SOURCE.TEAMS_CAPTIONS
      || envFlag('MSTEAMS_ENABLE_CAPTIONS', true);
    if (shouldEnableCaptions) {
      const language = options.teamsCaptionsLanguage || process.env.MSTEAMS_CAPTIONS_LANGUAGE || null;
      enableLiveCaptions(page, { logger, language }).catch((err) => {
        logger.warn?.('[teams.captions] enable threw', err?.message);
      });
    } else {
      logger.info?.('[teams.captions] disabled by MSTEAMS_ENABLE_CAPTIONS=false');
    }

    // Removal watcher in background; signals end of meeting.
    const removed = new Promise((resolve) => {
      watchRemoval(page, {
        signal: removalCtl.signal,
        onRemoved: (info) => resolve({ reason: 'removed_by_admin', info }),
      }).catch(() => {});
    });

    const maxTimer = new Promise((resolve) =>
      setTimeout(() => resolve({ reason: 'max_meeting_time' }), opts.maxMeetingMs)
    );

    // Aloneness watcher: leave when bot has been the only roster entry for
    // alonenessGraceMs continuously. Without this the bot would sit in an
    // empty meeting until either an admin removes it or maxMeetingMs (8h)
    // elapses, pinning a worker pod and confusing the HPA.
    const alone = new Promise((resolve) => {
      watchAloneness({
        roster,
        graceMs: opts.alonenessGraceMs,
        startupGraceMs: parseInt(process.env.MSTEAMS_STARTUP_ALONE_MS || '1200000', 10), // 20 min
        postSpeakerGraceMs: parseInt(process.env.MSTEAMS_POSTSPEAKER_ALONE_MS || '60000', 10), // 60 s
        // Teams' rosterWatcher receives `__teamsBridgeOnRoster` events
        // every time the People panel mutates — empirically ~17 events
        // per second during an active meeting (verified from staging
        // worker logs for meeting 08d74b21-...). The participant count
        // oscillates 0,1,2,3,...,8 within milliseconds as the panel
        // re-renders. Without useHistory, any single 1 s aloneness poll
        // that happens to land on a 0-participant sample increments
        // the alone counter; over a long meeting enough consecutive
        // 0-samples accumulate to fire postSpeakerGraceMs and the bot
        // bails mid-meeting (left_alone_timeout) while humans are
        // actively talking. Same vulnerability that hit Meet's
        // b00bbd6f-... — fixed by walking the rolling history window
        // instead of trusting any single snapshot tick.
        useHistory: true,
        historyWindowMs: 30_000,
        recentAttributedSpeaker: () => bridge.getRecentAttributedSpeaker(),
        audioFreshMs: 60_000,
        signal: removalCtl.signal,
        logger,
        botName: name,
        logTag: '[teams.aloneness]',
        onAlone: (info) => resolve({ reason: info?.reason || 'alone_grace_elapsed', info }),
      }).catch(() => {});
    });

    // WebRTC track-presence watcher: leave once Teams has torn down all
    // remote audio peer connections. Independent of DOM panel state and
    // text phrasing — when active.length drops to 0 the call is over,
    // full stop. Gated on `MSTEAMS_TRACK_PRESENCE_ENABLED` (default on)
    // so it can be disabled per-deploy without a code change.
    const trackPresenceEnabled = String(process.env.MSTEAMS_TRACK_PRESENCE_ENABLED || 'true').toLowerCase() !== 'false';
    const trackGone = trackPresenceEnabled
      ? new Promise((resolve) => {
          watchTrackPresence(page, {
            signal: removalCtl.signal,
            logger,
            onEmpty: (info) => resolve({ reason: info?.reason || 'remote_tracks_gone', info }),
          }).catch(() => {});
        })
      : new Promise(() => {}); // never resolves when disabled

    timer.end('admission.confirm');
    logger.info?.('[teams.lifecycle] active', {
      meeting_db_id: meetingDbId,
      total_join_ms: timer.totalElapsedMs(),
    });

    const exitReason = await Promise.race([removed, maxTimer, alone, trackGone]);
    exitReason.classification = classifyExitReason(exitReason?.reason);
    const livedMs = Date.now() - meetingStartMs;
    logger.info?.('[teams.lifecycle] exiting', { ...exitReason, lived_ms: livedMs, meeting_db_id: meetingDbId });

    // Persist the reason before the leave flow so we don't lose it if
    // leaveMeeting or context.close() throws. Status is still set by the
    // Python orchestrator later — this only patches exit_reason / details.
    if (dbIntegration && meetingDbId && exitReason?.reason) {
      try {
        await dbIntegration.recordExitReason(meetingDbId, exitReason.reason, {
          platform: 'msteams',
          lived_ms: livedMs,
          info: exitReason.info || null,
        });
      } catch (err) {
        logger.warn?.('[teams.lifecycle] recordExitReason failed', err?.message);
      }
    }

    // No-op stop kept for symmetry; nothing in-process to tear down now
    // that the diarizer layer is gone (the in-page recorder dies with
    // context.close() below).
    try { await bridge.stop?.(); } catch (_) { /* ignore */ }

    await leaveMeeting(page, { logger }).catch(() => {});

    // segmentsForCleanup used to receive output from the deleted batch
    // re-diarize pass; now it's just an alias for the persisted segments
    // so the cleanup block below doesn't need restructuring.
    const segmentsForCleanup = segments;

    // End-of-meeting LLM cleanup pass. Opt-in via env so a misbehaving
    // model can't break the leave flow. Cleaned segments are appended via
    // dbIntegration with meta.cleanup populated for audit.
    if ((process.env.TRANSCRIPT_CLEANUP_ENABLED || 'false').toLowerCase() === 'true' && segmentsForCleanup.length > 0 && dbIntegration && meetingDbId) {
      try {
        const { TranscriptCleanup } = require('../../../processors/transcriptCleanup');
        const cleaner = new TranscriptCleanup({
          logger,
          provider: (process.env.TRANSCRIPT_CLEANUP_PROVIDER || 'bedrock').toLowerCase(),
          model: process.env.TRANSCRIPT_CLEANUP_MODEL,
          aggressive: (process.env.TRANSCRIPT_CLEANUP_AGGRESSIVE || 'false').toLowerCase() === 'true',
        });
        const participants = (roster.snapshot()?.list || []).map((n) => ({ name: n }));
        // Defence-in-depth: drop explicit partials only. Per-track segments
        // use `kind: 'segments'` (etc.) for finalised utterances; we want
        // those in the cleanup input set.
        const cleanInputs = segmentsForCleanup.filter(
          (s) => s && s.kind !== 'partial' && s.is_final !== false,
        );
        const cleaned = await cleaner.clean(cleanInputs, participants);
        logger.info?.('[teams.cleanup] done', {
          segments_in: cleanInputs.length,
          cleaned_out: cleaned.length,
        });
        let cleanIdx = 0;
        let skippedNoAttribution = 0;
        let skippedNoTiming = 0;
        for (const c of cleaned) {
          cleanIdx += 1;
          // Drop cleanup outputs that would actively WORSEN the transcript:
          //   - no real speaker → 'Unknown' / 'Speaker N' rows are exactly
          //     the noise the user complained about; better to keep the
          //     original (still in the live transcript) than to append a
          //     duplicate row with worse attribution.
          //   - no timing → likely a partial that leaked through; would
          //     also defeat dbIntegration's overlap-based dedupe (which
          //     needs non-zero start/end to fire) and surface as 0:00 rows.
          const verdict = classifyCleanupOutput(c);
          if (verdict.decision === 'skip_junk_attribution') { skippedNoAttribution += 1; continue; }
          if (verdict.decision === 'skip_no_timing') { skippedNoTiming += 1; continue; }
          try {
            const cleanupWallClockTs = new Date().toISOString();
            const cleanupSegmentData = {
              timestamp: cleanupWallClockTs,
              speaker: verdict.speaker,
              text: c.text,
              startTime: Math.max(0, (verdict.startMs - meetingStartMs) / 1000),
              endTime: Math.max(0, (verdict.endMs - meetingStartMs) / 1000),
              confidence: null,
              chunk: `cleanup_${cleanIdx}`,
              segmentNumber: 100_000 + cleanIdx,
              isRealTime: false,
              session_number: sessionNumber,
              wall_clock_ts: cleanupWallClockTs,
              meta: {
                cleanup: { reason: c.reason, original_indices: c.original_indices },
              },
            };
            if (typeof dbIntegration.appendTranscriptSegmentWithSession === 'function') {
              await dbIntegration.appendTranscriptSegmentWithSession(meetingDbId, cleanupSegmentData, {
                sessionNumber,
                wallClockTs: cleanupWallClockTs,
              });
            } else {
              await dbIntegration.appendTranscriptSegment(meetingDbId, cleanupSegmentData);
            }
          } catch (e) {
            logger.warn?.('[teams.cleanup] append failed', e?.message);
          }
        }
        if (skippedNoAttribution || skippedNoTiming) {
          logger.info?.('[teams.cleanup] skipped low-quality outputs', {
            skipped_no_attribution: skippedNoAttribution,
            skipped_no_timing: skippedNoTiming,
          });
        }
      } catch (err) {
        logger.warn?.('[teams.cleanup] pass failed', err?.message);
      }
    }

    stopHeartbeatOnce({
      exit_reason: exitReason?.reason || 'unknown',
      classification: exitReason?.classification || classifyExitReason(exitReason?.reason),
    });

    return {
      success: true,
      platform: 'msteams',
      meetingDir,
      segmentsPath,
      segmentsCount: segments.length,
      timing: timer.report(),
      exitReason,
      classification: exitReason?.classification || classifyExitReason(exitReason?.reason),
      sessionNumber,
      // Legacy contract — there is no MP4 in this implementation; downstream
      // checks 'NoFile' to skip video upload.
      localMp4Path: 'NoFile',
    };
  } catch (error) {
    logger.error?.('[teams.lifecycle] failed', { error: error?.message, timing: timer.report() });
    try { if (page) await page.screenshot({ path: path.join(meetingDir, 'error.png'), fullPage: true }); } catch (_) {}
    // Errors thrown out of the join lifecycle are usually subprocess-level
    // crashes (Playwright tab gone, page eval rejected, etc.). Treat as
    // recoverable so the orchestrator can re-dispatch on a fresh pod.
    const errReason = error?.message || 'subprocess_crash';

    // …EXCEPT a deterministic "never got admitted" throw (lobby timeout /
    // removed before admission). Write `failed` authoritatively with that
    // reason — parity with googlemeet/index.js. Without this the bot returns
    // "recoverable", the orchestrator marks the row `completed` on exit, and a
    // meeting the bot never joined is mislabeled a success (hiding the real
    // join rate). `failed` is terminal, so the later orchestrator `completed`
    // write is rejected by validate_transition (last-writer-wins).
    const failReason = preAdmissionFailReason(joinConfirmed, errReason);
    if (failReason && dbIntegration && meetingDbId) {
      try {
        await dbIntegration.failMeeting(meetingDbId, failReason, {
          platform: 'msteams',
          message: errReason.slice(0, 300),
        });
      } catch (e) { logger.warn?.('[teams.admission] failMeeting failed', e?.message); }
    }

    const errClassification = failReason
      ? 'terminal'
      : (classifyExitReason(errReason) === 'unknown'
        ? 'recoverable'
        : classifyExitReason(errReason));
    stopHeartbeatOnce({
      exit_reason: failReason || 'subprocess_crash',
      classification: errClassification,
      error: error?.message,
    });
    return {
      success: false,
      platform: 'msteams',
      error: error?.message || String(error),
      meetingDir,
      timing: timer.report(),
      classification: errClassification,
      sessionNumber,
      localMp4Path: 'NoFile',
    };
  } finally {
    // Belt-and-braces: stop the heartbeat if neither the success nor catch
    // branch reached it (e.g. a synchronous throw before the first
    // try-block). We pass 'subprocess_crash' so we don't accidentally mark
    // an unknown exit as terminal.
    stopHeartbeatOnce({ exit_reason: 'subprocess_crash', classification: 'recoverable' });
    if (_activeJoinAbort === removalCtl) _activeJoinAbort = null;
    removalCtl.abort();
    if (rosterStop) try { rosterStop(); } catch (_) {}
    try { if (context) await context.close(); } catch (_) {}
    try { if (browser) await browser.close(); } catch (_) {}
  }
}

async function startStreamScrapping(meetingId, options = {}) {
  // The stream scrapping concept doesn't apply in this implementation: capture
  // is end-to-end inside joinMeeting. Return a no-op for compatibility.
  return Object.freeze({ success: true, message: 'Capture is integrated into joinMeeting', meetingId });
}

// Legacy entrypoint. Production's meetingProcessor.js calls
// joinTeamsMeeting(meetingUrl, username, realTimeProcessor) and expects a
// string back — the path of an MP4 recording, or 'NoFile' if no video was
// produced. This module captures audio per-track without ever assembling a
// video file, so we always return 'NoFile' and surface segments by writing
// them directly to the DB via the same dbIntegration the processor uses.
async function joinTeamsMeeting(meetingUrl, username, realTimeProcessor) {
  const meetingDbId = realTimeProcessor?.meetingId || null;

  // Best-effort DB push for each segment we produce. Fails silently if the DB
  // layer is unavailable in the current environment (local harness, smoke).
  let dbIntegration = null;
  try { dbIntegration = require('../../../storage/dbIntegration'); }
  catch (_) { dbIntegration = null; }

  const persistSegment = async (segment) => {
    if (!dbIntegration || !meetingDbId) return;
    try {
      await dbIntegration.appendTranscriptSegment(meetingDbId, {
        timestamp: new Date(segment.start_ms).toISOString(),
        speaker: segment.speaker || 'Unknown',
        text: segment.text,
        startTime: (segment.start_ms || 0) / 1000,
        endTime: (segment.end_ms || 0) / 1000,
        confidence: typeof segment.attribution_confidence === 'string' ? null : segment.attribution_confidence,
        chunk: segment.id,
        segmentNumber: undefined,
        isRealTime: true,
        originalChunkData: {
          provider: segment.provider,
          peer_id: segment.peer_id,
          language: segment.language,
        },
      });
    } catch (e) {
      logger.warn?.('[teams.compat] db append failed', e?.message);
    }
  };

  // Wrap the realTimeProcessor so the bridge's onSegment handoff path lights
  // up. The processor itself does not expose handleAttributedSegment, but
  // we preserve any methods that do exist so updateSpeakerMappingData and
  // friends keep working when the caller drives them externally.
  const wrappedProcessor = realTimeProcessor
    ? Object.assign(Object.create(Object.getPrototypeOf(realTimeProcessor) || Object.prototype), realTimeProcessor, {
        handleAttributedSegment: persistSegment,
      })
    : { handleAttributedSegment: persistSegment };

  const result = await joinMeeting(
    meetingUrl,
    { name: username },
    {
      realTimeProcessor: wrappedProcessor,
      meetingDbId,
    }
  );

  if (!result.success) {
    logger.warn?.('[teams.compat] joinMeeting failed', { error: result.error });
  }
  // Legacy callers branch on the literal string 'NoFile' to skip MP4 upload.
  return 'NoFile';
}

function makeMeetingDir(meetingId) {
  const stamp = `${Date.now()}_${meetingId || 'unknown'}`;
  const root = process.env.MSTEAMS_MEETING_DIR || path.join('/tmp', 'msteams_meetings');
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  return path.join(root, stamp);
}

// Compute an at-a-glance accuracy signal from the per-segment
// attribution confidence distribution. Stable shape for the dashboard
// "quality score" widget. Post-PR-3500 the only confidence values
// captureBridge can emit are: csrc_match, roster_active, roster_solo,
// last_known_speaker, fallback (soft "Unknown speaker"). High-confidence
// = csrc_match + roster_active + roster_solo.
function computeAccuracyReport({ segments = [] } = {}) {
  const n = segments.length;
  const byConfidence = {
    csrc_match: 0,
    roster_active: 0,
    roster_solo: 0,
    last_known_speaker: 0,
    fallback: 0,
  };
  for (const s of segments) {
    const conf = s.attribution_confidence || 'fallback';
    if (byConfidence[conf] != null) byConfidence[conf] += 1;
  }
  const highConf = byConfidence.csrc_match + byConfidence.roster_active + byConfidence.roster_solo;
  const score = n > 0 ? Number((highConf / n).toFixed(3)) : 0;
  return {
    segments: n,
    confidence_distribution: byConfidence,
    high_confidence_ratio: score,
  };
}

// Pure helper: classify a cleanup-pass output as appendable / junk-skip /
// no-timing-skip. Exported so tests can lock in the bug-fix behaviour
// without booting the entire join lifecycle.
function classifyCleanupOutput(c) {
  if (!c) return { decision: 'skip_junk_attribution' };
  const speaker = (c.speaker || '').trim();
  const isJunkSpeaker = !speaker
    || /^unknown( speaker)?$/i.test(speaker)
    || /^speaker\s*\d+$/i.test(speaker);
  if (isJunkSpeaker) return { decision: 'skip_junk_attribution' };
  const startMs = Number(c.start_ms);
  const endMs = Number(c.end_ms);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || (startMs === 0 && endMs === 0)) {
    return { decision: 'skip_no_timing' };
  }
  return { decision: 'append', speaker, startMs, endMs };
}

module.exports = { joinMeeting, joinTeamsMeeting, startStreamScrapping, computeAccuracyReport, classifyCleanupOutput, classifyExitReason, preAdmissionFailReason };
