const platformRouter = require('./platformRouter');
const logger = require('../../shared/logger');
const UrlNormalizer = require('../shared/urlNormalizer');
const { getStore } = require('../db/js/store');

// Store factory picks the adapter (prisma | pg) from MEETING_JOINER_DB_DRIVER.
// Defaulting to prisma keeps monorepo behaviour byte-identical; standalone
// deployments flip to pg via env var and lose the core/ Prisma dependency.
const store = getStore();

class MeetingJoinerService {
  
  /**
   * Find existing ongoing meeting by normalized URL
   * @param {string} normalizedUrl - Normalized meeting URL
   * @param {string} orgId - Organization ID (optional filter)
   * @returns {Object|null} - Existing meeting joiner or null
   */
  async findExistingOngoingMeeting(normalizedUrl, orgId = null) {
    try {
      return await store.findExistingOngoing(normalizedUrl, orgId);
    } catch (error) {
      console.error('Error finding existing meeting:', error);
      return null;
    }
  }

  /**
   * Create a new meeting joiner record
   */
  async createMeetingJoiner({ meeting_url, org_id, meeting_id = null }) {
    try {
      // Detect and validate platform
      const platformInfo = platformRouter.getPlatformInfo(meeting_url);

      if (!platformInfo.supported) {
        throw new Error(`Unsupported meeting platform: ${platformInfo.name}`);
      }

      // Normalize the meeting URL for duplicate detection
      const normalizedUrl = UrlNormalizer.normalizeMeetingUrl(meeting_url);

      // Check if there's an existing ongoing meeting with the same normalized URL
      const existingMeeting = await this.findExistingOngoingMeeting(normalizedUrl, org_id);

      if (existingMeeting) {
        logger.info(`Found existing ongoing meeting ${existingMeeting.id}, creating linked duplicate record`);

        const duplicateMeetingJoiner = await store.createMeetingJoiner({
          meeting_url,
          normalized_meeting_url: normalizedUrl,
          org_id,
          meeting_id,
          status: 'ongoing',
          transcript: {},
          participants: existingMeeting.participants || [],
          original_meeting_id: existingMeeting.id,
          is_duplicate: true,
          // Inherit the ORIGINAL meeting's join time, not "now". A duplicate
          // record is just a linked view of the same live meeting; stamping
          // it with the current time made its duration a tiny fraction of the
          // real one. Fall back to now() only if the original somehow lacks it.
          bot_join_time: existingMeeting.bot_join_time || new Date(),
        });

        console.log(`Created duplicate meeting joiner record: ${duplicateMeetingJoiner.id} linked to original: ${existingMeeting.id}`);
        return {
          ...duplicateMeetingJoiner,
          platformInfo,
          isDuplicate: true,
          originalMeetingId: existingMeeting.id,
        };
      }

      const meetingJoiner = await store.createMeetingJoiner({
        meeting_url,
        normalized_meeting_url: normalizedUrl,
        org_id,
        meeting_id,
        status: 'not_joined',
        transcript: {},
        participants: [],
        is_duplicate: false,
      });

      console.log(`Created meeting joiner record: ${meetingJoiner.id} for platform: ${platformInfo.platform}`);
      return {
        ...meetingJoiner,
        platformInfo,
        isDuplicate: false,
      };
    } catch (error) {
      console.error('Error creating meeting joiner:', error);
      throw error;
    }
  }

  /**
   * Join a meeting using platform-specific logic
   */
  async joinMeeting(id, credentials = {}, options = {}) {
    try {
      const meetingJoiner = await this.getMeetingJoinerById(id);
      
      if (!meetingJoiner) {
        throw new Error(`Meeting joiner with ID ${id} not found`);
      }

      if (meetingJoiner.status !== 'not_joined') {
        throw new Error(`Meeting ${id} is already ${meetingJoiner.status}`);
      }

      logger.info(`Joining meeting ${id} on platform: ${meetingJoiner.platform}`);

      // Update status to ongoing before joining
      await this.updateStatus(id, 'ongoing');

      // Use platform router to join the meeting
      const joinResult = await platformRouter.joinMeeting(
        meetingJoiner.meeting_url,
        credentials,
        { ...options, meetingJoinerId: id }
      );

      logger.info(`Successfully joined meeting ${id}:`, joinResult);

      return {
        meetingJoiner,
        joinResult
      };

    } catch (error) {
      logger.error(`Error joining meeting ${id}:`, error);
      // Update status back to not_joined on failure
      await this.updateStatus(id, 'not_joined', { error: error.message });
      throw error;
    }
  }

  /**
   * Start recording/transcription for a meeting
   */
  async startRecording(id, options = {}) {
    try {
      const meetingJoiner = await this.getMeetingJoinerById(id);
      
      if (!meetingJoiner) {
        throw new Error(`Meeting joiner with ID ${id} not found`);
      }

      if (meetingJoiner.status !== 'ongoing') {
        throw new Error(`Meeting ${id} must be ongoing to start recording`);
      }

      logger.info(`Starting recording for meeting ${id} on platform: ${meetingJoiner.platform}`);

      // Use platform router to start stream scrapping/recording
      const recordingResult = await platformRouter.startStreamScrapping(
        meetingJoiner.meeting_url,
        id,
        options
      );

      logger.info(`Successfully started recording for meeting ${id}:`, recordingResult);

      return recordingResult;

    } catch (error) {
      logger.error(`Error starting recording for meeting ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update meeting joiner status
   */
  async updateStatus(id, status, additionalData = {}) {
    try {
      const meetingJoiner = await store.updateStatusAndTimestamps(id, status, additionalData);
      console.log(`Updated meeting joiner ${id} status to: ${status}`);
      return meetingJoiner;
    } catch (error) {
      console.error('Error updating meeting joiner status:', error);
      throw error;
    }
  }

  /**
   * Patch arbitrary scalar fields on a meeting_joiner row without
   * touching status. Used by recordExitReason so we can capture the
   * "why" early (from the bot's leave site) without racing the
   * Python orchestrator that owns the status flip.
   */
  async updateMeetingFields(id, fields = {}) {
    if (!id || !fields || Object.keys(fields).length === 0) return null;
    try {
      return await store.updateFields(id, fields);
    } catch (error) {
      console.error('Error patching meeting joiner fields:', error);
      throw error;
    }
  }

  /**
   * Filter transcript entries by timestamp
   * @param {Object} transcriptData - Full transcript object
   * @param {Date} fromTimestamp - Filter entries from this timestamp onwards
   * @returns {Object} - Filtered transcript data
   */
  filterTranscriptByTimestamp(transcriptData, fromTimestamp) {
    if (!transcriptData || !transcriptData.content || !Array.isArray(transcriptData.content)) {
      return transcriptData;
    }

    const fromTime = new Date(fromTimestamp).getTime();

    const filteredContent = transcriptData.content.filter(entry => {
      // Try multiple timestamp fields that might exist in transcript entries
      const entryTime = entry.timestamp || entry.appendedAt || entry.created_at;

      if (!entryTime) {
        return false; // Skip entries without timestamps
      }

      const entryTimeMs = new Date(entryTime).getTime();
      return entryTimeMs >= fromTime;
    });

    return {
      ...transcriptData,
      content: filteredContent,
      filteredFrom: fromTimestamp,
      originalCount: transcriptData.content.length,
      filteredCount: filteredContent.length
    };
  }

  /**
   * Update transcript in real-time (with connection reuse)
   */
  async updateTranscript(id, transcriptData) {
    try {
      const meetingJoiner = await this.getMeetingJoinerById(id);

      if (!meetingJoiner) {
        console.error(`Meeting joiner ${id} not found`);
        return null;
      }

      // If this is a duplicate meeting, only store transcripts from the request time onwards
      let finalTranscriptData = transcriptData;

      if (meetingJoiner.is_duplicate && meetingJoiner.bot_join_time) {
        finalTranscriptData = this.filterTranscriptByTimestamp(
          transcriptData,
          meetingJoiner.bot_join_time
        );
        logger.info(`Filtered transcript for duplicate meeting ${id}: ${finalTranscriptData.filteredCount}/${finalTranscriptData.originalCount} entries`);
      }

      const updatedMeetingJoiner = await store.updateTranscript(id, finalTranscriptData);

      // If this is an original meeting (not a duplicate), sync transcript to all its duplicates
      if (!meetingJoiner.is_duplicate) {
        // Fire and forget - don't wait for sync to complete
        this.syncTranscriptToDuplicates(id).catch(err => {
          console.error('Error in background transcript sync:', err);
        });
      }

      return updatedMeetingJoiner;
    } catch (error) {
      console.error('Error updating transcript:', error);
      // Don't throw on transcript updates to avoid breaking the flow
      return null;
    }
  }

  /**
   * Atomic, race-free transcript append. `mutate(currentTranscript)` runs
   * under a row lock (see pgStore.updateTranscriptAtomic) and returns the new
   * transcript, or null to make no change (duplicate segment). Returns the
   * literal `false` when the active store driver does not support atomic
   * append (e.g. the prisma driver) so the caller can fall back to the
   * non-atomic read-modify-write path. Returns the updated row on success,
   * or null when the mutate was a no-op.
   */
  async updateTranscriptAtomic(id, mutate) {
    if (typeof store.updateTranscriptAtomic !== 'function') return false;
    return store.updateTranscriptAtomic(id, mutate);
  }

  /**
   * Update participants list
   */
  async updateParticipants(id, participants) {
    try {
      const meetingJoiner = await this.getMeetingJoinerById(id);

      if (!meetingJoiner) {
        console.error(`Meeting joiner ${id} not found`);
        return null;
      }

      const updatedMeetingJoiner = await store.updateParticipants(id, participants);

      // If this is an original meeting, also update participants for all duplicates
      if (!meetingJoiner.is_duplicate) {
        await store.updateManyDuplicateParticipants(id, participants);
      }

      return updatedMeetingJoiner;
    } catch (error) {
      console.error('Error updating participants:', error);
      return null;
    }
  }

  /**
   * Sync transcript from original meeting to all its duplicates
   * This should be called whenever the original meeting's transcript is updated
   * @param {string} originalMeetingId - ID of the original meeting
   */
  async syncTranscriptToDuplicates(originalMeetingId) {
    try {
      const originalMeeting = await store.findUniqueBasic(originalMeetingId);
      if (!originalMeeting || !originalMeeting.transcript) return;

      const duplicateMeetings = await store.findActiveDuplicatesOf(originalMeetingId);
      if (duplicateMeetings.length === 0) return;

      logger.info(`Syncing transcript from original meeting ${originalMeetingId} to ${duplicateMeetings.length} duplicates`);

      for (const duplicate of duplicateMeetings) {
        if (duplicate.bot_join_time) {
          const filteredTranscript = this.filterTranscriptByTimestamp(
            originalMeeting.transcript,
            duplicate.bot_join_time
          );
          await store.updateFields(duplicate.id, {
            transcript: filteredTranscript,
            participants: originalMeeting.participants,
          });
          logger.info(`Updated duplicate meeting ${duplicate.id} with filtered transcript: ${filteredTranscript.filteredCount} entries`);
        }
      }
    } catch (error) {
      console.error('Error syncing transcript to duplicates:', error);
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Get meeting joiner by ID
   */
  async getMeetingJoinerById(id) {
    try {
      return await store.findUniqueWithRelations(id);
    } catch (error) {
      console.error('Error fetching meeting joiner:', error);
      return null;
    }
  }

  /**
   * Get all meeting joiners by organization
   */
  async getMeetingJoinersByOrg(org_id, status = null) {
    try {
      return await store.findManyByOrg(org_id, status);
    } catch (error) {
      console.error('Error fetching meeting joiners by org:', error);
      return [];
    }
  }

  /**
   * Get active (ongoing) meetings
   */
  async getActiveMeetings() {
    try {
      return await store.findActive();
    } catch (error) {
      console.error('Error fetching active meetings:', error);
      return [];
    }
  }

  /**
   * Set video link for completed meeting
   */
  async setVideoLink(id, video_link) {
    try {
      const meetingJoiner = await store.setVideoLink(id, video_link);
      console.log(`Set video link for meeting joiner ${id}`);
      return meetingJoiner;
    } catch (error) {
      console.error('Error setting video link:', error);
      return null;
    }
  }

  /**
   * Get supported meeting platforms
   */
  getSupportedPlatforms() {
    return platformRouter.getSupportedPlatforms();
  }

  /**
   * Get platform information for a meeting URL
   */
  getPlatformInfo(meetingUrl) {
    return platformRouter.getPlatformInfo(meetingUrl);
  }
}

// Handle graceful shutdown only when process exits
async function shutdown(signal) {
  console.log(`🔄 ${signal} received; disconnecting database...`);
  try { await store.disconnect(); } catch (err) { console.warn('disconnect failed:', err?.message); }
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = new MeetingJoinerService();