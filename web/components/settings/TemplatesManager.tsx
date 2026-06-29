"use client";

import { useState } from "react";
import { postJson, patchJson, del } from "@/lib/api/browser";
import type { SummaryTemplate, SummaryTemplatePreset } from "@/lib/api/types";
import { Button } from "@/components/ui/Button";

type Props = {
  initialTemplates: SummaryTemplate[];
  presets: SummaryTemplatePreset[];
};

export function TemplatesManager({ initialTemplates, presets }: Props) {
  const [templates, setTemplates] = useState<SummaryTemplate[]>(initialTemplates);
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async (payload: { name: string; instructions: string; sections?: string[] }) => {
    setBusy(true);
    setError(null);
    try {
      const created = await postJson<SummaryTemplate>("/api/summary-templates", payload);
      setTemplates((prev) => [...prev, created]);
      setName("");
      setInstructions("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create template.");
    } finally {
      setBusy(false);
    }
  };

  const makeDefault = async (t: SummaryTemplate) => {
    setTemplates((prev) => prev.map((x) => ({ ...x, isDefault: x.id === t.id })));
    try {
      await patchJson<SummaryTemplate>(`/api/summary-templates/${t.id}`, { isDefault: true });
    } catch {
      setError("Failed to set default.");
    }
  };

  const remove = async (id: string) => {
    const snapshot = templates;
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    try {
      await del(`/api/summary-templates/${id}`);
    } catch {
      setTemplates(snapshot);
      setError("Failed to delete template.");
    }
  };

  const usedPresetNames = new Set(templates.map((t) => t.name.toLowerCase()));

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="text-sm text-error">{error}</p>}

      {templates.length > 0 && (
        <ul className="flex flex-col gap-2">
          {templates.map((t) => (
            <li
              key={t.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border-subtle bg-surface-0 p-4 shadow-soft-sm"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-sans text-sm font-medium text-ink">{t.name}</span>
                  {t.isDefault && (
                    <span className="rounded-full bg-sage-50 px-2 py-0.5 text-xs font-semibold text-sage-700">
                      Default
                    </span>
                  )}
                </div>
                {t.instructions && (
                  <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{t.instructions}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                {!t.isDefault && (
                  <button
                    type="button"
                    onClick={() => makeDefault(t)}
                    className="text-xs text-ink-muted hover:text-sage-700"
                  >
                    Make default
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(t.id)}
                  className="text-xs text-ink-muted hover:text-error"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div>
        <p className="eyebrow mb-2">Start from a preset</p>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.key}
              type="button"
              disabled={busy || usedPresetNames.has(p.name.toLowerCase())}
              onClick={() => create({ name: p.name, instructions: p.instructions, sections: p.sections })}
              className="rounded-md border border-border-default bg-surface-0 px-3 py-1.5 text-sm text-ink transition-colors hover:border-border-strong hover:bg-surface-1 disabled:opacity-40"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border-subtle bg-surface-1/60 p-4">
        <p className="eyebrow mb-3">Custom template</p>
        <div className="flex flex-col gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name (e.g. Customer interview)"
            className="rounded-md border border-border-default bg-surface-0 px-3 py-2 text-sm text-ink"
          />
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={3}
            placeholder="Instructions for the summarizer — tone, sections, what to emphasize…"
            className="resize-y rounded-md border border-border-default bg-surface-0 px-3 py-2 text-sm text-ink"
          />
          <div className="flex justify-end">
            <Button
              onClick={() => create({ name: name.trim(), instructions: instructions.trim() })}
              disabled={busy || !name.trim()}
              size="sm"
            >
              {busy ? "Saving…" : "Create template"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
