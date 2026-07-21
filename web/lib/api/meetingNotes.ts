import "server-only";

import { apiFetch } from "./client";
import type { MeetingNote } from "./types";

export function getMeetingNote(meetingId: string): Promise<MeetingNote> {
  return apiFetch<MeetingNote>(`/meeting-notes/${meetingId}`, {
    cache: "no-store",
  });
}

export function putMeetingNote(
  meetingId: string,
  body: string,
): Promise<MeetingNote> {
  return apiFetch<MeetingNote>(`/meeting-notes/${meetingId}`, {
    method: "PUT",
    body: { body },
  });
}
