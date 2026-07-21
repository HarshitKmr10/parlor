import "server-only";

import { apiFetch } from "./client";
import type { RedactionPreviewResponse, RedactionRule, RedactionRuleKind } from "./types";

export function listRedactionRules(): Promise<RedactionRule[]> {
  return apiFetch<RedactionRule[]>("/redaction/rules", { cache: "no-store" });
}

export function createRedactionRule(input: {
  name: string;
  kind: RedactionRuleKind;
  pattern: string;
  replacement?: string;
}): Promise<RedactionRule> {
  return apiFetch<RedactionRule>("/redaction/rules", { method: "POST", body: input });
}

export function updateRedactionRule(
  id: string,
  input: {
    name?: string;
    kind?: RedactionRuleKind;
    pattern?: string;
    replacement?: string;
    enabled?: boolean;
  },
): Promise<RedactionRule> {
  return apiFetch<RedactionRule>(`/redaction/rules/${id}`, { method: "PATCH", body: input });
}

export function deleteRedactionRule(id: string): Promise<void> {
  return apiFetch<void>(`/redaction/rules/${id}`, { method: "DELETE" });
}

export function previewRedaction(text: string): Promise<RedactionPreviewResponse> {
  return apiFetch<RedactionPreviewResponse>("/redaction/preview", {
    method: "POST",
    body: { text },
  });
}
