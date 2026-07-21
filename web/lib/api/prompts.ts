import "server-only";

import { apiFetch } from "./client";
import type { SavedPrompt } from "./types";

export function listPrompts(): Promise<SavedPrompt[]> {
  return apiFetch<SavedPrompt[]>("/prompts", { cache: "no-store" });
}

export function createPrompt(input: {
  title: string;
  body: string;
}): Promise<SavedPrompt> {
  return apiFetch<SavedPrompt>("/prompts", { method: "POST", body: input });
}

export function updatePrompt(
  id: string,
  input: {
    title?: string;
    body?: string;
  },
): Promise<SavedPrompt> {
  return apiFetch<SavedPrompt>(`/prompts/${id}`, { method: "PATCH", body: input });
}

export function deletePrompt(id: string): Promise<void> {
  return apiFetch<void>(`/prompts/${id}`, { method: "DELETE" });
}
