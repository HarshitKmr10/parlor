import type { Metadata } from "next";
import { listMeetings } from "@/lib/api/meetings";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import type { Meeting, MeetingStatus, Paginated } from "@/lib/api/types";
import { MeetingRow } from "@/components/meetings/MeetingRow";
import { MeetingFilters } from "@/components/meetings/MeetingFilters";
import { Pagination } from "@/components/meetings/Pagination";
import { NewMeetingButton } from "@/components/meetings/NewMeetingButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { BackendDownState } from "@/components/ui/BackendDownState";
import { MeetingsIcon } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Meetings — Verdant",
};

const PAGE_SIZE = 20;
const VALID_STATUSES: MeetingStatus[] = [
  "scheduled",
  "joining",
  "ongoing",
  "completed",
  "failed",
];

type SearchParams = Promise<{ status?: string; offset?: string }>;

function parseStatus(value: string | undefined): MeetingStatus | undefined {
  if (value && VALID_STATUSES.includes(value as MeetingStatus)) {
    return value as MeetingStatus;
  }
  return undefined;
}

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const status = parseStatus(params.status);
  const offset = Math.max(0, Number.parseInt(params.offset ?? "0", 10) || 0);

  let page: Paginated<Meeting> | null = null;
  let backendDown = false;
  try {
    page = await listMeetings({ status, limit: PAGE_SIZE, offset });
  } catch (error: unknown) {
    if (ApiError.isApiError(error) && error.code === BACKEND_UNAVAILABLE_CODE) {
      backendDown = true;
    } else {
      throw error;
    }
  }

  const buildHref = (nextOffset: number): string => {
    const search = new URLSearchParams();
    if (status) search.set("status", status);
    if (nextOffset > 0) search.set("offset", String(nextOffset));
    const query = search.toString();
    return query ? `/meetings?${query}` : "/meetings";
  };

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-1.5">Library</p>
          <h1 className="font-display text-2xl text-ink">Meetings</h1>
        </div>
        <NewMeetingButton />
      </header>

      {backendDown ? (
        <BackendDownState resource="your meetings" />
      ) : (
        <>
          <div className="mb-5">
            <MeetingFilters active={status ?? "all"} />
          </div>

          {page && page.items.length > 0 ? (
            <>
              <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-0 shadow-soft-sm">
                <ul className="divide-y divide-border-subtle">
                  {page.items.map((meeting) => (
                    <li key={meeting.id}>
                      <MeetingRow meeting={meeting} />
                    </li>
                  ))}
                </ul>
              </div>
              <Pagination
                total={page.total}
                limit={page.limit}
                offset={page.offset}
                buildHref={buildHref}
              />
            </>
          ) : (
            <EmptyState
              icon={<MeetingsIcon className="h-6 w-6" />}
              title={status ? "No meetings match this filter" : "No meetings yet"}
              description={
                status
                  ? "Try a different status, or add a new meeting to get started."
                  : "Paste a Zoom, Meet, or Teams link and Verdant will join, transcribe, and summarize it."
              }
              action={<NewMeetingButton />}
            />
          )}
        </>
      )}
    </div>
  );
}
