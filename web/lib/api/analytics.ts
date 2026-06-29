import "server-only";

import { apiFetch } from "./client";
import type { MeetingAnalytics } from "./types";

/** Conversation analytics (talk-time, interactivity, sentiment) for a meeting. */
export function getMeetingAnalytics(id: string): Promise<MeetingAnalytics> {
  return apiFetch<MeetingAnalytics>(`/meetings/${id}/analytics`, {
    cache: "no-store",
  });
}
