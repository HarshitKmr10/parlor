import "server-only";

import { apiFetch } from "./client";
import type { NlpSettings } from "./types";

export function getNlpSettings(): Promise<NlpSettings> {
  return apiFetch<NlpSettings>("/nlp-settings", { cache: "no-store" });
}

export function putNlpSettings(input: NlpSettings): Promise<NlpSettings> {
  return apiFetch<NlpSettings>("/nlp-settings", { method: "PUT", body: input });
}
