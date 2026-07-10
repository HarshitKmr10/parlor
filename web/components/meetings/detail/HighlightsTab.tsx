"use client";

import { useEffect, useState } from "react";
import { getJson, postJson, del } from "@/lib/api/browser";
import type { Highlight, HighlightListResponse } from "@/lib/api/types";
import { Button } from "@/components/ui/Button";
import { formatDuration } from "@/lib/format";

type Props = {
  meetingId: string;
};

const COLOR_DOT: Record<string, string> = {
  gold: "bg-gold-400",
  sage: "bg-sage-500",
};

function parseClock(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const parts = trimmed.split(":").map((p) => Number(p));
  if (parts.some((p) => Number.isNaN(p))) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

export function HighlightsTab({ meetingId }: Props) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getJson<HighlightListResponse>(`/api/meetings/${meetingId}/highlights`, controller.signal)
      .then((res) => setHighlights(res.items))
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Failed to load highlights.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [meetingId]);

  const handleAdd = async () => {
    const tStart = parseClock(start);
    const tEnd = parseClock(end);
    if (tStart === null || tEnd === null || tEnd < tStart) {
      setError("Enter a valid start and end (e.g. 0:30 and 1:05).");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await postJson<Highlight>(`/api/meetings/${meetingId}/highlights`, {
        tStartSec: tStart,
        tEndSec: tEnd,
        label: label.trim() || undefined,
        color: "gold",
      });
      setHighlights((prev) => [...prev, created].sort((a, b) => a.tStartSec - b.tStartSec));
      setLabel("");
      setStart("");
      setEnd("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add highlight.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const snapshot = highlights;
    setHighlights((prev) => prev.filter((h) => h.id !== id));
    try {
      await del(`/api/meetings/${meetingId}/highlights/${id}`);
    } catch {
      setHighlights(snapshot); // roll back
      setError("Failed to delete highlight.");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg border border-border-subtle bg-surface-1/60 p-4">
        <p className="eyebrow mb-3">Mark a moment</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="text-ink-muted">Label</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Key decision"
              className="rounded-md border border-border-default bg-surface-0 px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="flex w-24 flex-col gap-1 text-sm">
            <span className="text-ink-muted">Start</span>
            <input
              value={start}
              onChange={(e) => setStart(e.target.value)}
              placeholder="0:30"
              className="rounded-md border border-border-default bg-surface-0 px-3 py-2 font-mono text-sm text-ink"
            />
          </label>
          <label className="flex w-24 flex-col gap-1 text-sm">
            <span className="text-ink-muted">End</span>
            <input
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              placeholder="1:05"
              className="rounded-md border border-border-default bg-surface-0 px-3 py-2 font-mono text-sm text-ink"
            />
          </label>
          <Button onClick={handleAdd} disabled={saving} size="sm">
            {saving ? "Adding…" : "Add highlight"}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      {loading ? (
        <p className="text-sm text-ink-muted">Loading highlights…</p>
      ) : highlights.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-default bg-surface-1/60 px-5 py-10 text-center text-sm text-ink-muted">
          No highlights yet. Mark the moments worth coming back to.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {highlights.map((h) => (
            <li
              key={h.id}
              className="group flex items-start gap-3 rounded-lg border border-border-subtle bg-surface-0 p-4 shadow-soft-sm"
            >
              <span
                aria-hidden="true"
                className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${COLOR_DOT[h.color ?? ""] ?? "bg-gold-400"}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-gold-700">
                    {formatDuration(h.tStartSec)} – {formatDuration(h.tEndSec)}
                  </span>
                  {h.label && (
                    <span className="font-sans text-sm font-medium text-ink">{h.label}</span>
                  )}
                </div>
                {h.excerpt && (
                  <p className="mt-1 line-clamp-2 text-sm text-ink-soft">“{h.excerpt}”</p>
                )}
                {h.note && <p className="mt-1 text-xs text-ink-muted">{h.note}</p>}
              </div>
              <button
                type="button"
                onClick={() => handleDelete(h.id)}
                aria-label="Delete highlight"
                className="rounded-md px-2 py-1 text-xs text-ink-muted opacity-0 transition-opacity hover:bg-error-bg hover:text-error focus-visible:opacity-100 group-hover:opacity-100"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
