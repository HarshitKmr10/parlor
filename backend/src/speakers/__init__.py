"""Speaker identity profiles: map diarized labels to named people."""

from .resolve import apply_speaker_profiles, build_alias_map
from .repo import SpeakerProfilesRepo

__all__ = ["apply_speaker_profiles", "build_alias_map", "SpeakerProfilesRepo"]
