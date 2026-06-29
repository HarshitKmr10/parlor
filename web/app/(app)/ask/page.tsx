import type { Metadata } from "next";
import Link from "next/link";
import { listMeetings } from "@/lib/api/meetings";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import type { Meeting } from "@/lib/api/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { BackendDownState } from "@/components/ui/BackendDownState";
import { AskIcon, MeetingsIcon } from "@/components/ui/icons";
import { formatDateTime } from "@/lib/format";
import { WorkspaceAsk } from "@/components/ask/WorkspaceAsk";

export const metadata: Metadata = {
  title: "Ask — Verdant",
};

export default async function AskPage() {
  let meetings: Meeting[] = [];
  let backendDown = false;
  try {
    const result = await listMeetings({ status: "completed", limit: 12 });
    meetings = result.items;
  } catch (error: unknown) {
    if (ApiError.isApiError(error) && error.code === BACKEND_UNAVAILABLE_CODE) {
      backendDown = true;
    } else {
      throw error;
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-7">
        <p className="eyebrow mb-1.5">Knowledge</p>
        <h1 className="font-display text-2xl text-ink">Ask Verdant</h1>
        <p className="mt-1.5 max-w-xl text-sm text-ink-muted">
          Ask one question across every meeting, or pick a single meeting to
          dig in. Answers are grounded in transcripts with traceable citations.
        </p>
      </header>

      {!backendDown && (
        <section className="mb-10">
          <WorkspaceAsk />
        </section>
      )}

      {!backendDown && meetings.length > 0 && (
        <h2 className="eyebrow mb-3">Or ask a single meeting</h2>
      )}

      {backendDown ? (
        <BackendDownState resource="your meetings" />
      ) : meetings.length === 0 ? (
        <EmptyState
          icon={<AskIcon className="h-6 w-6" />}
          title="Nothing to ask yet"
          description="Once you've captured a meeting, you can ask Verdant anything about it."
          action={
            <Link
              href="/meetings"
              className="rounded-md bg-sage-600 px-4 py-2.5 text-sm font-medium text-surface-cream shadow-soft-sm transition-colors hover:bg-sage-700"
            >
              Go to meetings
            </Link>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {meetings.map((meeting) => (
            <li key={meeting.id}>
              <Link
                href={`/meetings/${meeting.id}#ask`}
                className="group flex h-full flex-col rounded-lg border border-border-subtle bg-surface-0 p-4 shadow-soft-sm transition-colors hover:border-border-default hover:bg-surface-1"
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-sage-50 text-sage-600"
                  >
                    <MeetingsIcon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink group-hover:text-sage-700">
                    {meeting.title}
                  </span>
                </span>
                <span className="mt-2 text-xs text-ink-muted">
                  {formatDateTime(meeting.startedAt ?? meeting.createdAt)}
                </span>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-sage-700">
                  <AskIcon className="h-4 w-4" />
                  Ask this meeting
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
