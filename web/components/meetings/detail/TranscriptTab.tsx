import type { TranscriptSegment } from "@/lib/api/types";
import { formatDuration } from "@/lib/format";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListIcon } from "@/components/ui/icons";

type Props = {
  segments: TranscriptSegment[];
};

/** Sage text tints (AA-safe) cycled per distinct speaker, gold reserved. */
const SPEAKER_TINTS = ["text-sage-700", "text-sage-600", "text-sage-500"];

function tintForSpeaker(speakerId: string, order: Map<string, number>): string {
  if (!order.has(speakerId)) order.set(speakerId, order.size);
  const index = order.get(speakerId) ?? 0;
  return SPEAKER_TINTS[index % SPEAKER_TINTS.length];
}

export function TranscriptTab({ segments }: Props) {
  if (segments.length === 0) {
    return (
      <EmptyState
        icon={<ListIcon className="h-6 w-6" />}
        title="No transcript yet"
        description="When this meeting is captured, the full transcript will appear here with timestamps and speakers."
      />
    );
  }

  const speakerOrder = new Map<string, number>();

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-0 p-4 shadow-soft-sm sm:p-6">
      <ol className="flex flex-col gap-5">
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
