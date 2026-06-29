import type { Metadata } from "next";
import Link from "next/link";
import { listTemplates, listPresets } from "@/lib/api/summary-templates";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import type { SummaryTemplate, SummaryTemplatePreset } from "@/lib/api/types";
import { TemplatesManager } from "@/components/settings/TemplatesManager";
import { BackendDownState } from "@/components/ui/BackendDownState";

export const metadata: Metadata = {
  title: "Summary templates — Verdant",
};

export default async function TemplatesPage() {
  let templates: SummaryTemplate[] = [];
  let presets: SummaryTemplatePreset[] = [];
  let backendDown = false;
  try {
    const [t, p] = await Promise.all([
      listTemplates(),
      listPresets().catch(() => [] as SummaryTemplatePreset[]),
    ]);
    templates = t;
    presets = p;
  } catch (error: unknown) {
    if (ApiError.isApiError(error) && error.code === BACKEND_UNAVAILABLE_CODE) {
      backendDown = true;
    } else {
      throw error;
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <Link href="/settings" className="text-sm text-ink-muted hover:text-ink">
          ← Settings
        </Link>
        <p className="eyebrow mb-1.5 mt-3">Summaries</p>
        <h1 className="font-display text-2xl text-ink">Summary templates</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Control how each kind of meeting gets summarized. The default applies
          when none is chosen.
        </p>
      </header>

      {backendDown ? (
        <BackendDownState resource="summary templates" />
      ) : (
        <TemplatesManager initialTemplates={templates} presets={presets} />
      )}
    </div>
  );
}
