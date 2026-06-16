const meetingJoinerService = require('../services/meetingJoinerService');
const { v4: uuidv4 } = require('uuid');

function envFlag(name, defaultValue = true) {
  const raw = process.env[name];
  if (raw == null || raw === '') return defaultValue;
  return String(raw).toLowerCase() !== 'false';
}

// Sentinel returned by the atomic-append helper when the active DB driver
// doesn't support it (e.g. prisma) — tells the caller to use the legacy path.
const _ATOMIC_FALLBACK = Symbol('atomic_transcript_fallback');

/**
 * Database integration utilities for existing meeting joiner code
 */
class DBIntegration {
  
  /**
   * Initialize a new meeting session in database
   * Call this when bot attempts to join a meeting
   */
  async initializeMeeting(meetingUrl, orgId, meetingId = null) {
    try {
      const meetingJoiner = await meetingJoinerService.createMeetingJoiner({
        meeting_url: meetingUrl,
        org_id: orgId,
        meeting_id: meetingId
      });
      
      console.log(`Initialized meeting in DB: ${meetingJoiner.id}`);
      return meetingJoiner;
    } catch (error) {
      console.error('Failed to initialize meeting in DB:', error);
      throw error;
    }
  }

  /**
   * Mark meeting as joined (bot successfully joined)
   * Call this when bot joins the meeting successfully
   */
  async markMeetingJoined(meetingJoinerId, participants = []) {
    try {
      // Flip to `ongoing` and stamp the real join time. The warm-pool/sidecar
      // path has no Python bridge to do this (the old PGQueuer bridge set
      // ONGOING in meeting_processor_bridge.py), so the bot must. Only write
      // participants when we actually have some — markMeetingJoined is often
      // called at admission with an empty roster, and we don't want to clobber
      // a roster the participant watcher may have already populated.
      // Do NOT pass bot_join_time here. The store stamps it via COALESCE on
      // the ongoing-transition, so it's set once (first join) and a rejoin
      // (session 2+) re-calling markMeetingJoined won't overwrite it. Passing
      // it explicitly would clobber the original join time every session and
      // collapse the reported duration.
      const extras = {};
      if (Array.isArray(participants) && participants.length > 0) {
        extras.participants = participants;
      }
      const result = await meetingJoinerService.updateStatus(
        meetingJoinerId,
        'ongoing',
        extras
      );
      console.log(`Meeting ${meetingJoinerId} marked as joined (status=ongoing)`);
      return result;
    } catch (error) {
      // Non-fatal: a transient status-write failure must not abort a meeting
      // the bot has already joined.
      console.error('Failed to mark meeting as joined:', error?.message);
      return null;
    }
  }

  /**
   * Liveness heartbeat. Writes meeting_joiner.last_heartbeat_at so the
   * warm-pool reaper / ghost-pod detection can tell a live bot from a dead
   * one (pod OOM / node loss). Call periodically from the bot's run loop.
   * Best-effort — never throws.
   */
  async updateHeartbeat(meetingJoinerId) {
    if (!meetingJoinerId) return null;
    try {
      return await meetingJoinerService.updateMeetingFields(meetingJoinerId, {
        last_heartbeat_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to update heartbeat:', error?.message);
      return null;
    }
  }

  /**
   * Update real-time transcript
   * Call this from your transcription processor
   */
  async updateRealtimeTranscript(meetingJoinerId, transcriptData) {
    try {
      // Structure transcript data with timestamps and speakers
      const formattedTranscript = {
        timestamp: new Date().toISOString(),
        content: transcriptData,
        lastUpdated: Date.now()
      };

      const result = await meetingJoinerService.updateTranscript(
        meetingJoinerId, 
        formattedTranscript
      );
      
      return result;
    } catch (error) {
      console.error('Failed to update transcript:', error);
      // Don't throw error for transcript updates to avoid breaking meeting flow
      return null;
    }
  }

  /**
   * Update participants list
   * Call this when participants join/leave
   */
  async updateParticipantsList(meetingJoinerId, participants) {
    try {
      const formattedParticipants = participants.map(participant => ({
        id: participant.id || uuidv4(),
        name: participant.name || 'Unknown',
        email: participant.email || null,
        joinedAt: participant.joinedAt || new Date().toISOString(),
        leftAt: participant.leftAt || null,
        isPresent: participant.isPresent !== false
      }));

      const result = await meetingJoinerService.updateParticipants(
        meetingJoinerId, 
        formattedParticipants
      );
      
      return result;
    } catch (error) {
      console.error('Failed to update participants:', error);
      return null;
    }
  }

  /**
   * Mark meeting as completed.
   *
   * Accepts both the legacy positional `videoLink` string and the newer
   * options object so existing callers keep working. The options form
   * carries the exit reason and any structured detail emitted by the
   * watcher that resolved the leave race (see meeting_joiner.exit_reason
   * in schema.prisma for the vocabulary).
   */
  async completeMeeting(meetingJoinerId, videoLinkOrOptions = null) {
    try {
      const opts = (videoLinkOrOptions && typeof videoLinkOrOptions === 'object')
        ? videoLinkOrOptions
        : { videoLink: videoLinkOrOptions };

      const additionalData = {};
      if (opts.videoLink) additionalData.video_link = opts.videoLink;
      if (opts.exitReason) additionalData.exit_reason = String(opts.exitReason).slice(0, 64);
      if (opts.exitDetails !== undefined && opts.exitDetails !== null) {
        additionalData.exit_details = opts.exitDetails;
      }

      const result = await meetingJoinerService.updateStatus(
        meetingJoinerId,
        'completed',
        additionalData
      );

      console.log(`Meeting ${meetingJoinerId} marked as completed`, {
        exit_reason: opts.exitReason || null,
      });
      return result;
    } catch (error) {
      console.error('Failed to complete meeting:', error);
      throw error;
    }
  }

  /**
   * Mark meeting as FAILED with an exit reason.
   *
   * Used for "never really joined" outcomes — lobby rejection, admission
   * timeout, or a UI-only "admitted" state that never produced a real
   * connection (no roster, no audio frames). The bot writes `failed`
   * authoritatively here rather than leaving the meeting stuck in
   * `joining` (or letting it be mislabeled `completed`). `failed` is a
   * terminal state, so a later orchestrator `completed` write is rejected
   * by validate_transition — making this the safe, last-writer-wins path.
   */
  async failMeeting(meetingJoinerId, exitReason, exitDetails = null) {
    if (!meetingJoinerId) return null;
    try {
      const additionalData = {};
      if (exitReason) additionalData.exit_reason = String(exitReason).slice(0, 64);
      if (exitDetails !== undefined && exitDetails !== null) {
        additionalData.exit_details = exitDetails;
      }
      const result = await meetingJoinerService.updateStatus(
        meetingJoinerId,
        'failed',
        additionalData
      );
      console.log(`Meeting ${meetingJoinerId} marked as failed`, {
        exit_reason: exitReason || null,
      });
      return result;
    } catch (error) {
      console.error('Failed to mark meeting failed:', error);
      return null;
    }
  }

  /**
   * Persist the exit reason without flipping status. Used for failure
   * modes where status will be set by another path (e.g. the Python
   * orchestrator marks `completed` after the bot exits) but we still
   * want the "why" recorded from the bot side.
   */
  async recordExitReason(meetingJoinerId, exitReason, exitDetails = null) {
    if (!meetingJoinerId || !exitReason) return null;
    try {
      const data = { exit_reason: String(exitReason).slice(0, 64) };
      if (exitDetails !== undefined && exitDetails !== null) {
        data.exit_details = exitDetails;
      }
      const result = await meetingJoinerService.updateMeetingFields(meetingJoinerId, data);
      console.log(`Recorded exit reason for meeting ${meetingJoinerId}: ${exitReason}`);
      return result;
    } catch (error) {
      console.error('Failed to record exit reason:', error);
      return null;
    }
  }

  /**
   * Set video recording link after processing
   * Call this from your Azure storage upload
   */
  async setVideoRecordingLink(meetingJoinerId, videoUrl) {
    try {
      const result = await meetingJoinerService.setVideoLink(meetingJoinerId, videoUrl);
      console.log(`Video link set for meeting ${meetingJoinerId}`);
      return result;
    } catch (error) {
      console.error('Failed to set video link:', error);
      throw error;
    }
  }

  /**
   * Update participants list for the meeting
   * Call this when you have participant information from CSV
   */
  async updateParticipants(meetingJoinerId, participantsList) {
    try {
      const result = await meetingJoinerService.updateParticipants(meetingJoinerId, participantsList);
      console.log(`Updated participants for meeting ${meetingJoinerId}: ${participantsList.length} participants`);
      return result;
    } catch (error) {
      console.error('Failed to update participants:', error);
      throw error;
    }
  }

  /**
   * Get meeting details by ID
   */
  async getMeetingDetails(meetingJoinerId) {
    try {
      return await meetingJoinerService.getMeetingJoinerById(meetingJoinerId);
    } catch (error) {
      console.error('Failed to get meeting details:', error);
      return null;
    }
  }

  /**
   * Read the transcript_source column for a meeting. Set at creation
   * time (via the dashboard toggle / API request) and consumed by the
   * worker when it dispatches the bot. Returns null if the row is
   * missing the field, the meeting isn't found, or any error — caller
   * should treat null as "use the bot's platform default".
   */
  async getMeetingTranscriptSource(meetingJoinerId) {
    try {
      const meeting = await meetingJoinerService.getMeetingJoinerById(meetingJoinerId);
      return meeting?.transcript_source || null;
    } catch (error) {
      console.error('Failed to read transcript_source:', error);
      return null;
    }
  }

  /**
   * Get all active meetings for monitoring
   */
  async getActiveMeetings() {
    try {
      return await meetingJoinerService.getActiveMeetings();
    } catch (error) {
      console.error('Failed to get active meetings:', error);
      return [];
    }
  }

  /**
   * Append a transcript segment to existing transcript
   * Call this for real-time transcript updates
   *
   * @param {string} meetingJoinerId
   * @param {object} segmentData  Segment payload. May carry `session_number`
   *   and `wall_clock_ts` directly; if absent they will be sourced from
   *   `options` below. The fields are added to the persisted segment so
   *   transcripts spanning multiple rejoin sessions stay attributable.
   * @param {object} [options]
   * @param {number} [options.sessionNumber=1]  Rejoin session number (1 for
   *   the first attempt, 2+ after pod restarts / recoverable exits).
   * @param {string} [options.wallClockTs]  ISO-8601 wall clock time the
   *   segment was observed (independent of meeting-relative start/end
   *   seconds, which reset on rejoin).
   */
  /**
   * Race-free transcript append (used when MEETING_JOINER_ATOMIC_TRANSCRIPT
   * is enabled). The dedup + format + append all run INSIDE a row lock so
   * concurrent writers can't lose each other's segments. Returns the updated
   * row, null (duplicate → no-op), or the _ATOMIC_FALLBACK sentinel when the
   * driver doesn't support atomic append.
   *
   * NOTE (needs-DB-test): does not yet apply the duplicate-meeting timestamp
   * filtering that meetingJoinerService.updateTranscript does — atomic mode is
   * intended for the primary (non-duplicate) append path for now.
   */
  async _appendTranscriptSegmentAtomic(meetingJoinerId, segmentData, options, segmentText) {
    const self = this;
    const dedupeEnabled = envFlag('MSTEAMS_TRANSCRIPT_DEDUPE_ENABLED', true);
    const sessionNumber = Number(segmentData.session_number ?? options.sessionNumber ?? 1);
    const wallClockTs =
      segmentData.wall_clock_ts || options.wallClockTs || new Date().toISOString();

    const result = await meetingJoinerService.updateTranscriptAtomic(
      meetingJoinerId,
      (current) => {
        const t = current && typeof current === 'object'
          ? current
          : { content: [], timestamp: new Date().toISOString() };
        if (!Array.isArray(t.content)) t.content = [];

        if (dedupeEnabled) {
          const incomingChunk = segmentData.chunk;
          if (incomingChunk && t._chunkIndex && t._chunkIndex[incomingChunk]) {
            return null; // duplicate chunk → no write
          }
          const tail = t.content.slice(-5);
          const similarDupe = tail.some((existing) => {
            const overlap = Math.max(
              0,
              Math.min(existing.endTime || 0, segmentData.endTime || 0)
                - Math.max(existing.startTime || 0, segmentData.startTime || 0)
            );
            if (overlap < 1) return false;
            return self.calculateTextSimilarity(existing.text || '', segmentText) > 0.8;
          });
          if (similarDupe) return null;
        }

        const formattedSegment = {
          timestamp: segmentData.timestamp || new Date().toISOString(),
          speaker: segmentData.speaker || 'Unknown',
          text: segmentText,
          startTime: segmentData.startTime || 0,
          endTime: segmentData.endTime || 0,
          confidence: segmentData.confidence,
          chunk: segmentData.chunk,
          segmentNumber: segmentData.segmentNumber,
          isRealTime: true,
          appendedAt: new Date().toISOString(),
          ...segmentData,
          session_number: sessionNumber,
          wall_clock_ts: wallClockTs,
        };
        t.content.push(formattedSegment);
        if (dedupeEnabled) {
          if (!t._chunkIndex) t._chunkIndex = {};
          if (formattedSegment.chunk) t._chunkIndex[formattedSegment.chunk] = 1;
        }
        const nowMs = Date.now();
        t.lastUpdated = nowMs;
        t.lastSegmentAtMs = nowMs;
        t.totalSegments = t.content.length;
        t.lastSegmentTime = formattedSegment.timestamp;
        return t;
      }
    );

    if (result === false) return _ATOMIC_FALLBACK; // driver can't do atomic
    return result; // updated row, or null for a deduped no-op
  }

  async appendTranscriptSegment(meetingJoinerId, segmentData, options = {}) {
    try {
      // Skip segments with very short text. Default threshold is 10 chars
      // (drops disfluencies like "uh", "yeah", "ok"). Override via env var
      // MIN_SEGMENT_TEXT_LENGTH — set to 0 to disable (e.g. for rapid-fire
      // single-word e2e fixtures where every utterance is a single word).
      const segmentText = segmentData.text || '';
      const minLen = Number(process.env.MIN_SEGMENT_TEXT_LENGTH ?? 10);
      if (segmentText.trim().length < minLen) {
        console.log(`⏭️ Skipping short segment: "${segmentText}" (${segmentText.length} chars, min=${minLen})`);
        return null;
      }

      // Atomic, race-free append path. DEFAULT OFF (needs a DB integration
      // test before enabling — flip MEETING_JOINER_ATOMIC_TRANSCRIPT=true).
      // Fixes the lost-update window where a draining (dying) pod and a
      // rejoined pod both read-modify-write the transcript and clobber each
      // other. Falls through to the legacy path if the driver can't do it.
      if (envFlag('MEETING_JOINER_ATOMIC_TRANSCRIPT', false)) {
        const atomic = await this._appendTranscriptSegmentAtomic(
          meetingJoinerId, segmentData, options, segmentText
        );
        if (atomic !== _ATOMIC_FALLBACK) return atomic;
      }

      // First get the current meeting to retrieve existing transcript
      let currentMeeting;
      try {
        currentMeeting = await meetingJoinerService.getMeetingJoinerById(meetingJoinerId);
      } catch (dbError) {
        console.error(`💀 Database connection error for meeting ${meetingJoinerId}:`, dbError.message);
        // Return gracefully instead of failing the whole transcription process
        return null;
      }
      
      if (!currentMeeting) {
        console.error(`Meeting ${meetingJoinerId} not found for segment append`);
        return null;
      }

      // Get existing transcript or initialize empty structure
      let existingTranscript = currentMeeting.transcript || {
        content: [],
        timestamp: new Date().toISOString(),
        lastUpdated: Date.now()
      };

      // Ensure content is an array
      if (!Array.isArray(existingTranscript.content)) {
        existingTranscript.content = [];
      }

      const dedupeEnabled = envFlag('MSTEAMS_TRANSCRIPT_DEDUPE_ENABLED', true);
      if (dedupeEnabled) {
        // O(1) dedup by chunk id. The new bot already attaches a unique id to
        // every segment (track_<id>_<ts> for STT, caption_<seq>_<ts> for
        // captions). The old O(n)-per-insert similarity scan was kept for
        // safety against the legacy bot's chunk-overlap pattern; we keep a
        // tail similarity-check (last 5 entries only) for that case.
        const incomingChunk = segmentData.chunk;
        if (incomingChunk) {
          const seenIndex = existingTranscript._chunkIndex;
          if (seenIndex && seenIndex[incomingChunk]) {
            console.log(`🔄 Skipping duplicate segment ${segmentData.segmentNumber} for chunk ${incomingChunk}`);
            return currentMeeting;
          }
        }
        // Last-N similarity check protects against legacy chunk-overlap dupes
        // without scanning the whole transcript.
        const tail = existingTranscript.content.slice(-5);
        const similarDupe = tail.some((existing) => {
          const timeOverlap = Math.max(
            0,
            Math.min(existing.endTime || 0, segmentData.endTime || 0)
              - Math.max(existing.startTime || 0, segmentData.startTime || 0)
          );
          if (timeOverlap < 1) return false;
          return this.calculateTextSimilarity(existing.text || '', segmentText) > 0.8;
        });
        if (similarDupe) {
          console.log(`🔄 Skipping near-duplicate segment ${segmentData.segmentNumber}`);
          return currentMeeting;
        }
      }

      // Resolve session fields. Explicit segmentData wins; otherwise fall
      // back to the options bag; otherwise default to session 1 / now.
      const sessionNumber = Number(
        segmentData.session_number ?? options.sessionNumber ?? 1
      );
      const wallClockTs =
        segmentData.wall_clock_ts || options.wallClockTs || new Date().toISOString();

      // Create formatted segment data
      const formattedSegment = {
        timestamp: segmentData.timestamp || new Date().toISOString(),
        speaker: segmentData.speaker || 'Unknown',
        text: segmentText,
        startTime: segmentData.startTime || 0,
        endTime: segmentData.endTime || 0,
        confidence: segmentData.confidence,
        chunk: segmentData.chunk,
        segmentNumber: segmentData.segmentNumber,
        isRealTime: true,
        appendedAt: new Date().toISOString(),
        ...segmentData, // Include any additional fields
        // Session keys go AFTER the spread so they always reflect the
        // resolved values rather than whatever (possibly undefined) field
        // was passed in.
        session_number: sessionNumber,
        wall_clock_ts: wallClockTs,
      };

      // Append new segment to existing content
      existingTranscript.content.push(formattedSegment);

      // O(1) dedup index; consulted on the next insert. We only persist
      // chunk ids so the structure stays small (string set, not full
      // segments duplicated).
      if (dedupeEnabled) {
        if (!existingTranscript._chunkIndex) existingTranscript._chunkIndex = {};
        if (formattedSegment.chunk) {
          existingTranscript._chunkIndex[formattedSegment.chunk] = 1;
        }
      }

      // Update metadata
      const nowMs = Date.now();
      existingTranscript.lastUpdated = nowMs;
      existingTranscript.lastSegmentAtMs = nowMs;
      existingTranscript.totalSegments = existingTranscript.content.length;
      existingTranscript.lastSegmentTime = formattedSegment.timestamp;

      // Update the meeting with the enhanced transcript
      let result;
      try {
        result = await meetingJoinerService.updateTranscript(
          meetingJoinerId, 
          existingTranscript
        );
      } catch (dbError) {
        console.error(`💀 Database update error for meeting ${meetingJoinerId}:`, dbError.message);
        // Don't fail the whole process for database errors
        return null;
      }

      console.log(`✅ Appended segment ${segmentData.segmentNumber} to meeting ${meetingJoinerId}. Total segments: ${existingTranscript.totalSegments}`);
      
      return result;
      
    } catch (error) {
      console.error('Failed to append transcript segment:', error);
      // Don't throw error for transcript updates to avoid breaking meeting flow
      return null;
    }
  }

  /**
   * Session-aware convenience wrapper around `appendTranscriptSegment`.
   * Use this from the bot's per-session join lifecycle so the persisted
   * segment carries `session_number` + `wall_clock_ts` even when the
   * caller's segmentData payload does not.
   *
   * @param {string} meetingJoinerId
   * @param {object} segment             Segment payload (same shape as
   *                                     `appendTranscriptSegment`).
   * @param {object} [opts]
   * @param {number} [opts.sessionNumber=1]
   * @param {string} [opts.wallClockTs]  ISO-8601 timestamp; defaults to
   *                                     `new Date().toISOString()`.
   * @returns {Promise<*>} Result of the underlying writer.
   */
  async appendTranscriptSegmentWithSession(meetingJoinerId, segment, opts = {}) {
    const sessionNumber = Number(opts.sessionNumber ?? 1);
    const wallClockTs = opts.wallClockTs || new Date().toISOString();
    const enriched = {
      ...segment,
      session_number: segment?.session_number ?? sessionNumber,
      wall_clock_ts: segment?.wall_clock_ts || wallClockTs,
    };
    return this.appendTranscriptSegment(meetingJoinerId, enriched, {
      sessionNumber,
      wallClockTs,
    });
  }

  /**
   * Calculate text similarity between two strings
   * Returns a value between 0 and 1, where 1 is identical
   */
  calculateTextSimilarity(text1, text2) {
    const words1 = text1.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    const words2 = text2.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    
    if (words1.length === 0 && words2.length === 0) return 1;
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    return intersection.length / union.length;
  }
}

module.exports = new DBIntegration(); 
