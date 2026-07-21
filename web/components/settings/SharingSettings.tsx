"use client";

import { useState } from "react";
import { putJson } from "@/lib/api/browser";
import type { ShareSettings } from "@/lib/api/types";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { TextField } from "@/components/ui/TextField";

export function SharingSettings({ initial }: { initial: ShareSettings }) {
  const [s, setS] = useState<ShareSettings>(initial);
  const [expiry, setExpiry] = useState(String(initial.defaultExpiryHours));
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const patch = (p: Partial<ShareSettings>) => setS((prev) => ({ ...prev, ...p }));

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const hours = Number.parseInt(expiry, 10);
      const saved = await putJson<ShareSettings>("/api/share-settings", {
        ...s,
        defaultExpiryHours: Number.isNaN(hours) ? 0 : hours,
      });
      setS(saved);
      setExpiry(String(saved.defaultExpiryHours));
      setStatus("Saved.");
    } catch (e: unknown) {
      setStatus(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <TextField
        label="Default link expiry (hours)"
        type="number"
        min={0}
        max={8760}
        step={1}
        inputMode="numeric"
        value={expiry}
        onChange={(e) => setExpiry(e.target.value)}
        hint="How long a new share link stays live. Use 0 to never expire."
        className="w-56"
      />

      <label className="flex items-center justify-between gap-4">
        <span className="text-sm text-ink-soft">
          Require a passcode to open shared meeting pages
        </span>
        <Toggle
          checked={s.requirePasscode}
          onChange={(v) => patch({ requirePasscode: v })}
          label="Require passcode"
        />
      </label>

      {s.requirePasscode && (
        <TextField
          label="Default passcode"
          value={s.defaultPasscode}
          onChange={(e) => patch({ defaultPasscode: e.target.value })}
          placeholder="Optional — seeded onto new share links"
          hint="Leave blank to set a passcode per link when sharing."
          className="w-56"
        />
      )}

      {status && <p className="text-sm text-sage-700">{status}</p>}

      <div>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save sharing defaults"}
        </Button>
      </div>
    </div>
  );
}
