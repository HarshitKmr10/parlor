import "server-only";

import { apiFetch } from "./client";
import type {
  CreateHighlightInput,
  Highlight,
  HighlightListResponse,
  WorkspaceHighlightListResponse,
} from "./types";

export function listMeetingHighlights(
  meetingId: string,
): Promise<HighlightListResponse> {
  return apiFetch<HighlightListResponse>(
    `/meetings/${meetingId}/highlights`,
    { cache: "no-store" },
  );
}

export function createHighlight(
  meetingId: string,
  input: CreateHighlightInput,
): Promise<Highlight> {
  return apiFetch<Highlight>(`/meetings/${meetingId}/highlights`, {
    method: "POST",
    body: input,
  });
}

export function deleteHighlight(
  meetingId: string,
  highlightId: string,
): Promise<void> {
  return apiFetch<void>(`/meetings/${meetingId}/highlights/${highlightId}`, {
    method: "DELETE",
  });
}

/** The cross-meeting highlights reel. */
export function listWorkspaceHighlights(
  params: { limit?: number; offset?: number } = {},
): Promise<WorkspaceHighlightListResponse> {
  const { limit = 50, offset = 0 } = params;
  const search = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  return apiFetch<WorkspaceHighlightListResponse>(
    `/highlights?${search.toString()}`,
    { cache: "no-store" },
  );
}
