/**
 * `get_transcript` tool — fetches transcript segments for a meeting
 * (`GET /api/v1/meetings/{id}/transcript?since=<ISO>`).
 */

import { z } from "zod";
import type { VerdantClient } from "../client.js";
import { formatTranscript } from "../format.js";
import { safeRun, textResult, type ToolResult } from "./shared.js";

export const getTranscriptShape = {
  meetingId: z.string().uuid().describe("UUID of the meeting."),
  since: z
    .string()
    .datetime()
    .optional()
    .describe(
      "ISO-8601 UTC timestamp; only return segments created at or after this time.",
    ),
} as const;

const inputSchema = z.object(getTranscriptShape);
export type GetTranscriptInput = z.infer<typeof inputSchema>;

export function handleGetTranscript(
  client: VerdantClient,
  input: GetTranscriptInput,
): Promise<ToolResult> {
  return safeRun(async () => {
    const result = await client.getTranscript(input.meetingId, input.since);
    return textResult(
      formatTranscript(input.meetingId, result.items, result.lastSegmentAt),
    );
  });
}
