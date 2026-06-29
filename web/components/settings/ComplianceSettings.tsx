"use client";

import { useState } from "react";
import { putJson } from "@/lib/api/browser";
import type { RetentionSettings } from "@/lib/api/types";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";

export function ComplianceSettings({ initial }: { initial: RetentionSettings }) {
  const [keepForever, setKeepForever] = useState(initial.retentionDays == null);
  const [days, setDays] = useState(initial.retentionDays ?? 90);
  const [legalHold, setLegalHold] = useState(initial.legalHold);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      await putJson<RetentionSettings>("/api/retention-settings", {
        retentionDays: keepForever ? null : days,
        legalHold,
      });
      setStatus("Saved.");
    } catch (e: unknown) {
      setStatus(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <label className="flex items-center justify-between gap-4">
          <span className="text-sm text-ink-soft">Keep meetings forever</span>
          <Toggle checked={keepForever} onChange={setKeepForever} label="Keep forever" />
        </label>
        {!keepForever && (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-ink-muted">Delete meetings older than (days)</span>
            <input
              type="number"
              min={1}
              max={3650}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-40 rounded-md border border-border-default bg-surface-0 px-3 py-2 text-sm text-ink"
            />
          </label>
        )}
        <label className="flex items-center justify-between gap-4">
          <span className="text-sm text-ink-soft">
            Legal hold <span className="text-ink-faint">(pauses all deletion)</span>
          </span>
          <Toggle checked={legalHold} onChange={setLegalHold} label="Legal hold" />
        </label>
        {status && <p className="text-sm text-sage-700">{status}</p>}
        <div>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save retention policy"}
          </Button>
        </div>
      </section>

      <section className="border-t border-border-subtle pt-6">
        <h2 className="mb-1 font-display text-lg text-ink">Export your data</h2>
        <p className="mb-3 text-sm text-ink-muted">
          Download every meeting, transcript, summary, and action item as JSON.
        </p>
        <a
          href="/api/export"
          download
          className="inline-flex items-center gap-2 rounded-md border border-border-default bg-surface-0 px-4 py-2.5 text-sm font-medium text-ink shadow-soft-sm transition-colors hover:border-border-strong hover:bg-surface-1"
        >
          Export workspace data
        </a>
      </section>
    </div>
  );
}
