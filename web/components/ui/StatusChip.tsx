import type { MeetingStatus } from "@/lib/api/types";

type Props = {
  status: MeetingStatus;
};

const STATUS_CONFIG: Record<
  MeetingStatus,
  { label: string; className: string; pulse: boolean }
> = {
  scheduled: {
    label: "Scheduled",
    className: "bg-info-bg text-info",
    pulse: false,
  },
  joining: {
    label: "Joining",
    className: "bg-warning-bg text-gold-700",
    pulse: true,
  },
  ongoing: {
    label: "Live",
    className: "bg-error-bg text-error",
    pulse: true,
  },
  completed: {
    label: "Completed",
    className: "bg-success-bg text-success",
    pulse: false,
  },
  failed: {
    label: "Failed",
    className: "bg-error-bg text-error",
    pulse: false,
  },
};

export function StatusChip({ status }: Props) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-sans text-xs font-semibold tracking-wide ${config.className}`}
    >
      {config.pulse && (
        <span
          aria-hidden="true"
          className="block h-1.5 w-1.5 animate-pulse rounded-full bg-current"
        />
      )}
      {config.label}
    </span>
  );
}
