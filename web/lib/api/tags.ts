import "server-only";

import { apiFetch } from "./client";
import type { Tag } from "./types";

export function listTags(): Promise<Tag[]> {
  return apiFetch<Tag[]>("/tags", { cache: "no-store" });
}

export function createTag(input: { name: string; color?: string }): Promise<Tag> {
  return apiFetch<Tag>("/tags", { method: "POST", body: input });
}

export function deleteTag(id: string): Promise<void> {
  return apiFetch<void>(`/tags/${id}`, { method: "DELETE" });
}

export function getMeetingTags(meetingId: string): Promise<Tag[]> {
  return apiFetch<Tag[]>(`/tags/meetings/${meetingId}`, { cache: "no-store" });
}

export function setMeetingTags(meetingId: string, tagIds: string[]): Promise<Tag[]> {
  return apiFetch<Tag[]>(`/tags/meetings/${meetingId}`, {
    method: "PUT",
    body: { tagIds },
  });
}
