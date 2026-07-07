"use client";

import { useState } from "react";
import { putJson, postJson } from "@/lib/api/browser";
import type { DigestPreferences } from "@/lib/api/types";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function DigestSettings({ initial }: { initial: DigestPreferences }) {
  const [prefs, setPrefs] = useState<DigestPreferences>(initial);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const patch = (p: Partial<DigestPreferences>) => setPrefs((prev) => ({ ...prev, ...p }));

  const handleHourChange = (value: string) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return;
    patch({ hourUtc: Math.min(23, Math.max(0, Math.trunc(parsed))) });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const saved = await putJson<DigestPreferences>("/api/digest-preferences", {
        enabled: prefs.enabled,
        frequency: prefs.frequency,
        hourUtc: prefs.hourUtc,
        dayOfWeek: prefs.dayOfWeek,
        channel: prefs.channel,
        target: prefs.target,
      });
      setPrefs(saved);
      setStatus("Saved.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setError(null);
    setStatus(null);
    try {
      const res = await postJson<{ delivered: boolean; detail: string }>(
        "/api/digest-preferences/test",
        {},
      );
      setStatus(res.delivered ? `Sent (${res.detail}).` : `Not sent: ${res.detail}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Test failed.");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <label className="flex items-center justify-between gap-4">
        <span className="text-sm text-ink-soft">Send automatic digests</span>
        <Toggle
          checked={prefs.enabled}
          onChange={(v) => patch({ enabled: v })}
          label="Enable digests"
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-ink-muted">Frequency</span>
          <select
            value={prefs.frequency}
            onChange={(e) => patch({ frequency: e.target.value as DigestPreferences["frequency"] })}
            className="rounded-md border border-border-default bg-surface-0 px-3 py-2 text-sm text-ink"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </label>

        {prefs.frequency === "weekly" && (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-ink-muted">Day</span>
            <select
              value={prefs.dayOfWeek}
              onChange={(e) => patch({ dayOfWeek: Number(e.target.value) })}
              className="rounded-md border border-border-default bg-surface-0 px-3 py-2 text-sm text-ink"
            >
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-ink-muted">Hour (UTC)</span>
          <input
            type="number"
            min={0}
            max={23}
            value={prefs.hourUtc}
            onChange={(e) => handleHourChange(e.target.value)}
            className="rounded-md border border-border-default bg-surface-0 px-3 py-2 text-sm text-ink"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-ink-muted">Channel</span>
          <select
            value={prefs.channel}
            onChange={(e) => patch({ channel: e.target.value as DigestPreferences["channel"] })}
            className="rounded-md border border-border-default bg-surface-0 px-3 py-2 text-sm text-ink"
          >
            <option value="email">Email</option>
            <option value="slack">Slack</option>
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-ink-muted">
          {prefs.channel === "slack" ? "Slack incoming-webhook URL" : "Recipient email"}
        </span>
        <input
          value={prefs.target ?? ""}
          onChange={(e) => patch({ target: e.target.value })}
          placeholder={
            prefs.channel === "slack"
              ? "https://hooks.slack.com/services/…"
              : "team@example.com"
          }
          className="rounded-md border border-border-default bg-surface-0 px-3 py-2 font-mono text-sm text-ink"
        />
      </label>

      {error && <p className="text-sm text-error">{error}</p>}
      {status && <p className="text-sm text-sage-700">{status}</p>}

      <div className="flex gap-2">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save preferences"}
        </Button>
        <Button variant="secondary" onClick={sendTest} disabled={!prefs.target}>
          Send a test now
        </Button>
      </div>
    </div>
  );
}
