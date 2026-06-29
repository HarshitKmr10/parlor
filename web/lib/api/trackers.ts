import "server-only";

import { apiFetch } from "./client";
import type { Tracker, TrackerHitListResponse } from "./types";

export function listTrackers(): Promise<Tracker[]> {
  return apiFetch<Tracker[]>("/trackers", { cache: "no-store" });
}

export function listTrackerHits(trackerId?: string): Promise<TrackerHitListResponse> {
  const q = trackerId ? `?trackerId=${encodeURIComponent(trackerId)}` : "";
  return apiFetch<TrackerHitListResponse>(`/trackers/hits${q}`, { cache: "no-store" });
}

export function createTracker(input: { name: string; keywords: string[] }): Promise<Tracker> {
  return apiFetch<Tracker>("/trackers", { method: "POST", body: input });
}

export function updateTracker(
  id: string,
  input: { name?: string; keywords?: string[]; enabled?: boolean },
): Promise<Tracker> {
  return apiFetch<Tracker>(`/trackers/${id}`, { method: "PATCH", body: input });
}

export function deleteTracker(id: string): Promise<void> {
  return apiFetch<void>(`/trackers/${id}`, { method: "DELETE" });
}
