"use client";

import { useState } from "react";
import { postJson, patchJson, del } from "@/lib/api/browser";
import type { Tracker } from "@/lib/api/types";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";

export function TrackersManager({ initial }: { initial: Tracker[] }) {
  const [trackers, setTrackers] = useState<Tracker[]>(initial);
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await postJson<Tracker>("/api/trackers", {
        name: name.trim(),
        keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
      });
      setTrackers((prev) => [created, ...prev]);
      setName("");
      setKeywords("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create tracker.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (t: Tracker) => {
    const next = !t.enabled;
    setTrackers((prev) => prev.map((x) => (x.id === t.id ? { ...x, enabled: next } : x)));
    try {
      await patchJson<Tracker>(`/api/trackers/${t.id}`, { enabled: next });
    } catch {
      setTrackers((prev) => prev.map((x) => (x.id === t.id ? { ...x, enabled: !next } : x)));
    }
  };

  const remove = async (id: string) => {
    const snapshot = trackers;
    setTrackers((prev) => prev.filter((t) => t.id !== id));
    try {
      await del(`/api/trackers/${id}`);
    } catch {
      setTrackers(snapshot);
      setError("Failed to delete tracker.");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {error && <p className="text-sm text-error">{error}</p>}

      {trackers.length > 0 && (
        <ul className="flex flex-col gap-2">
          {trackers.map((t) => (
            <li
              key={t.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border-subtle bg-surface-0 p-4 shadow-soft-sm"
            >
              <div className="min-w-0">
                <p className="font-sans text-sm font-medium text-ink">{t.name}</p>
                <p className="mt-1 flex flex-wrap gap-1.5">
                  {t.keywords.map((k) => (
                    <span key={k} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-muted">
                      {k}
                    </span>
                  ))}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Toggle checked={t.enabled} onChange={() => toggle(t)} label="Enabled" />
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

      <div className="rounded-lg border border-border-subtle bg-surface-1/60 p-4">
        <p className="eyebrow mb-3">New tracker</p>
        <div className="flex flex-col gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tracker name (e.g. Pricing, Competitor)"
            className="rounded-md border border-border-default bg-surface-0 px-3 py-2 text-sm text-ink"
          />
          <input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="Keywords, comma-separated (e.g. pricing, discount, quote)"
            className="rounded-md border border-border-default bg-surface-0 px-3 py-2 text-sm text-ink"
          />
          <div className="flex justify-end">
            <Button onClick={create} disabled={busy || !name.trim()} size="sm">
              {busy ? "Saving…" : "Create tracker"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
