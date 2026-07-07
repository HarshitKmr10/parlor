/**
 * `search_meetings` tool — lists recent/matching meetings via
 * `GET /api/v1/meetings`, optionally narrowing by a free-text `query` applied
 * client-side over title / participant names (the backend list endpoint has no
 * text search). Server-side `status` filter and `limit` are passed through.
 */

import { z } from "zod";
import type { ParlorClient } from "../client.js";
import type { Meeting, MeetingStatus } from "../types.js";
import { formatMeetingList } from "../format.js";
import { safeRun, textResult, type ToolResult } from "./shared.js";

const MEETING_STATUSES = [
  "scheduled",
  "joining",
  "ongoing",
  "completed",
  "failed",
] as const satisfies readonly MeetingStatus[];

export const searchMeetingsShape = {
  query: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Optional free-text filter matched client-side against meeting title and participant names.",
    ),
  status: z
    .enum(MEETING_STATUSES)
    .optional()
    .describe("Filter by meeting status (passed to the backend)."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Maximum number of meetings to return (1-100, default 20)."),
} as const;

const inputSchema = z.object(searchMeetingsShape);
export type SearchMeetingsInput = z.infer<typeof inputSchema>;

function matchesQuery(meeting: Meeting, needle: string): boolean {
  const haystack = [
    meeting.title,
    ...meeting.participants.map((p) => p.name),
    ...meeting.participants.map((p) => p.email ?? ""),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

export function handleSearchMeetings(
  client: ParlorClient,
  input: SearchMeetingsInput,
): Promise<ToolResult> {
  return safeRun(async () => {
    const limit = input.limit ?? 20;
    const params: Parameters<ParlorClient["listMeetings"]>[0] = input.status
      ? { limit, status: input.status }
      : { limit };

    const page = await client.listMeetings(params);

    if (!input.query) {
      return textResult(formatMeetingList(page));
    }

    const needle = input.query.toLowerCase();
    const filtered = page.items.filter((m) => matchesQuery(m, needle));
    return textResult(
      formatMeetingList({
        items: filtered,
        total: filtered.length,
        limit: page.limit,
        offset: page.offset,
      }),
    );
  });
}
