/**
 * Registers all Verdant tools on an McpServer instance. Kept separate from
 * server bootstrap so it can be unit/smoke tested without a transport.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { VerdantClient } from "../client.js";

import { searchMeetingsShape, handleSearchMeetings } from "./searchMeetings.js";
import { getMeetingShape, handleGetMeeting } from "./getMeeting.js";
import { getTranscriptShape, handleGetTranscript } from "./getTranscript.js";
import { askMeetingsShape, handleAskMeetings } from "./askMeetings.js";

export function registerTools(server: McpServer, client: VerdantClient): void {
  server.registerTool(
    "search_meetings",
    {
      title: "Search meetings",
      description:
        "List recent or matching meetings in the workspace. Supports an optional free-text query (matched on title/participants), a status filter, and a limit.",
      inputSchema: searchMeetingsShape,
    },
    (input) => handleSearchMeetings(client, input),
  );

  server.registerTool(
    "get_meeting",
    {
      title: "Get meeting detail",
      description:
        "Fetch a single meeting's details and AI insights (summary, key points, action items, chapters) by its UUID.",
      inputSchema: getMeetingShape,
    },
    (input) => handleGetMeeting(client, input),
  );

  server.registerTool(
    "get_transcript",
    {
      title: "Get meeting transcript",
      description:
        "Fetch transcript segments (speaker, timestamp, text) for a meeting. Optionally only segments since a given ISO-8601 timestamp.",
      inputSchema: getTranscriptShape,
    },
    (input) => handleGetTranscript(client, input),
  );

  server.registerTool(
    "ask_meetings",
    {
      title: "Ask meetings",
      description:
        "Ask a natural-language question and get a grounded answer with citations (speaker + timestamp). Scope to a meeting via meetingId; otherwise the most relevant recent meeting is used.",
      inputSchema: askMeetingsShape,
    },
    (input) => handleAskMeetings(client, input),
  );
}

export const TOOL_NAMES = [
  "search_meetings",
  "get_meeting",
  "get_transcript",
  "ask_meetings",
] as const;
