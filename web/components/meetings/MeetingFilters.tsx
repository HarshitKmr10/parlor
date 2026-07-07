import Link from "next/link";
import type { MeetingStatus } from "@/lib/api/types";

type FilterValue = MeetingStatus | "all";

const FILTERS: { label: string; value: FilterValue }[] = [
  { label: "All", value: "all" },
  { label: "Live", value: "ongoing" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
];

type Props = {
  active: FilterValue;
};

/** URL-driven status filter links. Each one is a full navigation that resets pagination. */
export function MeetingFilters({ active }: Props) {
  return (
    <nav aria-label="Filter meetings by status" className="flex flex-wrap gap-1.5">
      {FILTERS.map((filter) => {
        const isActive = filter.value === active;
        const href =
          filter.value === "all" ? "/meetings" : `/meetings?status=${filter.value}`;
        return (
          <Link
            key={filter.value}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-sage-600 text-surface-cream shadow-soft-sm"
                : "border border-border-subtle bg-surface-0 text-ink-soft hover:border-border-default hover:text-ink"
            }`}
          >
            {filter.label}
          </Link>
        );
      })}
    </nav>
  );
}
