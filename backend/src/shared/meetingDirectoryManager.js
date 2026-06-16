const path = require('path');
const fs = require('fs');

class MeetingDirectoryManager {
  constructor() {
    this.meetingDirectories = new Map(); // meetingId -> directory path
  }

  /**
   * Get or create a consistent meeting directory for a meeting ID
   */
  getMeetingDirectory(meetingId) {
    // Check if we already have a directory for this meeting
    if (this.meetingDirectories.has(meetingId)) {
      return this.meetingDirectories.get(meetingId);
    }

    // Create new directory using meeting ID (not timestamp)
    const baseDir = path.resolve(__dirname, '..', 'bot', 'meeting_data');
    const meetingDir = path.join(baseDir, meetingId);
    
    // Ensure directory exists
    if (!fs.existsSync(meetingDir)) {
      fs.mkdirSync(meetingDir, { recursive: true });
    }

    // Store for future use
    this.meetingDirectories.set(meetingId, meetingDir);
    console.log(`📁 Meeting directory created/retrieved: ${meetingDir}`);
    
    return meetingDir;
  }

  /**
   * Clean up old meeting directories
   */
  cleanupOldDirectories(maxAgeHours = 24) {
    const baseDir = path.resolve(__dirname, '..', 'bot', 'meeting_data');
    
    if (!fs.existsSync(baseDir)) return;

    const now = Date.now();
    const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds

    try {
      const directories = fs.readdirSync(baseDir);
      
      directories.forEach(dir => {
        const dirPath = path.join(baseDir, dir);
        const stats = fs.statSync(dirPath);
        
        if (stats.isDirectory() && (now - stats.mtimeMs) > maxAge) {
          console.log(`🗑️ Cleaning up old meeting directory: ${dir}`);
          fs.rmSync(dirPath, { recursive: true, force: true });
        }
      });
    } catch (error) {
      console.error('Error cleaning up old directories:', error);
    }
  }

  /**
   * Get all subdirectories for a meeting
   */
  getMeetingSubDirectories(meetingId) {
    const baseDir = this.getMeetingDirectory(meetingId);
    
    return {
      base: baseDir,
      audioChunks: path.join(baseDir, 'audio_chunks'),
      transcripts: path.join(baseDir, 'transcripts'),
      recordings: path.join(baseDir, 'recordings'),
      csv: path.join(baseDir, 'csv_data')
    };
  }
}

// Export singleton instance
module.exports = new MeetingDirectoryManager();