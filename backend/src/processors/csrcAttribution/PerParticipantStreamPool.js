'use strict';

// One streaming ASR session per participant id (pid). Audio for a pid
// arrives already attributed by TeamsCsrcAttributionSource, so each session
// sees a single-speaker stream — diarization is unnecessary.
//
// Today the default adapter is AwsCsrcTranscribeAdapter (HTTP/2 streaming via
// @aws-sdk/client-transcribe-streaming). The pool takes the adapter class
// as `adapterFactory` so a future Azure Speech adapter slots in unchanged.
//
// Lifecycle:
//   - First frame for an unknown pid → spawn session, kick off connect()
//     in the background, queue the frame for delivery once connect resolves.
//   - Every frame for a known pid → push directly into adapter. Update
//     lastFrameTs.
//   - Heartbeat loop (every HEARTBEAT_MS) iterates sessions; for any session
//     that hasn't received a real frame within HEARTBEAT_MS, push 20 ms of
//     silence so the AWS HTTP/2 stream stays alive (~15 s idle close limit).
//   - Idle reap loop (every IDLE_CHECK_MS): close sessions with no frames
//     for IDLE_REAP_MS; next frame for that pid recreates the session.
//   - Hard cap: if we hit MAX_SESSIONS, evict the session with the oldest
//     lastFrameTs to make room.

const { AwsCsrcTranscribeAdapter } = require('./AwsCsrcTranscribeAdapter');

const DEFAULT_HEARTBEAT_MS = 5_000;
const DEFAULT_IDLE_REAP_MS = 5 * 60_000;
const DEFAULT_IDLE_CHECK_MS = 30_000;
const DEFAULT_MAX_SESSIONS = 4;

class PerParticipantStreamPool {
  constructor({
    logger = console,
    region = process.env.AWS_REGION || 'us-east-1',
    languageCode = process.env.TRANSCRIPTION_LANGUAGE || 'en-US',
    sampleRate = 16_000,
    maxSessions = Number(process.env.MSTEAMS_CSRC_MAX_SESSIONS) || DEFAULT_MAX_SESSIONS,
    heartbeatMs = Number(process.env.STREAMING_HEARTBEAT_MS) || DEFAULT_HEARTBEAT_MS,
    idleReapMs = DEFAULT_IDLE_REAP_MS,
    meetingStartMs = Date.now(),
    meetingId = null,
    onSegment = () => {},
    onError = () => {},
    adapterFactory = (opts) => new AwsCsrcTranscribeAdapter(opts),
  } = {}) {
    this.logger = logger;
    this.region = region;
    this.languageCode = languageCode;
    this.sampleRate = sampleRate;
    this.maxSessions = Math.max(1, maxSessions);
    this.heartbeatMs = heartbeatMs;
    this.idleReapMs = idleReapMs;
    this.meetingStartMs = meetingStartMs;
    this.meetingId = meetingId;
    this.onSegment = onSegment;
    this.onError = onError;
    this.adapterFactory = adapterFactory;

    // pid -> { adapter, pid, name, createdAt, lastFrameTs, ready, pendingFrames }
    this._sessions = new Map();
    this._stopped = false;
    this._heartbeatTimer = null;
    this._idleTimer = null;
    this._stats = {
      sessionsSpawned: 0,
      sessionsReaped: 0,
      sessionsEvicted: 0,
      framesPushed: 0,
      framesQueuedDuringConnect: 0,
      framesDroppedClosed: 0,
      segmentsEmitted: 0,
    };
  }

  start() {
    if (this._heartbeatTimer || this._stopped) return;
    this._heartbeatTimer = setInterval(() => this._heartbeatTick(), this.heartbeatMs);
    if (typeof this._heartbeatTimer.unref === 'function') this._heartbeatTimer.unref();
    this._idleTimer = setInterval(() => this._idleReapTick(), DEFAULT_IDLE_CHECK_MS);
    if (typeof this._idleTimer.unref === 'function') this._idleTimer.unref();
  }

  pushFrame({ pid, name, pcm, ts_ms }) {
    if (this._stopped) return;
    if (!pid || !pcm || !pcm.length) return;
    let session = this._sessions.get(pid);
    if (!session) {
      if (this._sessions.size >= this.maxSessions) this._evictOldest();
      session = this._spawnSession(pid, name);
    } else if (name && session.name !== name) {
      session.name = name;
    }
    session.lastFrameTs = Date.now();
    if (session.ready) {
      try {
        session.adapter.pushFrame(pcm);
        this._stats.framesPushed += 1;
      } catch (e) {
        this.logger.warn?.('[teams.csrc.pool] pushFrame threw', { pid, err: e?.message });
      }
    } else {
      // Connect is still in flight; queue up to a small bound so we don't
      // grow unbounded if the AWS endpoint hangs.
      if (session.pendingFrames.length < 256) {
        session.pendingFrames.push(pcm);
        this._stats.framesQueuedDuringConnect += 1;
      } else {
        this._stats.framesDroppedClosed += 1;
      }
    }
  }

  _spawnSession(pid, name) {
    this.logger.info?.('[teams.csrc.pool] spawning session', { pid, name });
    const session = {
      pid,
      name: name || null,
      createdAt: Date.now(),
      lastFrameTs: Date.now(),
      ready: false,
      pendingFrames: [],
      adapter: null,
    };
    const adapter = this.adapterFactory({
      logger: this.logger,
      region: this.region,
      sampleRate: this.sampleRate,
      languageCode: this.languageCode,
      meetingStartMs: this.meetingStartMs,
      meetingId: this.meetingId,
      participantId: session.pid,
      participantName: session.name,
      onSegment: (seg) => this._onSegment(session, seg),
      onError: (err) => {
        this.logger.warn?.('[teams.csrc.pool] adapter error', { pid: session.pid, err: err?.message });
        try { this.onError(err, session.pid); } catch (_) {}
      },
      onReady: () => {
        session.ready = true;
        this.logger.info?.('[teams.csrc.pool] session ready', { pid: session.pid });
        // Drain any frames queued during connect.
        while (session.pendingFrames.length > 0) {
          const buf = session.pendingFrames.shift();
          try { adapter.pushFrame(buf); this._stats.framesPushed += 1; }
          catch (e) { this.logger.warn?.('[teams.csrc.pool] drain pushFrame threw', e?.message); break; }
        }
      },
      onClose: (err) => {
        // Natural close (no err) = bounded-silence path: the adapter
        // returned because the speaker stopped, the pool drops the
        // session, the next frame for this pid lazy-respawns. Error
        // close = adapter actually failed; surface the message.
        if (err) {
          this.logger.info?.('[teams.csrc.pool] session closed (error)', { pid: session.pid, err: err.message });
        } else {
          this.logger.info?.('[teams.csrc.pool] session closed (idle)', { pid: session.pid });
        }
        this._sessions.delete(session.pid);
      },
    });
    session.adapter = adapter;
    this._sessions.set(pid, session);
    this._stats.sessionsSpawned += 1;
    adapter.connect().catch((err) => {
      this.logger.warn?.('[teams.csrc.pool] connect failed', { pid, err: err?.message });
      this._sessions.delete(pid);
      try { this.onError(err, pid); } catch (_) {}
    });
    return session;
  }

  _onSegment(session, seg) {
    this._stats.segmentsEmitted += 1;
    try {
      this.onSegment({
        ...seg,
        participant_id: session.pid,
        participant_name: session.name || null,
      });
    } catch (e) {
      this.logger.warn?.('[teams.csrc.pool] onSegment callback threw', e?.message);
    }
  }

  _evictOldest() {
    let oldestPid = null;
    let oldestTs = Infinity;
    for (const [pid, s] of this._sessions.entries()) {
      if (s.lastFrameTs < oldestTs) { oldestTs = s.lastFrameTs; oldestPid = pid; }
    }
    if (!oldestPid) return;
    this._stats.sessionsEvicted += 1;
    this.logger.info?.('[teams.csrc.pool] evicting oldest', {
      pid: oldestPid, age_ms: Date.now() - oldestTs,
    });
    const s = this._sessions.get(oldestPid);
    this._sessions.delete(oldestPid);
    if (s && s.adapter) s.adapter.close().catch(() => {});
  }

  _heartbeatTick() {
    if (this._stopped) return;
    const now = Date.now();
    for (const session of this._sessions.values()) {
      if (!session.ready) continue;
      if (now - session.lastFrameTs < this.heartbeatMs) continue;
      try {
        session.adapter.heartbeat();
      } catch (e) {
        this.logger.warn?.('[teams.csrc.pool] heartbeat threw', { pid: session.pid, err: e?.message });
      }
    }
  }

  _idleReapTick() {
    if (this._stopped) return;
    const now = Date.now();
    const reap = [];
    for (const [pid, s] of this._sessions.entries()) {
      if (now - s.lastFrameTs > this.idleReapMs) reap.push(pid);
    }
    for (const pid of reap) {
      const s = this._sessions.get(pid);
      this._sessions.delete(pid);
      this._stats.sessionsReaped += 1;
      this.logger.info?.('[teams.csrc.pool] reaping idle session', {
        pid, idle_ms: now - (s ? s.lastFrameTs : 0),
      });
      if (s && s.adapter) s.adapter.close().catch(() => {});
    }
  }

  stats() {
    return {
      ...this._stats,
      activeSessions: this._sessions.size,
      pids: Array.from(this._sessions.keys()),
    };
  }

  async stop() {
    if (this._stopped) return;
    this._stopped = true;
    if (this._heartbeatTimer) { clearInterval(this._heartbeatTimer); this._heartbeatTimer = null; }
    if (this._idleTimer) { clearInterval(this._idleTimer); this._idleTimer = null; }
    const closes = [];
    for (const [pid, s] of this._sessions.entries()) {
      if (s.adapter) closes.push(s.adapter.close().catch((e) => {
        this.logger.warn?.('[teams.csrc.pool] close threw', { pid, err: e?.message });
      }));
    }
    this._sessions.clear();
    await Promise.all(closes);
  }
}

module.exports = { PerParticipantStreamPool };
