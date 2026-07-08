"""Render a meeting (summary/action items/transcript) as a Markdown document.

Markdown is the export format of choice here because it substantially covers
three asks at once: it's the native format Obsidian vaults read directly, and
Notion imports Markdown files natively too — neither needs a bespoke API
integration (which would require OAuth app registration this deployment
doesn't have credentials for).
"""

from __future__ import annotations

from typing import Optional

from .schemas import Meeting, MeetingInsights, TranscriptSegment

# Bound how much raw transcript gets inlined into the Markdown body so a
# multi-hour meeting doesn't produce an unwieldy multi-megabyte export; the
# rest is summarized by a note pointing back to the in-app transcript tab.
_MAX_INLINE_TRANSCRIPT_SEGMENTS = 200


def _format_timestamp(t_start_sec: float) -> str:
    total_seconds = max(0, int(t_start_sec))
    minutes, seconds = divmod(total_seconds, 60)
    hours, minutes = divmod(minutes, 60)
    if hours:
        return f"{hours}:{minutes:02d}:{seconds:02d}"
    return f"{minutes}:{seconds:02d}"


def _format_duration(duration_sec: Optional[int]) -> Optional[str]:
    if not duration_sec or duration_sec <= 0:
        return None
    minutes, seconds = divmod(int(duration_sec), 60)
    hours, minutes = divmod(minutes, 60)
    parts = []
    if hours:
        parts.append(f"{hours}h")
    if minutes:
        parts.append(f"{minutes}m")
    if not hours and not minutes:
        parts.append(f"{seconds}s")
    return " ".join(parts)


def _participant_names(meeting: Meeting) -> list[str]:
    return [p.name for p in meeting.participants if p.name]


def build_meeting_markdown(
    meeting: Meeting,
    insights: Optional[MeetingInsights],
    segments: list[TranscriptSegment],
) -> str:
    """Build a self-contained Markdown recap for one meeting.

    Every field pulled here is one the API contract already exposes on
    ``Meeting``/``MeetingInsights``/``TranscriptSegment`` — nothing invented.
    """
    lines: list[str] = []
    title = meeting.title or "Untitled meeting"
    lines.append(f"# {title}")
    lines.append("")

    when = meeting.started_at or meeting.scheduled_at or meeting.created_at
    if when is not None:
        lines.append(f"**Date:** {when.strftime('%Y-%m-%d %H:%M UTC')}")
    duration = _format_duration(meeting.duration_sec)
    if duration:
        lines.append(f"**Duration:** {duration}")
    if meeting.platform:
        lines.append(f"**Platform:** {meeting.platform}")
    participants = _participant_names(meeting)
    if participants:
        lines.append(f"**Participants:** {', '.join(participants)}")
    lines.append(f"**Status:** {meeting.status}")
    lines.append("")

    if insights and insights.summary:
        lines.append("## Summary")
        lines.append("")
        lines.append(insights.summary.strip())
        lines.append("")

    if insights and insights.key_points:
        lines.append("## Key Points")
        lines.append("")
        for point in insights.key_points:
            lines.append(f"- {point}")
        lines.append("")

    if insights and insights.action_items:
        lines.append("## Action Items")
        lines.append("")
        for item in insights.action_items:
            box = "x" if item.done else " "
            meta_parts = []
            if item.assignee:
                meta_parts.append(f"assignee: {item.assignee}")
            if item.due_date:
                meta_parts.append(f"due: {item.due_date}")
            meta = f" ({', '.join(meta_parts)})" if meta_parts else ""
            lines.append(f"- [{box}] {item.text}{meta}")
        lines.append("")

    if insights and insights.chapters:
        lines.append("## Chapters")
        lines.append("")
        for chapter in insights.chapters:
            stamp = (
                _format_timestamp(chapter.t_start_sec)
                if chapter.t_start_sec is not None
                else "?"
            )
            lines.append(f"- `{stamp}` {chapter.title}")
        lines.append("")

    if segments:
        lines.append("## Transcript")
        lines.append("")
        inline = segments[:_MAX_INLINE_TRANSCRIPT_SEGMENTS]
        for seg in inline:
            stamp = _format_timestamp(seg.t_start_sec)
            lines.append(f"**{seg.speaker_name}** _{stamp}_: {seg.text}")
            lines.append("")
        if len(segments) > len(inline):
            remaining = len(segments) - len(inline)
            lines.append(
                f"_…{remaining} more segment(s) omitted — view the full "
                "transcript in Parlor._"
            )
            lines.append("")
    elif not insights or (not insights.summary and not insights.action_items):
        lines.append(
            "_No summary or transcript is available for this meeting yet._"
        )
        lines.append("")

    lines.append("---")
    lines.append(
        "_Exported from Parlor. This Markdown file can be imported directly "
        "into Obsidian (drop it into a vault) or Notion (Import → Markdown)._"
    )
    return "\n".join(lines) + "\n"


def markdown_filename(meeting: Meeting) -> str:
    slug_source = meeting.title or meeting.id
    slug = "".join(
        ch if ch.isalnum() or ch in ("-", "_") else "-" for ch in slug_source.strip().lower()
    ).strip("-")
    slug = slug or "meeting"
    return f"{slug}.md"
