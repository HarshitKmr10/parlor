"use client";

import { useEffect, useRef, useState } from "react";
import type { Speaker, TranscriptSegment } from "./types";
import { formatClock, indexSpeakers, tintText } from "./utils";

type Props = {
  segments: TranscriptSegment[];
  speakers: Speaker[];
};

/** Distance from the bottom (px) still treated as "pinned to newest". */
const STICK_THRESHOLD_PX = 80;

export function TranscriptStream({ segments, speakers }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Whether auto-scroll should follow new lines. Disabled once the user
  // scrolls up to read history; re-enabled when they return to the bottom.
  const [isPinned, setIsPinned] = useState(true);
  const isPinnedRef = useRef(isPinned);

  // Keep the ref in sync without touching it during render.
  useEffect(() => {
    isPinnedRef.current = isPinned;
  }, [isPinned]);

  const speakerById = indexSpeakers(speakers);

  // Follow the newest line only while pinned. Read the latest pinned value
  // from the ref so this effect runs only on new segments, not on pin toggles.
  useEffect(() => {
    if (!isPinnedRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [segments.length]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsPinned(distanceFromBottom <= STICK_THRESHOLD_PX);
  };

  const jumpToLatest = () => {
    setIsPinned(true);
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <style>{`
        @keyframes parlor-line-enter {
          from { opacity: 0; transform: translate3d(0, 8px, 0); }
          to { opacity: 1; transform: translate3d(0, 0, 0); }
        }
        .parlor-line-enter {
          animation: parlor-line-enter 240ms var(--ease-spring) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .parlor-line-enter { animation: none; }
        }
      `}</style>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        aria-live="polite"
        aria-label="Live transcript"
        className="flex-1 overflow-y-auto px-1 [scrollbar-width:thin]"
      >
        <ol className="flex flex-col gap-5 py-2">
          {segments.map((segment) => {
            const speaker = speakerById.get(segment.speakerId);
            return (
              <li key={segment.id} className="parlor-line-enter">
                <div className="flex items-baseline gap-2.5">
                  <time className="shrink-0 font-mono text-xs text-ink-muted tabular-nums">
                    {formatClock(segment.tStartSec)}
                  </time>
                  <span
                    className={`font-display text-sm font-semibold tracking-wide uppercase ${
                      speaker ? tintText(speaker.sageTint) : "text-ink-soft"
                    }`}
                    style={{ fontVariantCaps: "all-small-caps" }}
                  >
                    {speaker?.name ?? "Unknown"}
                  </span>
                </div>
                <p className="mt-0.5 pl-[3.25rem] text-base leading-relaxed text-ink">
                  {segment.text}
                </p>
              </li>
            );
          })}
          <div ref={bottomRef} aria-hidden="true" />
        </ol>
      </div>

      {!isPinned && (
        <button
          type="button"
          onClick={jumpToLatest}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border-default bg-surface-0 px-3.5 py-1.5 font-sans text-xs font-medium text-ink-soft shadow-soft-md transition-colors hover:bg-surface-1"
        >
          Jump to latest ↓
        </button>
      )}
    </div>
  );
}
