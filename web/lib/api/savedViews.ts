import "server-only";

import { apiFetch } from "./client";
import type { SavedView } from "./types";

export function listSavedViews(): Promise<SavedView[]> {
  return apiFetch<SavedView[]>("/saved-views", { cache: "no-store" });
}

export function createSavedView(input: {
  name: string;
  query?: string;
  filters?: Record<string, unknown>;
}): Promise<SavedView> {
  return apiFetch<SavedView>("/saved-views", { method: "POST", body: input });
}

export function updateSavedView(
  id: string,
  input: {
    name?: string;
    query?: string;
    filters?: Record<string, unknown>;
  },
): Promise<SavedView> {
  return apiFetch<SavedView>(`/saved-views/${id}`, { method: "PATCH", body: input });
}

export function deleteSavedView(id: string): Promise<void> {
  return apiFetch<void>(`/saved-views/${id}`, { method: "DELETE" });
}
