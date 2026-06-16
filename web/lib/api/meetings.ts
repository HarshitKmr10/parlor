import "server-only";

import { apiFetch } from "./client";
import type {
  AskResponse,
  ChatTurn,
  CreateMeetingInput,
  Meeting,
  MeetingDetail,
  MeetingInsights,
  MeetingStatus,
  Paginated,
  TranscriptResponse,
} from "./types";

type ListMeetingsParams = {
  status?: MeetingStatus;
  limit?: number;
  offset?: number;
};

function toQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function listMeetings(
  params: ListMeetingsParams = {},
): Promise<Paginated<Meeting>> {
  const { status, limit = 20, offset = 0 } = params;
  return apiFetch<Paginated<Meeting>>(
    `/meetings${toQuery({ status, limit, offset })}`,
    { cache: "no-store" },
  );
}

export function getMeeting(id: string): Promise<MeetingDetail> {
  return apiFetch<MeetingDetail>(`/meetings/${id}`, { cache: "no-store" });
}

export function createMeeting(input: CreateMeetingInput): Promise<Meeting> {
  return apiFetch<Meeting>("/meetings", { method: "POST", body: input });
}

export function deleteMeeting(id: string): Promise<Meeting> {
  return apiFetch<Meeting>(`/meetings/${id}`, { method: "DELETE" });
}

export function getTranscript(
  id: string,
  since?: string,
): Promise<TranscriptResponse> {
  return apiFetch<TranscriptResponse>(
    `/meetings/${id}/transcript${toQuery({ since })}`,
    { cache: "no-store" },
  );
}

export function summarizeMeeting(id: string): Promise<MeetingInsights> {
  return apiFetch<MeetingInsights>(`/meetings/${id}/summarize`, {
    method: "POST",
  });
}

export function askMeeting(
  id: string,
  question: string,
  history?: ChatTurn[],
): Promise<AskResponse> {
  return apiFetch<AskResponse>(`/meetings/${id}/ask`, {
    method: "POST",
    body: { question, history },
  });
}
