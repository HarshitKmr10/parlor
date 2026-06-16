/**
 * Platform Router Service
 * Routes meeting operations to the appropriate platform-specific module
 */

const PlatformDetector = require('../shared/platformDetector');
const logger = require('../../shared/logger');

class PlatformRouter {
  
  constructor() {
    this.platformModules = new Map();
  }

  /**
   * Get platform module for a given platform
   * @param {string} platform - Platform name
   * @returns {object} - Platform module
   */
  getPlatformModule(platform) {
    if (!this.platformModules.has(platform)) {
      try {
        const config = PlatformDetector.getPlatformConfig(platform);
        logger.info(`Getting config for platform ${platform}:`, config);
        
        if (config.modulePath) {
          const modulePath = `../bot/bot_scripts/${config.modulePath}/joinMeeting`;
          logger.info(`Loading module from path: ${modulePath}`);
          
          const module = require(modulePath);
          logger.info(`Module loaded successfully. Exported functions:`, Object.keys(module));
          
          // Validate that joinMeeting function exists
          if (typeof module.joinMeeting !== 'function') {
            throw new Error(`Module for ${platform} does not export joinMeeting function. Available exports: ${Object.keys(module).join(', ')}`);
          }
          
          this.platformModules.set(platform, module);
          logger.info(`✅ Successfully loaded and cached ${platform} module`);
        } else {
          throw new Error(`No module path for platform: ${platform}`);
        }
      } catch (error) {
        logger.error(`Failed to load module for platform ${platform}:`, error);
        throw error;
      }
    }
    
    return this.platformModules.get(platform);
  }

  /**
   * Join a meeting using the appropriate platform module
   * @param {string} meetingUrl - Meeting URL
   * @param {object} credentials - Platform credentials
   * @param {object} options - Additional options
   * @returns {Promise<object>} - Join result
   */
  async joinMeeting(meetingUrl, credentials = {}, options = {}) {
    try {
      const platform = PlatformDetector.detectPlatform(meetingUrl);
      logger.info(`🔍 Detected platform: ${platform} for meeting URL: ${meetingUrl}`);
      
      if (!PlatformDetector.isSupported(platform)) {
        throw new Error(`Unsupported platform: ${platform} for URL: ${meetingUrl}`);
      }

      logger.info(`📋 Credentials:`, { 
        name: credentials.name || 'not provided',
        keys: Object.keys(credentials) 
      });
      logger.info(`⚙️ Options:`, {
        botName: options.botName || 'not provided',
        keys: Object.keys(options)
      });
      
      const platformModule = this.getPlatformModule(platform);
      logger.info(`🎯 Platform module loaded. Calling joinMeeting function...`);
      
      // Call platform-specific join method
      const result = await platformModule.joinMeeting(meetingUrl, credentials, options);
      logger.info(`✅ Platform module joinMeeting completed successfully`);
      
      return {
        platform,
        ...result
      };
      
    } catch (error) {
      logger.error('❌ Error in platform router joinMeeting:', error);
      throw error;
    }
  }

  /**
   * Start stream scrapping using the appropriate platform module
   * @param {string} meetingUrl - Meeting URL
   * @param {string} meetingId - Meeting ID
   * @param {object} options - Additional options
   * @returns {Promise<object>} - Stream scrapping result
   */
  async startStreamScrapping(meetingUrl, meetingId, options = {}) {
    try {
      const platform = PlatformDetector.detectPlatform(meetingUrl);
      
      if (!PlatformDetector.isSupported(platform)) {
        throw new Error(`Unsupported platform: ${platform} for URL: ${meetingUrl}`);
      }

      logger.info(`Starting stream scrapping for platform: ${platform}`);
      
      // Get the stream scrapping module
      const streamModule = require(`../bot/bot_scripts/${platform}/streamScrapping`);
      
      const result = await streamModule.startStreamScrapping(meetingId, options);
      
      return {
        platform,
        ...result
      };
      
    } catch (error) {
      logger.error('Error in platform router startStreamScrapping:', error);
      throw error;
    }
  }

  /**
   * Get platform information for a meeting URL
   * @param {string} meetingUrl - Meeting URL
   * @returns {object} - Platform information
   */
  getPlatformInfo(meetingUrl) {
    const platform = PlatformDetector.detectPlatform(meetingUrl);
    const config = PlatformDetector.getPlatformConfig(platform);
    
    return {
      platform,
      name: config.name,
      supported: PlatformDetector.isSupported(platform),
      supportedFeatures: config.supportedFeatures
    };
  }

  /**
   * Get list of all supported platforms
   * @returns {array} - Supported platforms
   */
  getSupportedPlatforms() {
    return PlatformDetector.getSupportedPlatforms();
  }
}

// Export singleton instance
module.exports = new PlatformRouter();
