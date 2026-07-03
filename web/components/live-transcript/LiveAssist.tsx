"use client";

import { useEffect, useState } from "react";
import { postJson } from "@/lib/api/browser";
import { SparkIcon } from "@/components/ui/icons";
import type { MeetingAssist } from "@/lib/api/types";

type Props = {
  meetingId: string;
  /** Optional: clicking a suggested question fills the ask input. */
  onPickQuestion?: (question: string) => void;
  /** Poll cadence; assist is cheap + deterministic. */
  intervalMs?: number;
};

export function LiveAssist({ meetingId, onPickQuestion, intervalMs = 20_000 }: Props) {
  const [assist, setAssist] = useState<MeetingAssist | null>(null);

  // Poll for assist suggestions. `cancelled`/`inFlight` are plain closure
  // locals scoped to this effect run (it only re-runs when `meetingId` or
  // `intervalMs` change). Gating `setAssist` on `cancelled` prevents a
  // response that resolves after unmount from updating state, and
  // `inFlight` stops overlapping polls from letting a slower, older request
  // clobber a faster, newer one.
  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    const load = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const data = await postJson<MeetingAssist>(
          `/api/meetings/${meetingId}/assist`,
          {},
        );
        if (cancelled) return;
        setAssist(data);
      } catch {
        // Assist is advisory — stay quiet on failure.
      } finally {
        inFlight = false;
      }
    };

    void load();
    const id = setInterval(() => void load(), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [meetingId, intervalMs]);

  if (!assist || assist.segmentCount === 0) return null;

  return (
    <section
      aria-label="Live assist"
      className="rounded-lg border border-gold-200 bg-gold-50/50 p-4"
    >
      <p className="eyebrow mb-2 flex items-center gap-1.5">
        <SparkIcon className="h-3.5 w-3.5" />
        Parlor assist
      </p>

      {assist.suggestedQuestions.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-xs font-medium text-ink-soft">Ask next</p>
          <div className="flex flex-wrap gap-1.5">
            {assist.suggestedQuestions.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onPickQuestion?.(q)}
                className="rounded-full border border-gold-300 bg-surface-0 px-3 py-1 text-left text-xs text-ink-soft transition-colors hover:border-gold-500 hover:text-ink"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {assist.coverageGaps.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-soft">Not covered yet</p>
          <div className="flex flex-wrap gap-1.5">
            {assist.coverageGaps.map((g) => (
              <span
                key={g}
                className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-ink-muted"
              >
                {g}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
