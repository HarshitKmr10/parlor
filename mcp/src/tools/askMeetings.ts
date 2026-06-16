/**
 * `ask_meetings` tool — grounded Q&A over meeting knowledge with citations.
 *
 * The backend product API only exposes a per-meeting ask endpoint
 * (`POST /api/v1/meetings/{id}/ask`). There is no public cross-meeting ask
 * (the internal ai-service `/chat` supports an optional `meetingId`, but it is
 * not exposed publicly). So:
 *   - With `meetingId`: ask that meeting directly.
 *   - Without `meetingId`: pick the most relevant recent meeting (text overlap
 *     against the question, else the latest completed meeting), ask it, and
 *     prefix the answer with a note that the scope was narrowed to one meeting.
 */

import { z } from "zod";
import type { VerdantClient } from "../client.js";
import type { Meeting } from "../types.js";
import { formatAskResult } from "../format.js";
import { safeRun, textResult, errorResult, type ToolResult } from "./shared.js";

export const askMeetingsShape = {
  question: z
    .string()
    .min(1)
    .describe("Natural-language question to answer from meeting knowledge."),
  meetingId: z
    .string()
    .uuid()
    .optional()
    .describe(
      "Optional meeting UUID to scope the question to. If omitted, the most relevant recent meeting is chosen (cross-meeting ask is not yet supported by the backend).",
    ),
} as const;

const inputSchema = z.object(askMeetingsShape);
export type AskMeetingsInput = z.infer<typeof inputSchema>;

const CANDIDATE_LIMIT = 25;

/** Score a meeting by word overlap between its title and the question. */
function relevanceScore(meeting: Meeting, questionWords: Set<string>): number {
  const titleWords = meeting.title.toLowerCase().split(/\W+/).filter(Boolean);
  let score = 0;
  for (const word of titleWords) {
    if (questionWords.has(word)) score += 1;
  }
  return score;
}

function pickRelevantMeeting(
  meetings: readonly Meeting[],
  question: string,
): Meeting | undefined {
  if (meetings.length === 0) return undefined;
  const questionWords = new Set(
    question.toLowerCase().split(/\W+/).filter((w) => w.length > 2),
  );

  let best: Meeting | undefined;
  let bestScore = -1;
  for (const meeting of meetings) {
    const score = relevanceScore(meeting, questionWords);
    if (score > bestScore) {
      best = meeting;
      bestScore = score;
    }
  }

  if (best && bestScore > 0) return best;
  // No textual overlap — fall back to the most recent completed meeting,
  // else the first item (list is recency-ordered by the backend).
  return meetings.find((m) => m.status === "completed") ?? meetings[0];
}

export function handleAskMeetings(
  client: VerdantClient,
  input: AskMeetingsInput,
): Promise<ToolResult> {
  return safeRun(async () => {
    if (input.meetingId) {
      const result = await client.askMeeting(input.meetingId, input.question);
      return textResult(formatAskResult(result));
    }

    const page = await client.listMeetings({ limit: CANDIDATE_LIMIT });
    const target = pickRelevantMeeting(page.items, input.question);
    if (!target) {
      return errorResult(
        "No meetings available to answer the question. Specify a meetingId or ingest meetings first.",
      );
    }

    const result = await client.askMeeting(target.id, input.question);
    const note =
      `Note: cross-meeting ask is not supported by the backend yet, so this ` +
      `answer is scoped to the most relevant meeting: "${target.title}" ` +
      `(${target.id}). Pass an explicit meetingId to target another.\n\n`;
    return textResult(note + formatAskResult(result));
  });
}
