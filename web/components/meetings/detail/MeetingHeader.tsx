import Link from "next/link";
import type { MeetingDetail } from "@/lib/api/types";
import { StatusChip } from "@/components/ui/StatusChip";
import { formatDateTime, formatDurationLong } from "@/lib/format";
import { ClockIcon } from "@/components/ui/icons";

type Props = {
  meeting: MeetingDetail;
};

const PLATFORM_LABEL: Record<MeetingDetail["platform"], string> = {
  zoom: "Zoom",
  meet: "Google Meet",
  teams: "Microsoft Teams",
};

export function MeetingHeader({ meeting }: Props) {
  const isLive = meeting.status === "ongoing" || meeting.status === "joining";
  const timestamp =
    meeting.startedAt ?? meeting.scheduledAt ?? meeting.createdAt;

  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-center gap-3 text-sm text-ink-muted">
        <Link
          href="/meetings"
          className="transition-colors hover:text-ink-soft"
        >
          Meetings
        </Link>
        <span aria-hidden="true">/</span>
        <span className="truncate text-ink-soft">{meeting.title}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-3">
            <StatusChip status={meeting.status} />
            {isLive && (
              <Link
                href={`/meetings/${meeting.id}/live`}
                className="text-sm font-medium text-sage-700 underline-offset-2 hover:underline"
              >
                Watch live →
              </Link>
            )}
          </div>
          <h1 className="font-display text-2xl leading-tight text-ink sm:text-3xl">
            {meeting.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
            <span>{PLATFORM_LABEL[meeting.platform]}</span>
            <span aria-hidden="true">·</span>
            <span>{formatDateTime(timestamp)}</span>
            {meeting.durationSec ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <ClockIcon className="h-3.5 w-3.5" />
                  {formatDurationLong(meeting.durationSec)}
                </span>
              </>
            ) : null}
            {meeting.participants.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>{meeting.participants.length} participants</span>
              </>
            )}
          </div>
        </div>
      </div>

      <AudioPlayerPlaceholder hasRecording={meeting.hasRecording} />
    </header>
  );
}

function AudioPlayerPlaceholder({ hasRecording }: { hasRecording: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface-1 px-4 py-3">
      <button
        type="button"
        disabled
        aria-label="Play recording (coming soon)"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sage-600 text-surface-cream opacity-60"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>
      <span
        aria-hidden="true"
        className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3"
      >
        <span className="block h-full w-0 rounded-full bg-sage-400" />
      </span>
      <span className="shrink-0 font-mono text-xs text-ink-muted">
        {hasRecording ? "Recording available" : "No recording"}
      </span>
    </div>
  );
}
