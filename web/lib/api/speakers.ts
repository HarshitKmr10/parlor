import "server-only";

import { apiFetch } from "./client";
import type { SpeakerProfile } from "./types";

export function listSpeakerProfiles(): Promise<SpeakerProfile[]> {
  return apiFetch<SpeakerProfile[]>("/speaker-profiles", { cache: "no-store" });
}

export function createSpeakerProfile(input: {
  displayName: string;
  email?: string;
  aliases: string[];
}): Promise<SpeakerProfile> {
  return apiFetch<SpeakerProfile>("/speaker-profiles", {
    method: "POST",
    body: input,
  });
}

export function updateSpeakerProfile(
  id: string,
  input: { displayName?: string; email?: string; aliases?: string[] },
): Promise<SpeakerProfile> {
  return apiFetch<SpeakerProfile>(`/speaker-profiles/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteSpeakerProfile(id: string): Promise<void> {
  return apiFetch<void>(`/speaker-profiles/${id}`, { method: "DELETE" });
}
