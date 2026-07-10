import Link from "next/link";
import type { Metadata } from "next";
import { listWorkspaceHighlights } from "@/lib/api/highlights";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import type { WorkspaceHighlightListResponse } from "@/lib/api/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { BackendDownState } from "@/components/ui/BackendDownState";
import { HighlightIcon } from "@/components/ui/icons";
import { formatDuration, formatRelative } from "@/lib/format";

export const metadata: Metadata = {
  title: "Highlights — Parlor",
};

const COLOR_DOT: Record<string, string> = {
  gold: "bg-gold-400",
  sage: "bg-sage-500",
};

export default async function HighlightsPage() {
  let reel: WorkspaceHighlightListResponse | null = null;
  let backendDown = false;
  try {
    reel = await listWorkspaceHighlights({ limit: 100 });
  } catch (error: unknown) {
    if (ApiError.isApiError(error) && error.code === BACKEND_UNAVAILABLE_CODE) {
      backendDown = true;
    } else {
      throw error;
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <p className="eyebrow mb-1.5">Reel</p>
        <h1 className="font-display text-2xl text-ink">Highlights</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Every moment your team marked, across all meetings.
        </p>
      </header>

      {backendDown ? (
        <BackendDownState resource="highlights" />
      ) : reel && reel.items.length > 0 ? (
        <ul className="flex flex-col gap-2.5">
          {reel.items.map((h) => (
            <li key={h.id}>
              <Link
                href={`/meetings/${h.meetingId}#highlights`}
                className="flex items-start gap-3 rounded-lg border border-border-subtle bg-surface-0 p-4 shadow-soft-sm transition-colors hover:border-border-strong"
              >
                <span
                  aria-hidden="true"
                  className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${COLOR_DOT[h.color ?? ""] ?? "bg-gold-400"}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="whitespace-nowrap font-mono text-xs text-gold-700">
                      {formatDuration(h.tStartSec)} – {formatDuration(h.tEndSec)}
                    </span>
                    {h.label && (
                      <span className="truncate font-display text-lg font-medium text-ink">
                        {h.label}
                      </span>
                    )}
                  </div>
                  {h.excerpt && (
                    <p className="mt-1 line-clamp-2 text-sm text-ink-soft">“{h.excerpt}”</p>
                  )}
                  <p className="mt-1.5 text-xs text-ink-faint">
                    {h.meetingTitle ?? "Meeting"} · {formatRelative(h.createdAt)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<HighlightIcon className="h-6 w-6" />}
          title="No highlights yet"
          description="Open a meeting and mark the moments worth coming back to. They'll collect here as a reel."
        />
      )}
    </div>
  );
}
