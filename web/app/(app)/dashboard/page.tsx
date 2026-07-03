import type { Metadata } from "next";
import Link from "next/link";
import { listMeetings } from "@/lib/api/meetings";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import type { Meeting } from "@/lib/api/types";
import { StatCard } from "@/components/dashboard/StatCard";
import { MeetingRow } from "@/components/meetings/MeetingRow";
import { NewMeetingButton } from "@/components/meetings/NewMeetingButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { BackendDownState } from "@/components/ui/BackendDownState";
import { ClockIcon, ListIcon, MeetingsIcon } from "@/components/ui/icons";
import { formatHours } from "@/lib/format";

export const metadata: Metadata = {
  title: "Dashboard — Parlor",
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function startOfWeek(meeting: Meeting): boolean {
  const stamp = meeting.startedAt ?? meeting.createdAt;
  const date = new Date(stamp).getTime();
  return !Number.isNaN(date) && Date.now() - date <= WEEK_MS;
}

function computeKpis(meetings: Meeting[]) {
  const thisWeek = meetings.filter(startOfWeek);
  const hoursCaptured = meetings.reduce(
    (total, meeting) => total + (meeting.durationSec ?? 0),
    0,
  );
  // ActionItem open-count isn't on the list payload; approximate via summaries
  // present (each completed meeting carries insights with action items).
  const withSummary = meetings.filter((m) => m.hasSummary).length;
  return {
    thisWeekCount: thisWeek.length,
    hoursCaptured,
    summarized: withSummary,
  };
}

export default async function DashboardPage() {
  let meetings: Meeting[] = [];
  let backendDown = false;
  try {
    const result = await listMeetings({ limit: 50 });
    meetings = result.items;
  } catch (error: unknown) {
    if (ApiError.isApiError(error) && error.code === BACKEND_UNAVAILABLE_CODE) {
      backendDown = true;
    } else {
      throw error;
    }
  }

  const kpis = computeKpis(meetings);
  const recent = meetings.slice(0, 6);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-1.5">Overview</p>
          <h1 className="font-display text-2xl text-ink">Dashboard</h1>
        </div>
        <NewMeetingButton />
      </header>

      {backendDown ? (
        <BackendDownState resource="your dashboard" />
      ) : (
        <>
          <section
            aria-label="Key metrics"
            className="grid grid-cols-1 gap-4 sm:grid-cols-3"
          >
            <StatCard
              label="Meetings this week"
              value={String(kpis.thisWeekCount)}
              hint={`${meetings.length} total captured`}
              icon={<MeetingsIcon className="h-4 w-4" />}
            />
            <StatCard
              label="Hours captured"
              value={formatHours(kpis.hoursCaptured)}
              hint="Across all recorded calls"
              icon={<ClockIcon className="h-4 w-4" />}
            />
            <StatCard
              label="Summarized"
              value={String(kpis.summarized)}
              hint="Meetings with AI insights"
              icon={<ListIcon className="h-4 w-4" />}
              accent
            />
          </section>

          <section aria-label="Recent meetings" className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg text-ink">Recent meetings</h2>
              <Link
                href="/meetings"
                className="text-sm font-medium text-sage-700 underline-offset-2 hover:underline"
              >
                View all
              </Link>
            </div>

            {recent.length === 0 ? (
              <EmptyState
                icon={<MeetingsIcon className="h-6 w-6" />}
                title="No meetings yet"
                description="Add a meeting link and Parlor will join, transcribe, and summarize it for you."
                action={<NewMeetingButton />}
              />
            ) : (
              <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-0 shadow-soft-sm">
                <ul className="divide-y divide-border-subtle">
                  {recent.map((meeting) => (
                    <li key={meeting.id}>
                      <MeetingRow meeting={meeting} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
