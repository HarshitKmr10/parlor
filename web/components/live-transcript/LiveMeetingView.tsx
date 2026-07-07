"use client";

import { useMemo } from "react";
import Link from "next/link";
import type {
  ActionItem,
  MeetingMeta,
  Speaker,
  TranscriptSegment,
} from "./types";
import { formatClock, indexSpeakers } from "./utils";
import { useMockTranscript } from "./useMockTranscript";
import { useLiveTranscript } from "./useLiveTranscript";
import type { MeetingStatus } from "@/lib/api/types";
import { SpeakerRail } from "./SpeakerRail";
import { TranscriptStream } from "./TranscriptStream";
import { AskBar } from "./AskBar";

type Props = {
  meeting: MeetingMeta;
  summaryBullets: readonly string[];
  actionItems: readonly ActionItem[];
  /**
   * When provided, the view polls the real meeting transcript + status and
   * renders real data only (no mock). When omitted (the marketing `/live`
   * demo), it always uses the scripted mock simulation.
   */
  meetingId?: string;
  /** Initial meeting status from the server render (live route only). */
  initialStatus?: MeetingStatus;
  /** Custom "ask" resolver wired to the real /ask endpoint when available. */
  onAsk?: (question: string) => Promise<import("./types").AskAnswer>;
};

/** Mock-driven container (demo). Keeps the original public signature intact. */
export function LiveMeetingView({
  meeting,
  summaryBullets,
  actionItems,
  meetingId,
  initialStatus,
  onAsk,
}: Props) {
  if (meetingId) {
    return (
      <LiveSocketView
        meeting={meeting}
        summaryBullets={summaryBullets}
        actionItems={actionItems}
        meetingId={meetingId}
        initialStatus={initialStatus ?? "ongoing"}
        onAsk={onAsk}
      />
    );
  }
  return (
    <MockView
      meeting={meeting}
      summaryBullets={summaryBullets}
      actionItems={actionItems}
      onAsk={onAsk}
    />
  );
}

function MockView({
  meeting,
  summaryBullets,
  actionItems,
  onAsk,
}: Omit<Props, "meetingId" | "initialStatus">) {
  const { segments, speakers, activeSpeakerId, elapsedSec } =
    useMockTranscript();
  return (
    <LiveLayout
      meeting={meeting}
      summaryBullets={summaryBullets}
      actionItems={actionItems}
      segments={segments}
      speakers={speakers}
      activeSpeakerId={activeSpeakerId}
      elapsedSec={elapsedSec}
      isOngoing
      hasRealInsights
      onAsk={onAsk}
    />
  );
}

function LiveSocketView({
  meeting,
  summaryBullets,
  actionItems,
  meetingId,
  initialStatus,
  onAsk,
}: Props & { meetingId: string; initialStatus: MeetingStatus }) {
  const { segments, speakers, activeSpeakerId, elapsedSec, isOngoing } =
    useLiveTranscript(meetingId, initialStatus);
  const hasRealInsights = summaryBullets.length > 0 || actionItems.length > 0;
  return (
    <LiveLayout
      meeting={meeting}
      detailHref={`/meetings/${meetingId}`}
      summaryBullets={summaryBullets}
      actionItems={actionItems}
      segments={segments}
      speakers={speakers}
      activeSpeakerId={activeSpeakerId}
      elapsedSec={elapsedSec}
      isOngoing={isOngoing}
      hasRealInsights={hasRealInsights}
      onAsk={onAsk}
    />
  );
}

type LayoutProps = {
  meeting: MeetingMeta;
  /** Link back to the meeting detail page (live route only). */
  detailHref?: string;
  summaryBullets: readonly string[];
  actionItems: readonly ActionItem[];
  segments: TranscriptSegment[];
  /** Speakers to render in the rail/stream — derived from live data or mock. */
  speakers: Speaker[];
  activeSpeakerId: string | null;
  elapsedSec: number;
  /** While true, the meeting is live: REC pulses and the clock runs. */
  isOngoing: boolean;
  /** True when real summary/action-item data exists (hides the placeholder). */
  hasRealInsights: boolean;
  onAsk?: Props["onAsk"];
};

function LiveLayout({
  meeting,
  detailHref,
  summaryBullets,
  actionItems,
  segments,
  speakers,
  activeSpeakerId,
  elapsedSec,
  isOngoing,
  hasRealInsights,
  onAsk,
}: LayoutProps) {
  const speakerById = useMemo(() => indexSpeakers(speakers), [speakers]);

  const talkTimeSec = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const segment of segments) {
      const dur = Math.max(0, segment.tEndSec - segment.tStartSec);
      totals[segment.speakerId] = (totals[segment.speakerId] ?? 0) + dur;
    }
    return totals;
  }, [segments]);

  return (
    <main className="grain relative mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
      <MeetingHeader
        title={meeting.title}
        detailHref={detailHref}
        elapsedSec={elapsedSec}
        participantCount={speakers.length}
        isOngoing={isOngoing}
      />

      {!isOngoing && detailHref && <EndedBanner detailHref={detailHref} />}

      <div className="mt-5 grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[200px_minmax(0,1fr)_320px]">
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

        <section
          aria-label="Transcript"
          className="order-first flex min-h-[420px] flex-col rounded-lg border border-border-subtle bg-surface-0 p-4 shadow-soft-sm lg:order-2 lg:min-h-0"
        >
          <div className="min-h-0 flex-1">
            <TranscriptStream segments={segments} speakers={speakers} />
          </div>
          {isOngoing && (
            <>
              <div className="divider-gold my-3" />
              <AskBar speakers={speakers} onAsk={onAsk} />
            </>
          )}
        </section>

        <aside className="flex flex-col gap-4 lg:order-3">
          {hasRealInsights ? (
            <>
              <SummaryCard bullets={summaryBullets} />
              <ActionItemsList items={actionItems} speakerById={speakerById} />
            </>
          ) : (
            <RecapPlaceholder detailHref={detailHref} />
          )}
        </aside>
      </div>
    </main>
  );
}

type HeaderProps = {
  title: string;
  detailHref?: string;
  elapsedSec: number;
  participantCount: number;
  isOngoing: boolean;
};

function MeetingHeader({
  title,
  detailHref,
  elapsedSec,
  participantCount,
  isOngoing,
}: HeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-border-subtle pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {detailHref ? (
          <nav aria-label="Breadcrumb" className="mb-1.5">
            <Link
              href={detailHref}
              className="inline-flex items-center gap-1 text-xs font-semibold tracking-wide text-sage-700 uppercase transition-colors hover:text-sage-800"
            >
              <ChevronLeftIcon />
              Meeting overview
            </Link>
          </nav>
        ) : (
          <p className="eyebrow mb-1">
            {isOngoing ? "Live meeting" : "Live preview"}
          </p>
        )}
        <h1 className="font-display text-2xl text-ink">{title}</h1>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        {isOngoing ? <RecIndicator /> : <EndedPill />}
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

function EndedBanner({ detailHref }: { detailHref: string }) {
  return (
    <section
      aria-label="Meeting ended"
      className="mt-4 flex flex-col gap-3 rounded-lg border border-gold-300 bg-gold-50 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <h2 className="font-display text-base text-ink">
          This meeting has ended
        </h2>
        <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">
          The transcript below is the final capture. The full recap — Summary,
          Transcript &amp; Ask — lives on the meeting page.
        </p>
      </div>
      <Link
        href={detailHref}
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-sage-600 px-4 py-2 text-sm font-semibold text-surface-cream shadow-soft-sm transition-colors hover:bg-sage-700 focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        View full recap
        <ArrowRightIcon />
      </Link>
    </section>
  );
}

function RecapPlaceholder({ detailHref }: { detailHref?: string }) {
  return (
    <section
      aria-label="Summary and action items"
      className="rounded-lg border border-dashed border-border-subtle bg-surface-1 p-4"
    >
      <h2 className="eyebrow mb-3">Live notes &amp; summary</h2>
      <p className="text-sm leading-relaxed text-ink-muted">
        Live notes &amp; summary will appear here — the full recap is generated
        when the meeting ends.
      </p>
      {detailHref && (
        <Link
          href={detailHref}
          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-sage-700 transition-colors hover:text-sage-800"
        >
          Open the meeting page
          <ArrowRightIcon />
        </Link>
      )}
      {detailHref && (
        <p className="mt-2 text-xs leading-relaxed text-ink-muted">
          Summary, Transcript &amp; Ask are on the meeting page.
        </p>
      )}
    </section>
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
        @keyframes parlor-rec-pulse {
          0%, 100% { opacity: 0.55; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1); }
        }
        .parlor-rec-dot {
          animation: parlor-rec-pulse 1.6s var(--ease-in-out, ease-in-out) infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .parlor-rec-dot { animation: none; opacity: 1; }
        }
      `}</style>
      <span
        aria-hidden="true"
        className="parlor-rec-dot block h-2 w-2 rounded-full bg-error"
      />
      <span className="font-sans text-xs font-semibold tracking-wider text-error uppercase">
        Rec
      </span>
    </span>
  );
}

function EndedPill() {
  return (
    <span
      role="status"
      aria-label="Meeting ended"
      className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1"
    >
      <span
        aria-hidden="true"
        className="block h-2 w-2 rounded-full bg-ink-muted"
      />
      <span className="font-sans text-xs font-semibold tracking-wider text-ink-muted uppercase">
        Ended
      </span>
    </span>
  );
}

function SummaryCard({ bullets }: { bullets: readonly string[] }) {
  return (
    <section
      aria-label="AI summary"
      className="rounded-lg border border-border-subtle bg-surface-1 p-4"
    >
      <h2 className="eyebrow mb-3">Summary</h2>
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
  if (items.length === 0) return null;
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
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4">
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
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4">
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

function ChevronLeftIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
      <path
        d="M15 18l-6-6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
