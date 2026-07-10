import Link from "next/link";
import type { Meeting } from "@/lib/api/types";
import { StatusChip } from "@/components/ui/StatusChip";
import { formatDateTime, formatDurationLong } from "@/lib/format";

type Props = {
  meeting: Meeting;
};

const PLATFORM_LABEL: Record<Meeting["platform"], string> = {
  zoom: "Zoom",
  meet: "Google Meet",
  teams: "Microsoft Teams",
};

export function MeetingRow({ meeting }: Props) {
  const isLive = meeting.status === "ongoing" || meeting.status === "joining";
  const href = isLive
    ? `/meetings/${meeting.id}/live`
    : `/meetings/${meeting.id}`;
  const timestamp =
    meeting.startedAt ?? meeting.scheduledAt ?? meeting.createdAt;

  return (
    <Link
      href={href}
      className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-1"
    >
      <span
        aria-hidden="true"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-sage-50 font-display text-sm font-semibold text-sage-700"
      >
        {meeting.title.charAt(0).toUpperCase()}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-lg font-medium text-ink group-hover:text-sage-700">
          {meeting.title}
        </span>
        <span className="mt-0.5 block truncate text-xs text-ink-muted">
          {PLATFORM_LABEL[meeting.platform]} · {formatDateTime(timestamp)}
          {meeting.durationSec
            ? ` · ${formatDurationLong(meeting.durationSec)}`
            : ""}
        </span>
      </span>

      <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
        {meeting.hasSummary && (
          <span className="rounded-full bg-gold-50 px-2 py-0.5 text-xs font-medium text-gold-700">
            Summary
          </span>
        )}
      </span>

      <StatusChip status={meeting.status} />
    </Link>
  );
}
