import "server-only";

import { apiFetch } from "./client";
import type { SummaryTemplate, SummaryTemplatePreset } from "./types";

export function listTemplates(): Promise<SummaryTemplate[]> {
  return apiFetch<SummaryTemplate[]>("/summary-templates", {
    cache: "no-store",
  });
}

export function listPresets(): Promise<SummaryTemplatePreset[]> {
  return apiFetch<SummaryTemplatePreset[]>("/summary-templates/presets", {
    cache: "no-store",
  });
}

export function createTemplate(input: {
  name: string;
  instructions: string;
  sections?: string[];
  isDefault?: boolean;
}): Promise<SummaryTemplate> {
  return apiFetch<SummaryTemplate>("/summary-templates", {
    method: "POST",
    body: input,
  });
}

export function updateTemplate(
  id: string,
  input: { name?: string; instructions?: string; sections?: string[]; isDefault?: boolean },
): Promise<SummaryTemplate> {
  return apiFetch<SummaryTemplate>(`/summary-templates/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteTemplate(id: string): Promise<void> {
  return apiFetch<void>(`/summary-templates/${id}`, { method: "DELETE" });
}
