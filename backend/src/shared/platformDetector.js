/**
 * Platform Detection Service
 * Detects meeting platform (MS Teams, Zoom, etc.) from meeting URL
 */

class PlatformDetector {
  
  /**
   * Detect platform from meeting URL
   * @param {string} meetingUrl - The meeting URL to analyze
   * @returns {string} - Platform name: 'msteams', 'zoom', 'unknown'
   */
  static detectPlatform(meetingUrl) {
    if (!meetingUrl || typeof meetingUrl !== 'string') {
      return 'unknown';
    }

    const url = meetingUrl.toLowerCase().trim();

    // MS Teams patterns
    const teamsPatterns = [
      /teams\.microsoft\.com/,
      /teams\.live\.com/,
      /teams\.office\.com/,
      /microsoftteams:/
    ];

    // Zoom patterns
    const zoomPatterns = [
      /zoom\.us/,
      /zoom\.com/,
      /zoomgov\.com/,
      /zoommtg:/
    ];

    // Google Meet patterns
    const googleMeetPatterns = [
      /meet\.google\.com/,
      /hangouts\.google\.com\/call/
    ];

    // Check for MS Teams
    if (teamsPatterns.some(pattern => pattern.test(url))) {
      return 'msteams';
    }

    // Check for Zoom
    if (zoomPatterns.some(pattern => pattern.test(url))) {
      return 'zoom';
    }

    // Check for Google Meet
    if (googleMeetPatterns.some(pattern => pattern.test(url))) {
      return 'googlemeet';
    }

    return 'unknown';
  }

  /**
   * Get platform-specific configuration
   * @param {string} platform - Platform name
   * @returns {object} - Platform configuration
   */
  static getPlatformConfig(platform) {
    const configs = {
      msteams: {
        name: 'Microsoft Teams',
        supportedFeatures: ['join', 'record', 'transcribe'],
        modulePath: 'msteams'
      },
      zoom: {
        name: 'Zoom',
        supportedFeatures: ['join', 'record', 'transcribe'],
        modulePath: null  // Handled by Python Zoom SDK service, not Node.js
      },
      googlemeet: {
        name: 'Google Meet',
        supportedFeatures: ['join', 'record', 'transcribe'],
        modulePath: 'googlemeet'
      },
      unknown: {
        name: 'Unknown Platform',
        supportedFeatures: [],
        modulePath: null
      }
    };

    return configs[platform] || configs.unknown;
  }

  /**
   * Validate if platform is supported
   * @param {string} platform - Platform name
   * @returns {boolean} - Whether platform is supported
   */
  static isSupported(platform) {
    const supportedPlatforms = ['msteams', 'zoom', 'googlemeet'];
    return supportedPlatforms.includes(platform);
  }

  /**
   * Get supported platforms list
   * @returns {array} - List of supported platforms
   */
  static getSupportedPlatforms() {
    return [
      { key: 'msteams', name: 'Microsoft Teams' },
      { key: 'zoom', name: 'Zoom' },
      { key: 'googlemeet', name: 'Google Meet' }
    ];
  }
}

module.exports = PlatformDetector;
