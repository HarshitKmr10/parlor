import "server-only";

import { apiFetch } from "./client";
import type { SearchResponse } from "./types";

/** Cross-meeting keyword search over titles, transcripts and summaries. */
export function searchMeetings(
  q: string,
  params: { limit?: number; offset?: number } = {},
): Promise<SearchResponse> {
  const { limit = 20, offset = 0 } = params;
  const search = new URLSearchParams({
    q,
    limit: String(limit),
    offset: String(offset),
  });
  return apiFetch<SearchResponse>(`/search?${search.toString()}`, {
    cache: "no-store",
  });
}
