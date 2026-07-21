"use client";

import { useState } from "react";
import { putJson } from "@/lib/api/browser";
import type { CapturePrefs } from "@/lib/api/types";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { TextField } from "@/components/ui/TextField";

export function CapturePrefsSettings({ initial }: { initial: CapturePrefs }) {
  const [s, setS] = useState<CapturePrefs>(initial);
  const [lead, setLead] = useState(String(initial.joinLeadMinutes));
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const patch = (p: Partial<CapturePrefs>) => setS((prev) => ({ ...prev, ...p }));

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const minutes = Number.parseInt(lead, 10);
      const saved = await putJson<CapturePrefs>("/api/capture-prefs", {
        ...s,
        joinLeadMinutes: Number.isNaN(minutes) ? 2 : minutes,
      });
      setS(saved);
      setLead(String(saved.joinLeadMinutes));
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
          Auto-join meetings from connected calendars
        </span>
        <Toggle
          checked={s.autoJoinEnabled}
          onChange={(v) => patch({ autoJoinEnabled: v })}
          label="Auto-join enabled"
        />
      </label>

      {s.autoJoinEnabled && (
        <>
          <TextField
            label="Join lead time (minutes)"
            type="number"
            min={0}
            max={30}
            step={1}
            inputMode="numeric"
            value={lead}
            onChange={(e) => setLead(e.target.value)}
            hint="How many minutes before a meeting starts Parlor joins it (0–30)."
            className="w-56"
          />

          <label className="flex items-center justify-between gap-4">
            <span className="text-sm text-ink-soft">Auto-join Zoom meetings</span>
            <Toggle
              checked={s.joinZoom}
              onChange={(v) => patch({ joinZoom: v })}
              label="Join Zoom"
            />
          </label>

          <label className="flex items-center justify-between gap-4">
            <span className="text-sm text-ink-soft">Auto-join Google Meet meetings</span>
            <Toggle
              checked={s.joinMeet}
              onChange={(v) => patch({ joinMeet: v })}
              label="Join Google Meet"
            />
          </label>

          <label className="flex items-center justify-between gap-4">
            <span className="text-sm text-ink-soft">Auto-join Microsoft Teams meetings</span>
            <Toggle
              checked={s.joinTeams}
              onChange={(v) => patch({ joinTeams: v })}
              label="Join Microsoft Teams"
            />
          </label>
        </>
      )}

      {status && <p className="text-sm text-sage-700">{status}</p>}

      <div>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save auto-join preferences"}
        </Button>
      </div>
    </div>
  );
}
