/**
 * `get_meeting` tool — fetches a meeting's detail plus insights
 * (`GET /api/v1/meetings/{id}`).
 */

import { z } from "zod";
import type { VerdantClient } from "../client.js";
import { formatMeetingDetail } from "../format.js";
import { safeRun, textResult, type ToolResult } from "./shared.js";

export const getMeetingShape = {
  meetingId: z
    .string()
    .uuid()
    .describe("UUID of the meeting to fetch."),
} as const;

const inputSchema = z.object(getMeetingShape);
export type GetMeetingInput = z.infer<typeof inputSchema>;

export function handleGetMeeting(
  client: VerdantClient,
  input: GetMeetingInput,
): Promise<ToolResult> {
  return safeRun(async () => {
    const meeting = await client.getMeeting(input.meetingId);
    return textResult(formatMeetingDetail(meeting));
  });
}
