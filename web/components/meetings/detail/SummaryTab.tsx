import type { MeetingInsights } from "@/lib/api/types";
import { formatDuration } from "@/lib/format";
import { CheckIcon, ClockIcon } from "@/components/ui/icons";

type Props = {
  insights: MeetingInsights;
};

export function SummaryTab({ insights }: Props) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-6">
        <section aria-labelledby="summary-heading">
          <h2 id="summary-heading" className="eyebrow mb-2">
            Summary
          </h2>
          <p className="text-base leading-relaxed text-ink-soft">
            {insights.summary}
          </p>
        </section>

        {insights.keyPoints.length > 0 && (
          <section aria-labelledby="keypoints-heading">
            <h2 id="keypoints-heading" className="eyebrow mb-3">
              Key points
            </h2>
            <ul className="flex flex-col gap-2.5">
              {insights.keyPoints.map((point) => (
                <li
                  key={point}
                  className="flex gap-2.5 text-sm leading-relaxed text-ink-soft"
                >
                  <span
                    aria-hidden="true"
                    className="mt-2 block h-1.5 w-1.5 shrink-0 rounded-full bg-sage-400"
                  />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {insights.actionItems.length > 0 && (
          <section aria-labelledby="actions-heading">
            <h2 id="actions-heading" className="eyebrow mb-3">
              Action items
            </h2>
            <ul className="flex flex-col gap-2.5">
              {insights.actionItems.map((item) => (
                <li
                  key={item.id}
                  className="rounded-md bg-gold-50 px-3.5 py-3"
                  style={{ borderLeft: "3px solid var(--color-gold-400)" }}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border ${
                        item.done
                          ? "border-sage-600 bg-sage-600 text-surface-cream"
                          : "border-gold-300 bg-surface-0"
                      }`}
                    >
                      {item.done && <CheckIcon className="h-3 w-3" />}
                    </span>
                    <div className="min-w-0">
                      <p
                        className={`text-sm leading-snug ${
                          item.done
                            ? "text-ink-muted line-through"
                            : "text-ink"
                        }`}
                      >
                        {item.text}
                      </p>
                      {(item.assignee || item.dueDate) && (
                        <p className="mt-1 text-xs font-medium text-gold-700">
                          {item.assignee}
                          {item.assignee && item.dueDate ? " · " : ""}
                          {item.dueDate ? `due ${item.dueDate}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {insights.chapters.length > 0 && (
        <aside aria-labelledby="chapters-heading">
          <div className="sticky top-24 rounded-lg border border-border-subtle bg-surface-1 p-4">
            <h2 id="chapters-heading" className="eyebrow mb-3">
              Chapters
            </h2>
            <ol className="flex flex-col gap-2.5">
              {insights.chapters.map((chapter) => (
                <li key={chapter.id} className="flex items-baseline gap-2.5">
                  <span className="inline-flex shrink-0 items-center gap-1 font-mono text-xs text-ink-muted tabular-nums">
                    <ClockIcon className="h-3 w-3" />
                    {formatDuration(chapter.tStartSec)}
                  </span>
                  <span className="text-sm leading-snug text-ink-soft">
                    {chapter.title}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      )}
    </div>
  );
}
