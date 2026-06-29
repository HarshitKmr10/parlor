import "server-only";

import { apiFetch } from "./client";
import type { DigestPreferences } from "./types";

export function getDigestPreferences(): Promise<DigestPreferences> {
  return apiFetch<DigestPreferences>("/digest-preferences", { cache: "no-store" });
}

export function putDigestPreferences(
  input: Omit<DigestPreferences, "lastSentAt">,
): Promise<DigestPreferences> {
  return apiFetch<DigestPreferences>("/digest-preferences", {
    method: "PUT",
    body: input,
  });
}

export function sendTestDigest(): Promise<{ delivered: boolean; detail: string }> {
  return apiFetch("/digest-preferences/test", { method: "POST" });
}
