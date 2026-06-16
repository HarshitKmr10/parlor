require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const PlatformRouter = require('../services/platformRouter');
const { uploadToAzure } = require('../storage/azureStorage');
const { RealTimeMeetingProcessor } = require('./transcribeProcessor');
const { parseCSV } = require('./mapTranscriptstoSpeakers');

let uploader = null;
function getUploader() {
  if (!uploader) {
    uploader = new uploadToAzure(process.env.AZURE_STORAGE_CONNECTION_STRING);
  }
  return uploader;
}

// Initialize platform router (it's exported as a singleton)
const platformRouter = require('../services/platformRouter');

// Lazy-required so this module can still be loaded by tooling that
// doesn't have dbIntegration's deps.
let _dbIntegration = null;
function _getDbIntegration() {
  if (_dbIntegration !== null) return _dbIntegration;
  try { _dbIntegration = require('../storage/dbIntegration'); }
  catch (_) { _dbIntegration = false; }
  return _dbIntegration || null;
}

// Reads the meeting_joiner row's transcript_source column (set at
// meeting creation time via the dashboard toggle / API request) so the
// worker can forward it to the platform bot. null = bot uses platform
// default. Returns null on error rather than failing the whole join.
async function _readTranscriptSource(meetingId) {
  const db = _getDbIntegration();
  if (!db || !meetingId) return null;
  if (typeof db.getMeetingTranscriptSource === 'function') {
    try { return await db.getMeetingTranscriptSource(meetingId); }
    catch (_) { return null; }
  }
  // Fallback: walk the canonical getter and pluck the field.
  if (typeof db.getMeeting === 'function') {
    try {
      const m = await db.getMeeting(meetingId);
      return m?.transcript_source || null;
    } catch (_) { return null; }
  }
  return null;
}

async function processMeetingWithArgs(meetingUrl, meetingId, botName = 'Meeting Bot') {
  const realTimeProcessor = new RealTimeMeetingProcessor(meetingId);
  
  try {
    console.log(`Processing meeting: ${meetingId}`);
    console.log(`Meeting URL: ${meetingUrl}`);
    console.log(`🎙️ Transcription provider: ${realTimeProcessor.streamingTranscriber.provider}`);

    // Start real-time transcription processing (before joining meeting)
    console.log('🚀 Initializing real-time transcription system...');
    
    // Create a meeting directory for this session
    const datetime = Date.now().toString();
    const meetingDir = path.resolve(
      path.join(__dirname, 'meeting_data'),
      datetime
    );
    
    if (!fs.existsSync(meetingDir)) {
      fs.mkdirSync(meetingDir, { recursive: true });
    }

    // Join the meeting using platform router with real-time transcription
    console.log('🤖 Joining meeting with real-time transcription...');
    const localMp4Path = await joinMeetingWithRealTimeTranscription(
      meetingUrl,
      botName,
      realTimeProcessor,
      meetingDir,
      meetingId
    );
    
    await new Promise(res => setTimeout(res, 2000));
    
    // Check if the bot returned a valid path
    if (!localMp4Path || localMp4Path === 'NoFile') {
      console.log("Bot completed but no recording was made (possibly left early due to being alone)");
      
      // Stop real-time processing
      await realTimeProcessor.stopRealTimeProcessing();
      
      return {
        success: true, // Still consider this success since bot joined
        message: "Meeting joined successfully but ended early (no other participants)",
        videoLink: null,
        mappedTranscriptLink: null
      };
    }
    
    if (!fs.existsSync(localMp4Path)) {
      console.log("Bot joined meeting but recording file not found:", localMp4Path);
      
      // Stop real-time processing
      await realTimeProcessor.stopRealTimeProcessing();
      
      return {
        success: true, // Bot joined successfully, just no recording
        message: "Meeting joined successfully but no recording available",
        videoLink: null,
        mappedTranscriptLink: null
      };
    }
    
    console.log('📹 Local MP4 file recorded at:', localMp4Path);

    // Stop real-time processing now that meeting is over
    console.log('🛑 Stopping real-time transcription...');
    await realTimeProcessor.stopRealTimeProcessing();

    // Upload video to storage (Azure or AWS based on LLM_PROVIDER).
    // RECORDING_UPLOAD_DISABLED=true skips both the MP4 and mapped-transcript
    // uploads — for local e2e runs where storage churn isn't wanted.
    const recordingUploadDisabled = (process.env.RECORDING_UPLOAD_DISABLED || 'false').toLowerCase() === 'true';
    const provider = process.env.LLM_PROVIDER || 'openai';
    const storageType = (provider === 'aws_transcribe' || provider === 'bedrock') ? 'AWS S3' : 'Azure Blob Storage';

    let videoLink = null;
    let mappedTranscriptLink = null;
    const finalResults = realTimeProcessor.getFinalResults(meetingId);

    if (recordingUploadDisabled) {
      console.log('☁️ Recording upload disabled (RECORDING_UPLOAD_DISABLED=true) — skipping MP4 + transcript upload to', storageType);
    } else {
      console.log(`☁️ Uploading video to ${storageType}...`);
      const storageUploader = getUploader();
      const containerName = 'meeting-joiner';
      const remoteVideoPath = `meetings/${meetingId}/video.mp4`;
      videoLink = await storageUploader.uploadFile(localMp4Path, containerName, remoteVideoPath);

      // Save and upload the mapped transcript
      const mappedTranscriptPath = path.join(path.dirname(localMp4Path), 'mapped_transcripts.json');
      fs.writeFileSync(mappedTranscriptPath, JSON.stringify(finalResults, null, 2), 'utf8');
      const remoteMappedPath = `meetings/${meetingId}/mapped_transcripts.json`;
      mappedTranscriptLink = await storageUploader.uploadFile(mappedTranscriptPath, containerName, remoteMappedPath);
    }

    console.log('✅ Meeting processed with real-time transcription!');
    console.log('🎥 Video link:', videoLink);
    console.log('📝 Transcript link:', mappedTranscriptLink);
    console.log(`🎙️ Real-time stats: ${finalResults.totalChunks} chunks processed during meeting`);
    
    // **NEW: Save video link and final data to database**
    try {
      const dbIntegration = require('../storage/dbIntegration');
      
      // Save video link to database
      if (videoLink) {
        await dbIntegration.setVideoRecordingLink(meetingId, videoLink);
        console.log('💾 Video link saved to database');
      }
      
      // Update participants in database if we have them
      const participantsPath = path.join(path.dirname(localMp4Path), 'meeting-info.csv');
      if (fs.existsSync(participantsPath)) {
        const participantRecords = await parseCSV(participantsPath);
        if (participantRecords.length > 0) {
          // Extract unique participant names
          const participantNames = new Set();
          participantRecords.forEach(record => {
            const participants = record.Participants || record.participants || '';
            participants.split(';').forEach(p => {
              const name = p.split(' - ')[0].trim();
              if (name && !name.toLowerCase().includes('bot')) {
                participantNames.add(name);
              }
            });
          });
          
          const participantsList = Array.from(participantNames).map(name => ({
            name,
            joinedAt: new Date().toISOString(), 
            source: 'csv_extraction'
          }));
          
          await dbIntegration.updateParticipants(meetingId, participantsList);
          console.log(`💾 Updated ${participantsList.length} participants in database`);
        }
      }
      
      // Mark meeting as completed
      await dbIntegration.completeMeeting(meetingId, videoLink);
      console.log('💾 Meeting marked as completed in database');
      
    } catch (dbError) {
      console.error('❌ Error updating database:', dbError);
      // Don't fail the whole process for database errors
    }
    
    return {
      success: true,
      message: "Meeting fully processed with real-time transcription",
      videoLink,
      mappedTranscriptLink,
      transcriptionStats: {
        provider: finalResults.provider,
        model: finalResults.model,
        chunks: finalResults.totalChunks,
        processedInRealTime: true
      }
    };
  } catch (error) {
    console.error('Error in processMeetingWithArgs:', error);
    
    // Make sure to stop real-time processing on error
    try {
      await realTimeProcessor.stopRealTimeProcessing();
    } catch (stopError) {
      console.error('Error stopping real-time processor:', stopError);
    }
    
    // Check if it's a transcription provider error
    if (error.message.includes('Missing') && error.message.includes('API')) {
      return {
        success: false,
        message: `Transcription provider error: ${error.message}. Please check your LLM provider configuration.`,
        videoLink: null,
        mappedTranscriptLink: null
      };
    }
    
    return {
      success: false,
      message: `Processing error: ${error.message}`,
      videoLink: null,
      mappedTranscriptLink: null
    };
  }
}

// Enhanced meeting join function that includes real-time transcription
async function joinMeetingWithRealTimeTranscription(meetingUrl, username, realTimeProcessor, meetingDir, meetingId) {
  // Start real-time transcription before joining
  const dynamicCsvPath = path.join(meetingDir, 'dynamic-data.csv');
  const meetingStartTime = new Date();
  
  // Parse CSV for speaker mapping (we'll update this as the meeting progresses)
  let csvRecords = [];
  
  // **NEW: Periodic CSV update for real-time speaker mapping**
  let csvUpdateInterval;
  const startCsvUpdates = () => {
    csvUpdateInterval = setInterval(async () => {
      try {
        if (fs.existsSync(dynamicCsvPath)) {
          const newRecords = await parseCSV(dynamicCsvPath);
          if (newRecords.length > csvRecords.length) {
            console.log(`📊 Updated CSV records: ${csvRecords.length} → ${newRecords.length}`);
            csvRecords = newRecords;
            
            // Update the real-time processor with new speaker mapping data
            if (realTimeProcessor.updateSpeakerMappingData) {
              realTimeProcessor.updateSpeakerMappingData(csvRecords, meetingStartTime);
            }
          }
        }
      } catch (error) {
        console.error('❌ Error updating CSV records:', error);
      }
    }, 5000); // Update every 5 seconds
  };
  
  // Custom callback for external integrations (websockets, APIs, etc.)
  const externalCallback = async (chunkData) => {
    console.log(`🌐 Real-time chunk available: ${chunkData.chunk} (${chunkData.text?.substring(0, 50)}...)`);
    
    // Here you can add websocket emissions, API calls, etc.
    // Example: 
    // websocketManager.emit('realtime-transcript', chunkData);
    // await apiClient.sendRealtimeUpdate(meetingId, chunkData);
  };

  // Start real-time processing
  await realTimeProcessor.startRealTimeProcessing(
    meetingDir,
    csvRecords,
    meetingStartTime,
    [externalCallback],
    meetingId  // Pass meeting ID for database updates
  );

  // Start CSV updates
  startCsvUpdates();

  // Read the per-meeting transcript_source set at creation time (via
  // the dashboard toggle or API). null means "use platform default".
  // The bot's joinMeeting normalizers honor options.transcriptSource
  // and fall back to env / default when null.
  const transcriptSource = await _readTranscriptSource(meetingId);
  if (transcriptSource) {
    console.log(`📜 Using per-meeting transcript_source = ${transcriptSource}`);
  }

  // Call the platform router to join the appropriate meeting type
  console.log(`🔍 Detecting platform for URL: ${meetingUrl}`);
  const joinResult = await platformRouter.joinMeeting(
    meetingUrl,
    { name: username },
    { realTimeProcessor, meetingDbId: meetingId, transcriptSource },
  );
  console.log(`✅ Platform router result:`, joinResult);
  
  let localMp4Path = null;

  // Handle different platforms - Zoom, Teams, and Google Meet handle recording/transcription inside joinMeeting()
  if (joinResult.platform === 'zoom') {
    console.log('🎥 Zoom recording and transcription handled inside joinMeeting()');
    localMp4Path = joinResult.localMp4Path || joinResult.filePath || joinResult.fileName || 'NoFile';
  } else if (joinResult.platform === 'googlemeet') {
    // Google Meet uses Playwright-based recording with Web Audio API capture
    console.log('🎥 Google Meet recording and transcription handled inside joinMeeting()');
    // Google Meet doesn't have video recording yet - audio chunks are processed in real-time
    // savePath is a directory, not a file, so we return 'NoFile' to skip video upload
    localMp4Path = 'NoFile';
  } else {
    // Teams has integrated recording, extract path from result
    console.log('🎥 Teams recording and transcription handled inside joinMeeting()');
    localMp4Path = joinResult.localMp4Path || joinResult.filePath || 'NoFile';
  }
  
  // Stop CSV updates
  if (csvUpdateInterval) {
    clearInterval(csvUpdateInterval);
  }
  
  // Final CSV update after meeting
  if (fs.existsSync(dynamicCsvPath)) {
    csvRecords = await parseCSV(dynamicCsvPath);
    console.log(`📊 Final CSV load: ${csvRecords.length} participant records for speaker mapping`);
    
    // **NEW: Reprocess real-time results with complete participant data**
    if (csvRecords.length > 0) {
      console.log('🔄 Refining real-time transcript with complete participant data...');
      await realTimeProcessor.refineWithCompleteParticipantData(csvRecords, meetingStartTime);
    }
  } else {
    console.warn('⚠️ No dynamic-data.csv found - speaker mapping may be limited');
  }
  
  return localMp4Path;
}

// Get command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node meetingProcessor.js <meeting_url> <meeting_id> [bot_name]');
  process.exit(1);
}

const meetingUrl = args[0];
const meetingId = args[1];
const botName = args[2] || 'Service Desk AI';  // Use provided bot name or default

console.log(`Meeting URL: ${meetingUrl}`);
console.log(`Meeting ID: ${meetingId}`);
console.log(`Bot Name: ${botName}`);

// Process the meeting
processMeetingWithArgs(meetingUrl, meetingId, botName).then(result => {
  if (result && result.success) {
    console.log('Meeting processing completed:', result.message || 'Successfully');
    if (result.videoLink) {
      console.log('Video available at:', result.videoLink);
    }
    if (result.mappedTranscriptLink) {
      console.log('Transcript available at:', result.mappedTranscriptLink);
    }
    process.exit(0);
  } else {
    console.error('Meeting processing failed:', result ? result.message : 'Unknown error');
    process.exit(1);
  }
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

// Handle graceful shutdown signals
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0); // Exit with success code
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0); // Exit with success code
});
