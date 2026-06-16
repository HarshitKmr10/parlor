"use client";

import { useMemo } from "react";
import type { ActionItem, MeetingMeta } from "./types";
import { formatClock, indexSpeakers } from "./utils";
import { useMockTranscript } from "./useMockTranscript";
import { SpeakerRail } from "./SpeakerRail";
import { TranscriptStream } from "./TranscriptStream";
import { AskBar } from "./AskBar";

type Props = {
  meeting: MeetingMeta;
  summaryBullets: readonly string[];
  actionItems: readonly ActionItem[];
};

export function LiveMeetingView({
  meeting,
  summaryBullets,
  actionItems,
}: Props) {
  const { segments, activeSpeakerId, elapsedSec } = useMockTranscript();
  const speakers = meeting.participants;
  const speakerById = useMemo(() => indexSpeakers(speakers), [speakers]);

  // Derived during render — no effect. Accumulate talk time per speaker from
  // the segment durations seen so far.
  const talkTimeSec = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const segment of segments) {
      const dur = Math.max(0, segment.tEndSec - segment.tStartSec);
      totals[segment.speakerId] = (totals[segment.speakerId] ?? 0) + dur;
    }
    return totals;
  }, [segments]);

  // Reveal summary bullets progressively so the card visibly accumulates.
  const visibleBulletCount = Math.min(
    summaryBullets.length,
    1 + Math.floor(segments.length / 2),
  );
  const visibleBullets = summaryBullets.slice(0, visibleBulletCount);

  return (
    <main className="grain relative mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
      <MeetingHeader
        title={meeting.title}
        elapsedSec={elapsedSec}
        participantCount={speakers.length}
      />

      <div className="mt-5 grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[200px_minmax(0,1fr)_320px]">
        {/* Speaker rail — horizontal on mobile, vertical sidebar on desktop */}
        <aside className="lg:order-1">
          <div className="rounded-lg border border-border-subtle bg-surface-1 p-3 lg:h-full lg:p-4">
            <h2 className="eyebrow mb-3 hidden lg:block">In the room</h2>
            <SpeakerRail
              speakers={speakers}
              activeSpeakerId={activeSpeakerId}
              talkTimeSec={talkTimeSec}
            />
          </div>
        </aside>

        {/* Transcript — the centerpiece */}
        <section
          aria-label="Transcript"
          className="order-first flex min-h-[420px] flex-col rounded-lg border border-border-subtle bg-surface-0 p-4 shadow-soft-sm lg:order-2 lg:min-h-0"
        >
          <div className="min-h-0 flex-1">
            <TranscriptStream segments={segments} speakers={speakers} />
          </div>
          <div className="divider-gold my-3" />
          <AskBar speakers={speakers} />
        </section>

        {/* Right column — summary + action items; collapses below on mobile */}
        <aside className="flex flex-col gap-4 lg:order-3">
          <SummaryCard bullets={visibleBullets} />
          <ActionItemsList items={actionItems} speakerById={speakerById} />
        </aside>
      </div>
    </main>
  );
}

type HeaderProps = {
  title: string;
  elapsedSec: number;
  participantCount: number;
};

function MeetingHeader({ title, elapsedSec, participantCount }: HeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-border-subtle pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="eyebrow mb-1">Live meeting</p>
        <h1 className="font-display text-2xl text-ink">{title}</h1>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <RecIndicator />
        <div className="flex items-center gap-1.5 text-ink-muted">
          <ClockIcon />
          <span className="font-mono text-sm tabular-nums">
            {formatClock(elapsedSec)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-ink-muted">
          <PeopleIcon />
          <span className="font-mono text-sm tabular-nums">
            {participantCount}
          </span>
        </div>
      </div>
    </header>
  );
}

function RecIndicator() {
  return (
    <span
      role="status"
      aria-label="Recording in progress"
      className="inline-flex items-center gap-1.5 rounded-full bg-error-bg px-2.5 py-1"
    >
      <style>{`
        @keyframes verdant-rec-pulse {
          0%, 100% { opacity: 0.55; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1); }
        }
        .verdant-rec-dot {
          animation: verdant-rec-pulse 1.6s var(--ease-in-out, ease-in-out) infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .verdant-rec-dot { animation: none; opacity: 1; }
        }
      `}</style>
      <span
        aria-hidden="true"
        className="verdant-rec-dot block h-2 w-2 rounded-full bg-error"
      />
      <span className="font-sans text-xs font-semibold tracking-wider text-error uppercase">
        Rec
      </span>
    </span>
  );
}

function SummaryCard({ bullets }: { bullets: readonly string[] }) {
  return (
    <section
      aria-label="Live AI summary"
      className="rounded-lg border border-border-subtle bg-surface-1 p-4"
    >
      <h2 className="eyebrow mb-3">Live summary</h2>
      <ul aria-live="polite" className="flex flex-col gap-2.5">
        {bullets.map((bullet, index) => (
          <li
            key={index}
            className="flex gap-2.5 text-sm leading-relaxed text-ink-soft"
          >
            <span
              aria-hidden="true"
              className="mt-2 block h-1.5 w-1.5 shrink-0 rounded-full bg-sage-400"
            />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

type ActionItemsProps = {
  items: readonly ActionItem[];
  speakerById: Map<string, { name: string }>;
};

function ActionItemsList({ items, speakerById }: ActionItemsProps) {
  return (
    <section
      aria-label="Action items"
      className="rounded-lg border border-border-subtle bg-surface-1 p-4"
    >
      <h2 className="eyebrow mb-3">Action items</h2>
      <ul className="flex flex-col gap-2.5">
        {items.map((item) => {
          const owner = item.ownerId
            ? speakerById.get(item.ownerId)
            : undefined;
          return (
            <li
              key={item.id}
              className="rounded-sm bg-gold-50 py-2.5 pr-3 pl-3"
              style={{ borderLeft: "2px solid var(--border-gold)" }}
            >
              <p className="text-sm leading-snug text-ink">{item.text}</p>
              {owner && (
                <p className="mt-1 font-display text-xs font-semibold text-gold-700 uppercase">
                  {owner.name}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ClockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 7v5l3 2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
    >
      <path
        d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM21 19v-1a4 4 0 0 0-3-3.87M16 4.13A4 4 0 0 1 16 11.87"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
