import type { MeetingAnalytics, Sentiment, SpeakerStat } from "@/lib/api/types";
import { formatDuration } from "@/lib/format";

type Props = {
  analytics: MeetingAnalytics;
};

const SENTIMENT_STYLE: Record<Sentiment, { label: string; className: string }> = {
  positive: { label: "Positive", className: "bg-success-bg text-success" },
  neutral: { label: "Neutral", className: "bg-surface-2 text-ink-soft" },
  negative: { label: "Negative", className: "bg-error-bg text-error" },
};

// Speaker bar tints cycle through the brand palette for a legible stack.
const BAR_TINTS = [
  "bg-sage-500",
  "bg-gold-400",
  "bg-sage-300",
  "bg-gold-600",
  "bg-sage-700",
  "bg-gold-300",
];

function SentimentChip({ sentiment }: { sentiment: Sentiment }) {
  const s = SENTIMENT_STYLE[sentiment];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.className}`}
    >
      {s.label}
    </span>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-0 p-4 shadow-soft-sm">
      <p className="eyebrow mb-2">{label}</p>
      <p className="font-display text-2xl text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

function SpeakerBar({ speaker, tint }: { speaker: SpeakerStat; tint: string }) {
  const pct = Math.round(speaker.talkRatio * 100);
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-sans text-sm font-medium text-ink">
            {speaker.speakerName}
          </span>
          <SentimentChip sentiment={speaker.sentiment} />
        </div>
        <span className="font-mono text-xs text-ink-muted">
          {formatDuration(speaker.talkTimeSec)} · {pct}%
        </span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2"
        role="img"
        aria-label={`${speaker.speakerName} spoke ${pct}% of the time`}
      >
        <div
          className={`h-full rounded-full ${tint} transition-[width] duration-500`}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-ink-muted">
        <span>{speaker.wordCount.toLocaleString()} words</span>
        <span>{Math.round(speaker.wordsPerMinute)} wpm</span>
        <span>{speaker.turns} turns</span>
        {speaker.questionsAsked > 0 && <span>{speaker.questionsAsked} questions</span>}
      </div>
    </li>
  );
}

export function AnalyticsTab({ analytics }: Props) {
  if (analytics.numSpeakers === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border-default bg-surface-1/60 px-5 py-10 text-center text-sm text-ink-muted">
        Analytics will appear once this meeting has a transcript with diarized
        speakers.
      </p>
    );
  }

  const sortedSpeakers = [...analytics.speakers].sort(
    (a, b) => b.talkRatio - a.talkRatio,
  );

  return (
    <div className="flex flex-col gap-7">
      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="Pace"
            value={`${Math.round(analytics.wordsPerMinute)}`}
            hint="words / min"
          />
          <Stat
            label="Interactivity"
            value={`${Math.round(analytics.interactivityScore)}`}
            hint={`${analytics.numTurns} turns`}
          />
          <Stat
            label="Balance"
            value={`${Math.round(analytics.balanceScore)}`}
            hint="even talk-time"
          />
          <div className="rounded-lg border border-border-subtle bg-surface-0 p-4 shadow-soft-sm">
            <p className="eyebrow mb-2">Sentiment</p>
            <SentimentChip sentiment={analytics.overallSentiment} />
            <p className="mt-1.5 text-xs text-ink-muted">
              {analytics.questionCount} questions asked
            </p>
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-display text-lg text-ink">Talk time</h3>
        <ul className="flex flex-col gap-4">
          {sortedSpeakers.map((speaker, i) => (
            <SpeakerBar
              key={speaker.speakerName}
              speaker={speaker}
              tint={BAR_TINTS[i % BAR_TINTS.length]}
            />
          ))}
        </ul>
      </section>

      {analytics.longestMonologueSpeaker && (
        <section className="rounded-lg border border-border-subtle bg-surface-1/60 px-5 py-4">
          <p className="eyebrow mb-1">Longest monologue</p>
          <p className="text-sm text-ink-soft">
            <span className="font-medium text-ink">
              {analytics.longestMonologueSpeaker}
            </span>{" "}
            held the floor for{" "}
            <span className="font-mono">
              {formatDuration(analytics.longestMonologueSec)}
            </span>
            .
          </p>
        </section>
      )}
    </div>
  );
}
