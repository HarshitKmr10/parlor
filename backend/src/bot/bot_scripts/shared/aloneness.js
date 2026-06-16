'use strict';

// Cross-platform aloneness watcher. Two-tier model (ports Vexa's
// recording.ts:1280-1414):
//   - startupGraceMs (default 20 min) — used while no other participant
//     has EVER been seen. Hosts join late; don't bail before the meeting
//     starts.
//   - postSpeakerGraceMs (default 60 s) — once we've seen ≥1 human at
//     any point, switch to the short timeout. After everyone leaves the
//     meeting is effectively over and we should drop quickly to free
//     the worker pod.
//
// Bug history (b00bbd6f-...): naïve implementation polled
// `roster.snapshot().list` every 1 s and counted each sample
// independently. When the participant panel DOM flickers (e.g. tile
// re-mount during simulcast layer change) the snapshot can momentarily
// drop to 0, the alone counter increments, and the bot bails while
// people are actively talking. The `useHistory: true` flag fixes this
// by treating the bot as "not alone" if ANY sample within the rolling
// `historyWindowMs` window saw ≥1 human. New code paths should pass
// `useHistory: true`; the default is preserved for backwards-compat.
//
// Bug history (beb81f9f-...): even with `useHistory: true`, the
// rosterWatcher can be entirely silent for the duration of the
// meeting if the People panel never opens, the DOM observer never
// catches mutations, or platform UI behaves unexpectedly. The bot
// then bails at the 20-min startup grace despite humans being in the
// meeting and audio attribution working — 121 segments were
// transcribed before this aloneness watcher decided "alone".
//
// The `recentAttributedSpeaker` callback closes that gap: it returns
// the most recently AWS/Azure-attributed non-bot speaker name (or
// null) from the captureBridge. If audio is being streamed and
// attributed within `audioFreshMs` (default 60 s), there is
// definitely a human in the meeting — strictly stronger evidence
// than the DOM panel and immune to UI render bugs. New code paths
// should pass this callback; the default is null which preserves
// legacy roster-only behavior.

const DEFAULT_POLL_INTERVAL_MS = 1_000;
const DEFAULT_WARMUP_MS = 20_000;
const DEFAULT_STARTUP_GRACE_MS = 20 * 60 * 1000;
const DEFAULT_POSTSPEAKER_GRACE_MS = 60 * 1000;
const DEFAULT_HISTORY_WINDOW_MS = 30_000;
const DEFAULT_AUDIO_FRESH_MS = 60_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function watchAloneness({
  roster,
  signal,
  onAlone,
  logger,
  warmupMs = DEFAULT_WARMUP_MS,
  startupGraceMs = DEFAULT_STARTUP_GRACE_MS,
  postSpeakerGraceMs = DEFAULT_POSTSPEAKER_GRACE_MS,
  botName = '',
  graceMs,
  useHistory = false,
  historyWindowMs = DEFAULT_HISTORY_WINDOW_MS,
  // Audio-path fallback. Optional () => { name, tsMs } | null callback
  // returning the most recently attributed non-bot speaker. When
  // present and the report is fresher than `audioFreshMs`, the bot is
  // treated as not alone regardless of the roster panel.
  recentAttributedSpeaker = null,
  audioFreshMs = DEFAULT_AUDIO_FRESH_MS,
  // Tag included in log lines so logs from concurrent watchers are
  // distinguishable. Defaults to the legacy tag for compatibility.
  logTag = '[aloneness]',
  // Override the 1s poll interval for tests.
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
} = {}) {
  if (!roster || typeof roster.snapshot !== 'function') {
    return Promise.resolve();
  }
  const log = logger || console;
  const postGrace = Number.isFinite(graceMs) ? Number(graceMs) : postSpeakerGraceMs;
  const startupGrace = Math.max(startupGraceMs, postGrace);
  const botLower = String(botName || '').toLowerCase();
  const windowSamples = Math.max(1, Math.ceil(historyWindowMs / pollIntervalMs));

  return (async () => {
    const startedAt = Date.now();
    let aloneMs = 0;
    let everSawOthers = false;
    let lastLogSecond = -1;
    const recentSamples = [];

    while (!signal?.aborted) {
      const snap = roster.snapshot();
      const list = (snap?.list) || [];

      const others = list.filter((p) => {
        const n = String(p?.name || '').toLowerCase();
        if (!n) return false;
        if (/bot/i.test(p.name)) return false;
        if (botLower && n === botLower) return false;
        return true;
      });
      const sampleOtherCount = others.length;

      recentSamples.push({ ts: Date.now(), otherCount: sampleOtherCount });
      while (recentSamples.length > windowSamples) recentSamples.shift();

      if (Date.now() - startedAt < warmupMs) {
        await sleep(pollIntervalMs);
        continue;
      }

      // Effective count: with useHistory, the largest count seen across
      // the rolling window — survives a flicker that briefly drops the
      // visible roster to 0.
      const rosterEffective = useHistory
        ? Math.max(0, ...recentSamples.map((s) => s.otherCount))
        : sampleOtherCount;

      // Audio-path fallback. If captureBridge attributed a non-bot
      // speaker within audioFreshMs, we know a human is here even
      // when the DOM roster reports 0. Beats roster-flicker AND
      // roster-silent failure modes — both observed live on staging.
      let audioAttributed = null;
      if (typeof recentAttributedSpeaker === 'function') {
        try {
          const r = recentAttributedSpeaker();
          if (r && r.name && Number.isFinite(r.tsMs)
            && (Date.now() - r.tsMs) <= audioFreshMs) {
            const lower = String(r.name).trim().toLowerCase();
            if (lower
              && !/bot/i.test(r.name)
              && (!botLower || lower !== botLower)) {
              audioAttributed = r.name;
            }
          }
        } catch (_) { /* swallow — never let the callback break the watch */ }
      }

      const effectiveOthers = audioAttributed ? Math.max(rosterEffective, 1) : rosterEffective;

      if (effectiveOthers >= 1) {
        if (!everSawOthers) {
          everSawOthers = true;
          log.info?.(`${logTag} speakers identified, switching to post-speaker timeout`,
            audioAttributed ? { source: 'audio_path', name: audioAttributed }
                            : { source: 'roster', count: effectiveOthers });
        }
        if (aloneMs > 0) {
          log.info?.(`${logTag} cleared`,
            audioAttributed ? { source: 'audio_path', name: audioAttributed }
                            : { source: 'roster', others_present: effectiveOthers });
        }
        aloneMs = 0;
      } else {
        aloneMs += pollIntervalMs;
        const thresholdMs = everSawOthers ? postGrace : startupGrace;

        if (aloneMs >= thresholdMs) {
          log.info?.(`${logTag} grace elapsed, leaving`, {
            elapsed_ms: aloneMs,
            threshold_ms: thresholdMs,
            ever_saw_others: everSawOthers,
          });
          onAlone?.({
            everSawOthers,
            elapsedMs: aloneMs,
            reason: everSawOthers ? 'left_alone_timeout' : 'startup_alone_timeout',
          });
          return;
        }
        const wholeSec = Math.floor(aloneMs / 1000);
        if (wholeSec > 0 && wholeSec % 10 === 0 && wholeSec !== lastLogSecond) {
          lastLogSecond = wholeSec;
          log.info?.(`${logTag} alone`, {
            elapsed_sec: wholeSec,
            threshold_ms: thresholdMs,
            mode: everSawOthers ? 'post-speaker' : 'startup',
          });
        }
      }

      await sleep(pollIntervalMs);
    }
  })().catch((err) => {
    (logger || console).warn?.(`${logTag} watcher errored`, err?.message);
  });
}

module.exports = { watchAloneness };
