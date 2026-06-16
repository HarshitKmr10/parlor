"""
URL Normalization Module for Meeting URLs

This module provides functionality to normalize meeting URLs
to extract core meeting identifiers for duplicate detection.
"""

import re
from urllib.parse import urlparse, parse_qs
from typing import Optional


class UrlNormalizer:
    """URL normalization utilities for meeting platforms"""

    @classmethod
    def normalize_meeting_url(cls, meeting_url: str) -> str:
        """
        Normalize a meeting URL to extract the core meeting identifier.
        This removes tracking parameters and standardizes the URL format.

        Args:
            meeting_url: The original meeting URL

        Returns:
            Normalized meeting identifier
        """
        if not meeting_url or not isinstance(meeting_url, str):
            return ""

        try:
            parsed = urlparse(meeting_url)
            hostname = parsed.hostname.lower() if parsed.hostname else ""
            pathname = parsed.path

            # Normalize based on platform
            if cls._is_zoom_url(hostname):
                return cls._normalize_zoom_url(parsed)
            elif cls._is_teams_url(hostname):
                return cls._normalize_teams_url(parsed)
            elif cls._is_google_meet_url(hostname):
                return cls._normalize_google_meet_url(parsed)

            # Default: use hostname + pathname
            return f"{hostname}{pathname}"
        except Exception as e:
            # If URL parsing fails, return the original URL
            return meeting_url

    @classmethod
    def _is_zoom_url(cls, hostname: str) -> bool:
        """Check if URL is a Zoom meeting URL"""
        return bool(re.search(r"zoom\.(us|com)$", hostname))

    @classmethod
    def _is_teams_url(cls, hostname: str) -> bool:
        """Check if URL is a Microsoft Teams meeting URL"""
        return bool(re.search(r"teams\.(microsoft|live|office)\.com$", hostname))

    @classmethod
    def _is_google_meet_url(cls, hostname: str) -> bool:
        """Check if URL is a Google Meet URL"""
        return bool(
            re.search(r"meet\.google\.com$", hostname)
            or re.search(r"hangouts\.google\.com$", hostname)
        )

    @classmethod
    def _normalize_zoom_url(cls, parsed_url) -> str:
        """
        Normalize Zoom URL
        Format: zoom.us/j/{meeting_id}?pwd={password}
        We keep meeting ID and password, remove other params
        """
        meeting_id_match = re.search(r"/j/(\d+)", parsed_url.path)
        meeting_id = meeting_id_match.group(1) if meeting_id_match else ""

        query_params = parse_qs(parsed_url.query)
        password = query_params.get("pwd", [""])[0]

        if meeting_id:
            return f"zoom://{meeting_id}?pwd={password}" if password else f"zoom://{meeting_id}"

        # Fallback to pathname if no meeting ID found
        return f"zoom://{parsed_url.path}"

    @classmethod
    def _normalize_teams_url(cls, parsed_url) -> str:
        """
        Normalize Teams URL
        Format: teams.microsoft.com/l/meetup-join/{encoded_thread_id}
        We extract the thread ID portion and ignore other parameters
        """
        path_match = re.search(r"/l/meetup-join/([^/]+)", parsed_url.path)

        if path_match:
            thread_id = path_match.group(1)
            return f"teams://{thread_id}"

        # Fallback to full pathname
        return f"teams://{parsed_url.path}"

    @classmethod
    def _normalize_google_meet_url(cls, parsed_url) -> str:
        """
        Normalize Google Meet URL
        Format: meet.google.com/{meeting_code}
        The meeting code is the unique identifier
        """
        meeting_code_match = re.search(r"/([a-z]{3}-[a-z]{4}-[a-z]{3})", parsed_url.path)

        if meeting_code_match:
            meeting_code = meeting_code_match.group(1)
            return f"googlemeet://{meeting_code}"

        # Handle hangouts call format
        if "hangouts" in parsed_url.hostname:
            call_id_match = re.search(r"/call/([^/]+)", parsed_url.path)
            if call_id_match:
                return f"googlemeet://{call_id_match.group(1)}"

        # Fallback to pathname
        return f"googlemeet://{parsed_url.path}"

    @classmethod
    def is_same_meeting(cls, url1: str, url2: str) -> bool:
        """
        Compare two meeting URLs to check if they refer to the same meeting.

        Args:
            url1: First meeting URL
            url2: Second meeting URL

        Returns:
            True if URLs refer to the same meeting
        """
        normalized1 = cls.normalize_meeting_url(url1)
        normalized2 = cls.normalize_meeting_url(url2)

        return normalized1 == normalized2 and normalized1 != ""
