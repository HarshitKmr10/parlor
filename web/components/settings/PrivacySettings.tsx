"use client";

import { useState } from "react";
import { putJson } from "@/lib/api/browser";
import type { NlpSettings } from "@/lib/api/types";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";

export function PrivacySettings({ initial }: { initial: NlpSettings }) {
  const [s, setS] = useState<NlpSettings>(initial);
  const [vocab, setVocab] = useState(initial.customVocab.join(", "));
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const patch = (p: Partial<NlpSettings>) => setS((prev) => ({ ...prev, ...p }));

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const saved = await putJson<NlpSettings>("/api/nlp-settings", {
        ...s,
        customVocab: vocab.split(",").map((v) => v.trim()).filter(Boolean),
        summaryLanguage: s.summaryLanguage,
      });
      setS(saved);
      setVocab(saved.customVocab.join(", "));
      setStatus("Saved.");
    } catch (e: unknown) {
      setStatus(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <label className="flex items-center justify-between gap-4">
        <span className="text-sm text-ink-soft">
          Redact PII from transcripts before AI processing &amp; sharing
        </span>
        <Toggle
          checked={s.redactionEnabled}
          onChange={(v) => patch({ redactionEnabled: v })}
          label="Enable redaction"
        />
      </label>

      {s.redactionEnabled && (
        <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-1/60 p-4">
          {(
            [
              ["redactEmails", "Email addresses"],
              ["redactPhones", "Phone numbers"],
              ["redactCards", "Card numbers"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-4">
              <span className="text-sm text-ink-soft">{label}</span>
              <Toggle
                checked={s[key]}
                onChange={(v) => patch({ [key]: v } as Partial<NlpSettings>)}
                label={`Redact ${label}`}
              />
            </label>
          ))}
        </div>
      )}

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-ink-muted">Summary language</span>
        <select
          value={s.summaryLanguage}
          onChange={(e) => patch({ summaryLanguage: e.target.value })}
          className="w-56 rounded-md border border-border-default bg-surface-0 px-3 py-2 text-sm text-ink"
        >
          {[
            ["en", "English"],
            ["es", "Spanish"],
            ["fr", "French"],
            ["de", "German"],
            ["pt", "Portuguese"],
            ["ja", "Japanese"],
            ["hi", "Hindi"],
          ].map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
        <span className="text-xs text-ink-faint">Summaries will be written in this language.</span>
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-ink-muted">Custom vocabulary (comma-separated)</span>
        <input
          value={vocab}
          onChange={(e) => setVocab(e.target.value)}
          placeholder="Parlor, pgvector, ARR, Kubernetes"
          className="rounded-md border border-border-default bg-surface-0 px-3 py-2 text-sm text-ink"
        />
        <span className="text-xs text-ink-faint">
          Jargon, product names, and people the summarizer should spell correctly.
        </span>
      </label>

      {status && <p className="text-sm text-sage-700">{status}</p>}

      <div>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save privacy settings"}
        </Button>
      </div>
    </div>
  );
}
