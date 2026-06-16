/**
 * URL Normalization Module for Meeting URLs
 *
 * This module provides functionality to normalize meeting URLs
 * to extract core meeting identifiers for duplicate detection.
 */

const { URL } = require('url');

class UrlNormalizer {
  /**
   * Normalize a meeting URL to extract the core meeting identifier
   * This removes tracking parameters and standardizes the URL format
   *
   * @param {string} meetingUrl - The original meeting URL
   * @returns {string} - Normalized meeting identifier
   */
  static normalizeMeetingUrl(meetingUrl) {
    if (!meetingUrl || typeof meetingUrl !== 'string') {
      return '';
    }

    try {
      const url = new URL(meetingUrl);
      const hostname = url.hostname.toLowerCase();
      const pathname = url.pathname;

      // Normalize based on platform
      if (this.isZoomUrl(hostname)) {
        return this.normalizeZoomUrl(url);
      } else if (this.isTeamsUrl(hostname)) {
        return this.normalizeTeamsUrl(url);
      } else if (this.isGoogleMeetUrl(hostname)) {
        return this.normalizeGoogleMeetUrl(url);
      }

      // Default: use hostname + pathname
      return `${hostname}${pathname}`;
    } catch (error) {
      console.error('Error normalizing URL:', error);
      // If URL parsing fails, return the original URL
      return meetingUrl;
    }
  }

  /**
   * Check if URL is a Zoom meeting URL
   */
  static isZoomUrl(hostname) {
    return /zoom\.(us|com)$/.test(hostname);
  }

  /**
   * Check if URL is a Microsoft Teams meeting URL
   */
  static isTeamsUrl(hostname) {
    return /teams\.(microsoft|live|office)\.com$/.test(hostname);
  }

  /**
   * Check if URL is a Google Meet URL
   */
  static isGoogleMeetUrl(hostname) {
    return /meet\.google\.com$/.test(hostname) ||
           /hangouts\.google\.com$/.test(hostname);
  }

  /**
   * Normalize Zoom URL
   * Format: zoom.us/j/{meeting_id}?pwd={password}
   * We keep meeting ID and password, remove other params
   */
  static normalizeZoomUrl(url) {
    const meetingIdMatch = url.pathname.match(/\/j\/(\d+)/);
    const meetingId = meetingIdMatch ? meetingIdMatch[1] : '';
    const password = url.searchParams.get('pwd') || '';

    if (meetingId) {
      return password
        ? `zoom://${meetingId}?pwd=${password}`
        : `zoom://${meetingId}`;
    }

    // Fallback to pathname if no meeting ID found
    return `zoom://${url.pathname}`;
  }

  /**
   * Normalize Teams URL
   * Format: teams.microsoft.com/l/meetup-join/{encoded_thread_id}
   * We extract the thread ID portion and ignore other parameters
   */
  static normalizeTeamsUrl(url) {
    // Extract the meetup-join path portion which contains the unique meeting identifier
    const pathMatch = url.pathname.match(/\/l\/meetup-join\/([^\/]+)/);

    if (pathMatch) {
      const threadId = pathMatch[1];
      return `teams://${threadId}`;
    }

    // Fallback to full pathname
    return `teams://${url.pathname}`;
  }

  /**
   * Normalize Google Meet URL
   * Format: meet.google.com/{meeting_code}
   * The meeting code is the unique identifier
   */
  static normalizeGoogleMeetUrl(url) {
    const meetingCodeMatch = url.pathname.match(/\/([a-z]{3}-[a-z]{4}-[a-z]{3})/);

    if (meetingCodeMatch) {
      const meetingCode = meetingCodeMatch[1];
      return `googlemeet://${meetingCode}`;
    }

    // Handle hangouts call format
    if (url.hostname.includes('hangouts')) {
      const callIdMatch = url.pathname.match(/\/call\/([^\/]+)/);
      if (callIdMatch) {
        return `googlemeet://${callIdMatch[1]}`;
      }
    }

    // Fallback to pathname
    return `googlemeet://${url.pathname}`;
  }

  /**
   * Compare two meeting URLs to check if they refer to the same meeting
   *
   * @param {string} url1 - First meeting URL
   * @param {string} url2 - Second meeting URL
   * @returns {boolean} - True if URLs refer to the same meeting
   */
  static isSameMeeting(url1, url2) {
    const normalized1 = this.normalizeMeetingUrl(url1);
    const normalized2 = this.normalizeMeetingUrl(url2);

    return normalized1 === normalized2 && normalized1 !== '';
  }
}

module.exports = UrlNormalizer;
