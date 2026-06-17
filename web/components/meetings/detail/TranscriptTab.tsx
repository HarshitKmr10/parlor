"use client";

import { useEffect, useRef, useState } from "react";
import type { TranscriptSegment } from "@/lib/api/types";
import { getJson } from "@/lib/api/browser";
import { formatDuration } from "@/lib/format";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListIcon } from "@/components/ui/icons";

type TranscriptResponse = {
  items: TranscriptSegment[];
  lastSegmentAt: string | null;
};

type Props = {
  meetingId: string;
  initialSegments: TranscriptSegment[];
  /** Poll for new segments while the meeting is still being captured. */
  isOngoing: boolean;
};

const POLL_MS = 3000;

/** Sage text tints (AA-safe) cycled per distinct speaker, gold reserved. */
const SPEAKER_TINTS = ["text-sage-700", "text-sage-600", "text-sage-500"];

function tintForSpeaker(speakerId: string, order: Map<string, number>): string {
  if (!order.has(speakerId)) order.set(speakerId, order.size);
  const index = order.get(speakerId) ?? 0;
  return SPEAKER_TINTS[index % SPEAKER_TINTS.length];
}

export function TranscriptTab({ meetingId, initialSegments, isOngoing }: Props) {
  const [segments, setSegments] = useState<TranscriptSegment[]>(initialSegments);
  // Cursor + dedup set live in refs so the polling effect doesn't re-subscribe.
  const sinceRef = useRef<string | null>(
    initialSegments.length > 0
      ? initialSegments[initialSegments.length - 1].createdAt
      : null,
  );
  const seenRef = useRef<Set<string>>(
    new Set(initialSegments.map((s) => s.id)),
  );

  useEffect(() => {
    if (!isOngoing) return;
    let cancelled = false;
    let inflight = false;

    const poll = async () => {
      if (inflight || cancelled) return;
      inflight = true;
      try {
        const since = sinceRef.current;
        const qs = since ? `?since=${encodeURIComponent(since)}` : "";
        const data = await getJson<TranscriptResponse>(
          `/api/meetings/${meetingId}/transcript${qs}`,
        );
        if (cancelled) return;
        const fresh = (data.items ?? []).filter(
          (s) => !seenRef.current.has(s.id),
        );
        if (fresh.length > 0) {
          fresh.forEach((s) => seenRef.current.add(s.id));
          setSegments((prev) => [...prev, ...fresh]);
        }
        if (data.lastSegmentAt) sinceRef.current = data.lastSegmentAt;
      } catch {
        // Transient poll error — keep the last good transcript, retry next tick.
      } finally {
        inflight = false;
      }
    };

    const id = setInterval(poll, POLL_MS);
    poll();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [meetingId, isOngoing]);

  if (segments.length === 0) {
    return (
      <EmptyState
        icon={<ListIcon className="h-6 w-6" />}
        title={isOngoing ? "Listening…" : "No transcript yet"}
        description={
          isOngoing
            ? "The bot is in the meeting — transcript lines will appear here live as people speak."
            : "When this meeting is captured, the full transcript will appear here with timestamps and speakers."
        }
      />
    );
  }

  const speakerOrder = new Map<string, number>();

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-0 p-4 shadow-soft-sm sm:p-6">
      {isOngoing && (
        <div className="mb-4 flex items-center gap-2 text-xs font-medium text-ink-muted">
          <span
            aria-hidden="true"
            className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-gold-500"
          />
          Live — updating as the meeting continues
        </div>
      )}
      <ol className="flex flex-col gap-5" aria-live={isOngoing ? "polite" : "off"}>
        {segments.map((segment) => {
          const tint = tintForSpeaker(segment.speakerId, speakerOrder);
          return (
            <li key={segment.id}>
              <div className="flex items-baseline gap-2.5">
                <time className="shrink-0 font-mono text-xs text-ink-muted tabular-nums">
                  {formatDuration(segment.tStartSec)}
                </time>
                <span
                  className={`font-display text-sm font-semibold tracking-wide uppercase ${tint}`}
                  style={{ fontVariantCaps: "all-small-caps" }}
                >
                  {segment.speakerName}
                </span>
              </div>
              <p className="mt-0.5 pl-[3.25rem] text-base leading-relaxed text-ink">
                {segment.text}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
