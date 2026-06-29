import "server-only";

import { apiFetch } from "./client";
import type { ActionItemListResponse, ActionItemRecord } from "./types";

/** Cross-meeting task tracker. */
export function listWorkspaceActionItems(
  params: { assignee?: string; done?: boolean } = {},
): Promise<ActionItemListResponse> {
  const search = new URLSearchParams();
  if (params.assignee) search.set("assignee", params.assignee);
  if (params.done !== undefined) search.set("done", String(params.done));
  const query = search.toString();
  return apiFetch<ActionItemListResponse>(
    `/action-items${query ? `?${query}` : ""}`,
    { cache: "no-store" },
  );
}

export function listMeetingActionItems(
  meetingId: string,
): Promise<ActionItemListResponse> {
  return apiFetch<ActionItemListResponse>(
    `/meetings/${meetingId}/action-items`,
    { cache: "no-store" },
  );
}

export function updateActionItem(
  itemId: string,
  input: { done?: boolean; assignee?: string; text?: string; dueDate?: string },
): Promise<ActionItemRecord> {
  return apiFetch<ActionItemRecord>(`/action-items/${itemId}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteActionItem(itemId: string): Promise<void> {
  return apiFetch<void>(`/action-items/${itemId}`, { method: "DELETE" });
}
