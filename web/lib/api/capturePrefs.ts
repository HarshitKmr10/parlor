import "server-only";

import { apiFetch } from "./client";
import type { CapturePrefs } from "./types";

export function getCapturePrefs(): Promise<CapturePrefs> {
  return apiFetch<CapturePrefs>("/capture-prefs", { cache: "no-store" });
}

export function putCapturePrefs(input: CapturePrefs): Promise<CapturePrefs> {
  return apiFetch<CapturePrefs>("/capture-prefs", { method: "PUT", body: input });
}
