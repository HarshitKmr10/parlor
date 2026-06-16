'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { TranscriptEntry, speakerColorClass } from 'api/meetingJoiner';

interface TranscriptTimelineProps {
  entries: TranscriptEntry[];
  meetingStartTime: string | null;
  searchQuery: string;
  highlightTimestamp: string | null;
  autoScroll: boolean;
}

const formatRelative = (entryIso: string, startIso: string | null): string => {
  if (!startIso) return new Date(entryIso).toLocaleTimeString();
  const elapsed = (new Date(entryIso).getTime() - new Date(startIso).getTime()) / 1000;
  if (Number.isNaN(elapsed) || elapsed < 0) return new Date(entryIso).toLocaleTimeString();
  const m = Math.floor(elapsed / 60);
  const s = Math.floor(elapsed % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const highlightText = (text: string, query: string): React.ReactNode => {
  if (!query.trim()) return text;
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.split(re).map((part, i) =>
    re.test(part) ? (
      <mark key={i} className="rounded bg-amber-200 px-0.5 dark:bg-amber-700 dark:text-amber-50">
        {part}
      </mark>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );
};

export const TranscriptTimeline: React.FC<TranscriptTimelineProps> = ({
  entries,
  meetingStartTime,
  searchQuery,
  highlightTimestamp,
  autoScroll,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastEntryRef = useRef<HTMLDivElement>(null);
  const highlightedRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.trim().toLowerCase();
    return entries.filter(
      (e) => e.content.toLowerCase().includes(q) || e.speaker.toLowerCase().includes(q),
    );
  }, [entries, searchQuery]);

  useEffect(() => {
    if (highlightTimestamp && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (autoScroll && lastEntryRef.current) {
      lastEntryRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [entries.length, autoScroll, highlightTimestamp]);

  if (entries.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
        No transcript yet — bot is waiting for audio.
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
        No segments match &quot;{searchQuery}&quot;.
      </div>
    );
  }

  const isUnverified = (speaker: string) => /^Speaker spk_\d+$|^spk_\d+$/i.test(speaker);

  return (
    <div ref={containerRef} className="space-y-2">
      {filtered.map((entry, idx) => {
        const colorClass = speakerColorClass(entry.speaker);
        const isLast = idx === filtered.length - 1;
        const isHighlighted = highlightTimestamp === entry.timestamp;
        return (
          <div
            key={`${entry.timestamp}-${idx}`}
            ref={isHighlighted ? highlightedRef : isLast ? lastEntryRef : undefined}
            className={`group flex gap-3 rounded-lg p-3 transition ${
              isHighlighted
                ? 'bg-amber-50 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:ring-amber-800'
                : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <div className="flex w-16 shrink-0 flex-col items-end pt-0.5">
              <span className="font-mono text-xs text-slate-400 dark:text-slate-500 dark:text-slate-500">
                {formatRelative(entry.timestamp, meetingStartTime)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${colorClass}`}>
                  {entry.speaker}
                </span>
                {isUnverified(entry.speaker) && (
                  <span className="text-xs italic text-slate-400 dark:text-slate-500">(unverified)</span>
                )}
                {entry.confidence !== null && entry.confidence !== undefined && (
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {(entry.confidence * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              <p className="break-words text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                {highlightText(entry.content, searchQuery)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
