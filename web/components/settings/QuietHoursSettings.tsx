"use client";

import { useState } from "react";
import { putJson } from "@/lib/api/browser";
import type { QuietHours } from "@/lib/api/types";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";

const HOURS = Array.from({ length: 24 }, (_, h) => h);

function formatHour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

export function QuietHoursSettings({ initial }: { initial: QuietHours }) {
  const [s, setS] = useState<QuietHours>(initial);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const patch = (p: Partial<QuietHours>) => setS((prev) => ({ ...prev, ...p }));

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const saved = await putJson<QuietHours>("/api/quiet-hours", s);
      setS(saved);
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
          Pause notification &amp; digest emails during a daily window
        </span>
        <Toggle
          checked={s.enabled}
          onChange={(v) => patch({ enabled: v })}
          label="Enable quiet hours"
        />
      </label>

      {s.enabled && (
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Start</span>
            <select
              value={s.startHour}
              onChange={(e) => patch({ startHour: Number(e.target.value) })}
              aria-label="Quiet hours start"
              className="w-32 rounded-md border border-border-default bg-surface-0 px-3 py-2 text-sm text-ink shadow-soft-sm"
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {formatHour(h)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">End</span>
            <select
              value={s.endHour}
              onChange={(e) => patch({ endHour: Number(e.target.value) })}
              aria-label="Quiet hours end"
              className="w-32 rounded-md border border-border-default bg-surface-0 px-3 py-2 text-sm text-ink shadow-soft-sm"
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {formatHour(h)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {s.enabled && s.startHour > s.endHour && (
        <p className="text-sm text-ink-muted">
          This window wraps past midnight — quiet from {formatHour(s.startHour)}{" "}
          tonight until {formatHour(s.endHour)} the next morning.
        </p>
      )}

      {status && <p className="text-sm text-sage-700">{status}</p>}

      <div>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save quiet hours"}
        </Button>
      </div>
    </div>
  );
}
