import type { CoachingScorecard } from "@/lib/api/types";
import { formatDuration } from "@/lib/format";

type Props = {
  coaching: CoachingScorecard;
};

const GRADE_COLOR: Record<string, string> = {
  A: "bg-success-bg text-success",
  B: "bg-success-bg text-success",
  C: "bg-warning-bg text-gold-700",
  D: "bg-warning-bg text-gold-700",
  F: "bg-error-bg text-error",
};

export function CoachingTab({ coaching }: Props) {
  if (coaching.perSpeaker.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border-default bg-surface-1/60 px-5 py-10 text-center text-sm text-ink-muted">
        A coaching scorecard appears once this meeting has a transcript.
      </p>
    );
  }

  const gradeClass = GRADE_COLOR[coaching.overallGrade] ?? "bg-surface-2 text-ink-soft";

  return (
    <div className="flex flex-col gap-7">
      <section className="flex items-center gap-5 rounded-lg border border-border-subtle bg-surface-0 p-5 shadow-soft-sm">
        <div
          className={`grid h-16 w-16 shrink-0 place-items-center rounded-full font-display text-3xl ${gradeClass}`}
          aria-label={`Overall grade ${coaching.overallGrade}`}
        >
          {coaching.overallGrade}
        </div>
        <div>
          <p className="eyebrow mb-1">Coaching score</p>
          <p className="font-display text-2xl text-ink">{coaching.overallScore}/100</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            Balance {Math.round(coaching.balanceScore)} · {coaching.questionCount} questions ·
            longest monologue {formatDuration(coaching.longestMonologueSec)}
          </p>
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-display text-lg text-ink">Coaching tips</h3>
        <ul className="flex flex-col gap-2">
          {coaching.tips.map((tip, i) => (
            <li
              key={i}
              className="rounded-lg border border-border-subtle bg-surface-1/60 px-4 py-3 text-sm text-ink-soft"
            >
              {tip}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-3 font-display text-lg text-ink">By speaker</h3>
        <ul className="flex flex-col gap-2">
          {coaching.perSpeaker.map((s) => (
            <li
              key={s.speakerName}
              className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-0 p-3.5 shadow-soft-sm"
            >
              <span className="font-sans text-sm font-medium text-ink">{s.speakerName}</span>
              <span className="flex flex-wrap gap-x-4 text-xs text-ink-muted">
                <span>{Math.round(s.talkRatio * 100)}% talk</span>
                <span>{s.wordsPerMinute} wpm</span>
                <span>{s.questionsAsked} questions</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
