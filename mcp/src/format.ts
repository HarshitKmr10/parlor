/**
 * Pure formatting helpers that render API entities into compact, readable text
 * for MCP `content` blocks. No side effects.
 */

import type {
  AskResponse,
  Citation,
  Meeting,
  MeetingDetail,
  Paginated,
  TranscriptSegment,
} from "./types.js";

/** Seconds → `m:ss` or `h:mm:ss`. */
export function formatTimestamp(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${ss}`;
  return `${m}:${ss}`;
}

function formatDuration(durationSec: number | undefined): string {
  if (typeof durationSec !== "number") return "—";
  const minutes = Math.round(durationSec / 60);
  return `${minutes}m`;
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + " ".repeat(width - value.length);
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

/** Render a list of meetings as a compact fixed-width table. */
export function formatMeetingList(page: Paginated<Meeting>): string {
  if (page.items.length === 0) {
    return "No meetings found.";
  }

  const header =
    `${pad("ID", 36)}  ${pad("STATUS", 10)}  ${pad("PLATFORM", 8)}  ` +
    `${pad("DUR", 6)}  TITLE`;
  const rows = page.items.map((m) => {
    return (
      `${pad(m.id, 36)}  ${pad(m.status, 10)}  ${pad(m.platform, 8)}  ` +
      `${pad(formatDuration(m.durationSec), 6)}  ${truncate(m.title, 60)}`
    );
  });

  const shown = page.items.length;
  const footer = `\nShowing ${shown} of ${page.total} (offset ${page.offset}).`;
  return [header, ...rows].join("\n") + footer;
}

/** Render a single meeting with its insights. */
export function formatMeetingDetail(meeting: MeetingDetail): string {
  const lines: string[] = [];
  lines.push(`# ${meeting.title}`);
  lines.push(
    `ID: ${meeting.id} · ${meeting.platform} · status: ${meeting.status}`,
  );
  if (meeting.startedAt) lines.push(`Started: ${meeting.startedAt}`);
  if (meeting.endedAt) lines.push(`Ended: ${meeting.endedAt}`);
  if (typeof meeting.durationSec === "number") {
    lines.push(`Duration: ${formatDuration(meeting.durationSec)}`);
  }

  if (meeting.participants.length > 0) {
    const names = meeting.participants.map((p) => p.name).join(", ");
    lines.push(`Participants: ${names}`);
  }

  const insights = meeting.insights;
  if (!insights) {
    lines.push("");
    lines.push(
      meeting.hasSummary
        ? "(Summary exists but was not included in this response.)"
        : "(No insights yet — meeting may not be summarized.)",
    );
    return lines.join("\n");
  }

  lines.push("");
  lines.push("## Summary");
  lines.push(insights.summary);

  if (insights.keyPoints.length > 0) {
    lines.push("");
    lines.push("## Key points");
    for (const point of insights.keyPoints) lines.push(`- ${point}`);
  }

  if (insights.actionItems.length > 0) {
    lines.push("");
    lines.push("## Action items");
    for (const item of insights.actionItems) {
      const check = item.done ? "[x]" : "[ ]";
      const who = item.assignee ? ` (@${item.assignee})` : "";
      const due = item.dueDate ? ` — due ${item.dueDate}` : "";
      lines.push(`- ${check} ${item.text}${who}${due}`);
    }
  }

  if (insights.chapters.length > 0) {
    lines.push("");
    lines.push("## Chapters");
    for (const chapter of insights.chapters) {
      lines.push(`- [${formatTimestamp(chapter.tStartSec)}] ${chapter.title}`);
    }
  }

  return lines.join("\n");
}

/** Render transcript segments with speaker + timestamp. */
export function formatTranscript(
  meetingId: string,
  segments: readonly TranscriptSegment[],
  lastSegmentAt: string | null,
): string {
  if (segments.length === 0) {
    return `No transcript segments for meeting ${meetingId}.`;
  }
  const lines = segments.map(
    (seg) =>
      `[${formatTimestamp(seg.tStartSec)}] ${seg.speakerName}: ${seg.text}`,
  );
  const footer = lastSegmentAt ? `\n\n(last segment at ${lastSegmentAt})` : "";
  return lines.join("\n") + footer;
}

function formatCitation(citation: Citation, index: number): string {
  return (
    `[${index + 1}] ${citation.speakerName} ` +
    `@ ${formatTimestamp(citation.tStartSec)}: ` +
    `"${truncate(citation.text, 200)}"`
  );
}

/** Render an ask answer with numbered citations + timestamps. */
export function formatAskResult(result: AskResponse): string {
  const lines: string[] = [result.answer];
  if (result.citations.length > 0) {
    lines.push("");
    lines.push("Citations:");
    result.citations.forEach((c, i) => lines.push(formatCitation(c, i)));
  } else {
    lines.push("");
    lines.push("(No citations returned.)");
  }
  return lines.join("\n");
}
