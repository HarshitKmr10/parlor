/**
 * Tests for URL Normalization Module (JavaScript)
 */

const UrlNormalizer = require('../src/shared/urlNormalizer');

describe('UrlNormalizer', () => {
  describe('Zoom URL Normalization', () => {
    test('should normalize Zoom URL with password', () => {
      const url1 = 'https://zoom.us/j/123456789?pwd=abc123';
      const url2 = 'https://us02web.zoom.us/j/123456789?pwd=abc123&trackingId=xyz';

      const normalized1 = UrlNormalizer.normalizeMeetingUrl(url1);
      const normalized2 = UrlNormalizer.normalizeMeetingUrl(url2);

      expect(normalized1).toBe('zoom://123456789?pwd=abc123');
      expect(normalized1).toBe(normalized2);
    });

    test('should normalize Zoom URL without password', () => {
      const url = 'https://zoom.us/j/987654321';
      const normalized = UrlNormalizer.normalizeMeetingUrl(url);
      expect(normalized).toBe('zoom://987654321');
    });

    test('should handle Zoom subdomain variations', () => {
      const url1 = 'https://zoom.us/j/111222333?pwd=pass1';
      const url2 = 'https://us02web.zoom.us/j/111222333?pwd=pass1';
      const url3 = 'https://us05web.zoom.us/j/111222333?pwd=pass1&extra=param';

      const normalized1 = UrlNormalizer.normalizeMeetingUrl(url1);
      const normalized2 = UrlNormalizer.normalizeMeetingUrl(url2);
      const normalized3 = UrlNormalizer.normalizeMeetingUrl(url3);

      expect(normalized1).toBe(normalized2);
      expect(normalized2).toBe(normalized3);
    });
  });

  describe('Teams URL Normalization', () => {
    test('should normalize Teams URL', () => {
      const url1 = 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc123';
      const url2 = 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc123?context=%7b%22Tid%22%3a%22xyz%22%7d';

      const normalized1 = UrlNormalizer.normalizeMeetingUrl(url1);
      const normalized2 = UrlNormalizer.normalizeMeetingUrl(url2);

      expect(normalized1).toBe('teams://19%3ameeting_abc123');
      expect(normalized1).toBe(normalized2);
    });

    test('should handle Teams domain variations', () => {
      const threadId = '19%3ameeting_xyz789';
      const url1 = `https://teams.microsoft.com/l/meetup-join/${threadId}`;
      const url2 = `https://teams.live.com/l/meetup-join/${threadId}`;
      const url3 = `https://teams.office.com/l/meetup-join/${threadId}`;

      const normalized1 = UrlNormalizer.normalizeMeetingUrl(url1);
      const normalized2 = UrlNormalizer.normalizeMeetingUrl(url2);
      const normalized3 = UrlNormalizer.normalizeMeetingUrl(url3);

      expect(normalized1).toBe(normalized2);
      expect(normalized2).toBe(normalized3);
      expect(normalized1).toBe(`teams://${threadId}`);
    });
  });

  describe('Google Meet URL Normalization', () => {
    test('should normalize Google Meet URL', () => {
      const url1 = 'https://meet.google.com/abc-defg-hij';
      const url2 = 'https://meet.google.com/abc-defg-hij?authuser=0';
      const url3 = 'https://meet.google.com/abc-defg-hij?hs=224';

      const normalized1 = UrlNormalizer.normalizeMeetingUrl(url1);
      const normalized2 = UrlNormalizer.normalizeMeetingUrl(url2);
      const normalized3 = UrlNormalizer.normalizeMeetingUrl(url3);

      expect(normalized1).toBe('googlemeet://abc-defg-hij');
      expect(normalized1).toBe(normalized2);
      expect(normalized2).toBe(normalized3);
    });
  });

  describe('isSameMeeting', () => {
    test('should identify same Zoom meetings', () => {
      const zoomUrl1 = 'https://zoom.us/j/123456789?pwd=abc';
      const zoomUrl2 = 'https://us02web.zoom.us/j/123456789?pwd=abc&trackingId=xyz';
      expect(UrlNormalizer.isSameMeeting(zoomUrl1, zoomUrl2)).toBe(true);
    });

    test('should identify different Zoom meetings', () => {
      const zoomUrl1 = 'https://zoom.us/j/123456789?pwd=abc';
      const zoomUrl3 = 'https://zoom.us/j/987654321?pwd=abc';
      expect(UrlNormalizer.isSameMeeting(zoomUrl1, zoomUrl3)).toBe(false);
    });

    test('should identify same Teams meetings', () => {
      const teamsUrl1 = 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc';
      const teamsUrl2 = 'https://teams.live.com/l/meetup-join/19%3ameeting_abc?context=xyz';
      expect(UrlNormalizer.isSameMeeting(teamsUrl1, teamsUrl2)).toBe(true);
    });

    test('should identify different Teams meetings', () => {
      const teamsUrl1 = 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc';
      const teamsUrl3 = 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_xyz';
      expect(UrlNormalizer.isSameMeeting(teamsUrl1, teamsUrl3)).toBe(false);
    });

    test('should identify meetings from different platforms as different', () => {
      const zoomUrl = 'https://zoom.us/j/123456789';
      const teamsUrl = 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc';
      expect(UrlNormalizer.isSameMeeting(zoomUrl, teamsUrl)).toBe(false);
    });
  });

  describe('Invalid URL Handling', () => {
    test('should handle empty string', () => {
      expect(UrlNormalizer.normalizeMeetingUrl('')).toBe('');
    });

    test('should handle null', () => {
      expect(UrlNormalizer.normalizeMeetingUrl(null)).toBe('');
    });

    test('should handle invalid URL format gracefully', () => {
      const result = UrlNormalizer.normalizeMeetingUrl('not-a-valid-url');
      expect(typeof result).toBe('string');
    });
  });

  describe('Unsupported Platforms', () => {
    test('should handle unsupported meeting platform', () => {
      const url = 'https://example.com/meeting/123';
      const normalized = UrlNormalizer.normalizeMeetingUrl(url);
      expect(normalized).toBe('example.com/meeting/123');
    });
  });
});
