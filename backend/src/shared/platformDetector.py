"""
Platform Detection Module for Meeting URLs

This module provides functionality to detect meeting platforms from URLs
and validate if they are supported by the meeting joiner service.
"""

import re
from typing import Dict, List, Optional


class PlatformDetector:
    """Platform detection and configuration for meeting URLs"""

    # Platform configurations
    PLATFORMS = {
        "msteams": {
            "name": "Microsoft Teams",
            "patterns": [
                r"teams\.microsoft\.com",
                r"teams\.live\.com",
                r"teams\.office\.com",
            ],
            "supported_features": ["join", "record", "transcribe"],
        },
        "zoom": {
            "name": "Zoom",
            "patterns": [
                r"zoom\.us",
                r"[\w\d]+\.zoom\.us",  # Matches subdomains like us02web.zoom.us
                r"zoom\.com",
            ],
            "supported_features": ["join", "record", "transcribe"],
        },
        "googlemeet": {
            "name": "Google Meet",
            "patterns": [
                r"meet\.google\.com",
                r"hangouts\.google\.com/call",
            ],
            "supported_features": ["join", "record", "transcribe"],
        },
    }

    @classmethod
    def detect_platform(cls, url: str) -> str:
        """
        Detect the meeting platform from a URL

        Args:
            url: Meeting URL to analyze

        Returns:
            Platform identifier ('msteams', 'zoom', 'googlemeet', or 'unknown')
        """
        if not url or not isinstance(url, str):
            return "unknown"

        url_lower = url.lower()

        for platform_id, config in cls.PLATFORMS.items():
            for pattern in config["patterns"]:
                if re.search(pattern, url_lower):
                    return platform_id

        return "unknown"

    @classmethod
    def is_supported(cls, platform: str) -> bool:
        """
        Check if a platform is supported

        Args:
            platform: Platform identifier

        Returns:
            True if platform is supported, False otherwise
        """
        return platform in cls.PLATFORMS

    @classmethod
    def get_platform_config(cls, platform: str) -> Optional[Dict]:
        """
        Get configuration for a specific platform

        Args:
            platform: Platform identifier

        Returns:
            Platform configuration dictionary or None if not found
        """
        return cls.PLATFORMS.get(platform)

    @classmethod
    def get_supported_platforms(cls) -> List[str]:
        """
        Get list of all supported platform identifiers

        Returns:
            List of supported platform identifiers
        """
        return list(cls.PLATFORMS.keys())

    @classmethod
    def is_valid_meeting_url(cls, url: str) -> bool:
        """
        Validate if URL is a supported meeting URL

        Args:
            url: Meeting URL to validate

        Returns:
            True if URL is from a supported platform, False otherwise
        """
        platform = cls.detect_platform(url)
        return cls.is_supported(platform)


# For backward compatibility - standalone validation functions
def is_valid_teams_url(url: str) -> bool:
    """Validate if URL is a valid Microsoft Teams meeting URL (legacy function)"""
    return PlatformDetector.detect_platform(url) == "msteams"


def is_valid_zoom_url(url: str) -> bool:
    """Validate if URL is a valid Zoom meeting URL"""
    return PlatformDetector.detect_platform(url) == "zoom"


def is_valid_googlemeet_url(url: str) -> bool:
    """Validate if URL is a valid Google Meet meeting URL"""
    return PlatformDetector.detect_platform(url) == "googlemeet"


def is_valid_meeting_url(url: str) -> bool:
    """Validate if URL is from any supported meeting platform"""
    return PlatformDetector.is_valid_meeting_url(url)
