"""
Tests for URL Normalization Module
"""

import pytest
from shared.url_normalizer import UrlNormalizer


class TestUrlNormalizer:
    """Test URL normalization for various meeting platforms"""

    def test_zoom_url_normalization(self):
        """Test Zoom URL normalization"""
        # Standard Zoom URL with password
        url1 = "https://zoom.us/j/123456789?pwd=abc123"
        url2 = "https://us02web.zoom.us/j/123456789?pwd=abc123&trackingId=xyz"
        normalized1 = UrlNormalizer.normalize_meeting_url(url1)
        normalized2 = UrlNormalizer.normalize_meeting_url(url2)

        assert normalized1 == "zoom://123456789?pwd=abc123"
        assert normalized1 == normalized2, "URLs with different tracking params should normalize to same value"

    def test_zoom_url_without_password(self):
        """Test Zoom URL without password"""
        url = "https://zoom.us/j/987654321"
        normalized = UrlNormalizer.normalize_meeting_url(url)
        assert normalized == "zoom://987654321"

    def test_zoom_subdomain_variations(self):
        """Test Zoom URLs with different subdomains"""
        url1 = "https://zoom.us/j/111222333?pwd=pass1"
        url2 = "https://us02web.zoom.us/j/111222333?pwd=pass1"
        url3 = "https://us05web.zoom.us/j/111222333?pwd=pass1&extra=param"

        normalized1 = UrlNormalizer.normalize_meeting_url(url1)
        normalized2 = UrlNormalizer.normalize_meeting_url(url2)
        normalized3 = UrlNormalizer.normalize_meeting_url(url3)

        assert normalized1 == normalized2 == normalized3

    def test_teams_url_normalization(self):
        """Test Microsoft Teams URL normalization"""
        url1 = "https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc123"
        url2 = "https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc123?context=%7b%22Tid%22%3a%22xyz%22%7d"

        normalized1 = UrlNormalizer.normalize_meeting_url(url1)
        normalized2 = UrlNormalizer.normalize_meeting_url(url2)

        assert normalized1 == "teams://19%3ameeting_abc123"
        assert normalized1 == normalized2, "Teams URLs with different context should normalize to same value"

    def test_teams_domain_variations(self):
        """Test Teams URLs with different domains"""
        thread_id = "19%3ameeting_xyz789"
        url1 = f"https://teams.microsoft.com/l/meetup-join/{thread_id}"
        url2 = f"https://teams.live.com/l/meetup-join/{thread_id}"
        url3 = f"https://teams.office.com/l/meetup-join/{thread_id}"

        normalized1 = UrlNormalizer.normalize_meeting_url(url1)
        normalized2 = UrlNormalizer.normalize_meeting_url(url2)
        normalized3 = UrlNormalizer.normalize_meeting_url(url3)

        # All should normalize to the same value
        assert normalized1 == normalized2 == normalized3
        assert normalized1 == f"teams://{thread_id}"

    def test_google_meet_url_normalization(self):
        """Test Google Meet URL normalization"""
        url1 = "https://meet.google.com/abc-defg-hij"
        url2 = "https://meet.google.com/abc-defg-hij?authuser=0"
        url3 = "https://meet.google.com/abc-defg-hij?hs=224"

        normalized1 = UrlNormalizer.normalize_meeting_url(url1)
        normalized2 = UrlNormalizer.normalize_meeting_url(url2)
        normalized3 = UrlNormalizer.normalize_meeting_url(url3)

        assert normalized1 == "googlemeet://abc-defg-hij"
        assert normalized1 == normalized2 == normalized3

    def test_is_same_meeting(self):
        """Test the is_same_meeting comparison function"""
        # Same Zoom meeting
        zoom_url1 = "https://zoom.us/j/123456789?pwd=abc"
        zoom_url2 = "https://us02web.zoom.us/j/123456789?pwd=abc&trackingId=xyz"
        assert UrlNormalizer.is_same_meeting(zoom_url1, zoom_url2) is True

        # Different Zoom meetings
        zoom_url3 = "https://zoom.us/j/987654321?pwd=abc"
        assert UrlNormalizer.is_same_meeting(zoom_url1, zoom_url3) is False

        # Same Teams meeting
        teams_url1 = "https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc"
        teams_url2 = "https://teams.live.com/l/meetup-join/19%3ameeting_abc?context=xyz"
        assert UrlNormalizer.is_same_meeting(teams_url1, teams_url2) is True

        # Different Teams meetings
        teams_url3 = "https://teams.microsoft.com/l/meetup-join/19%3ameeting_xyz"
        assert UrlNormalizer.is_same_meeting(teams_url1, teams_url3) is False

        # Different platforms
        assert UrlNormalizer.is_same_meeting(zoom_url1, teams_url1) is False

    def test_invalid_urls(self):
        """Test handling of invalid URLs"""
        assert UrlNormalizer.normalize_meeting_url("") == ""
        assert UrlNormalizer.normalize_meeting_url(None) == ""
        assert UrlNormalizer.normalize_meeting_url("not-a-url") == "not-a-url"

    def test_unsupported_platform(self):
        """Test handling of unsupported meeting platforms"""
        url = "https://example.com/meeting/123"
        normalized = UrlNormalizer.normalize_meeting_url(url)
        # Should return hostname + pathname
        assert normalized == "example.com/meeting/123"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
