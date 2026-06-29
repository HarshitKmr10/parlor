import "server-only";

import { apiFetch } from "./client";
import type { CoachingScorecard } from "./types";

export function getMeetingCoaching(id: string): Promise<CoachingScorecard> {
  return apiFetch<CoachingScorecard>(`/meetings/${id}/coaching`, {
    cache: "no-store",
  });
}
