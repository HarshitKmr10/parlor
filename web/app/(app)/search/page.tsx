import Link from "next/link";
import type { Metadata } from "next";
import { searchMeetings } from "@/lib/api/search";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import type { SearchResponse } from "@/lib/api/types";
import { SearchBox } from "@/components/search/SearchBox";
import { MarkedSnippet } from "@/components/search/MarkedSnippet";
import { EmptyState } from "@/components/ui/EmptyState";
import { BackendDownState } from "@/components/ui/BackendDownState";
import { SearchIcon } from "@/components/ui/icons";
import { formatDuration } from "@/lib/format";

export const metadata: Metadata = {
  title: "Search — Verdant",
};

type SearchParams = Promise<{ q?: string }>;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  let results: SearchResponse | null = null;
  let backendDown = false;
  if (query.length >= 2) {
    try {
      results = await searchMeetings(query, { limit: 30 });
    } catch (error: unknown) {
      if (ApiError.isApiError(error) && error.code === BACKEND_UNAVAILABLE_CODE) {
        backendDown = true;
      } else {
        throw error;
      }
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <p className="eyebrow mb-1.5">Search</p>
        <h1 className="mb-4 font-display text-2xl text-ink">
          Find anything that was said
        </h1>
        <SearchBox initialQuery={query} autoFocus />
      </header>

      {backendDown ? (
        <BackendDownState resource="search" />
      ) : query.length < 2 ? (
        <EmptyState
          icon={<SearchIcon className="h-6 w-6" />}
          title="Search across every meeting"
          description="Look up a decision, a name, or a phrase — Verdant searches titles, transcripts, and summaries."
        />
      ) : results && results.items.length > 0 ? (
        <>
          <p className="mb-4 text-sm text-ink-muted">
            {results.total} meeting{results.total === 1 ? "" : "s"} match{" "}
            <span className="font-medium text-ink">“{results.query}”</span>
          </p>
          <ul className="flex flex-col gap-3">
            {results.items.map((item) => (
              <li key={item.meetingId}>
                <Link
                  href={`/meetings/${item.meetingId}`}
                  className="block rounded-lg border border-border-subtle bg-surface-0 p-4 shadow-soft-sm transition-colors hover:border-border-strong"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-display text-base text-ink">
                      {item.title ?? "Untitled meeting"}
                    </h2>
                    <span className="shrink-0 text-xs text-ink-faint">
                      {item.matchedSegments} match
                      {item.matchedSegments === 1 ? "" : "es"}
                    </span>
                  </div>
                  {(item.titleMatch || item.summaryMatch) && (
                    <div className="mt-1 flex gap-1.5">
                      {item.titleMatch && (
                        <span className="rounded-full bg-sage-50 px-2 py-0.5 text-xs text-sage-700">
                          title
                        </span>
                      )}
                      {item.summaryMatch && (
                        <span className="rounded-full bg-sage-50 px-2 py-0.5 text-xs text-sage-700">
                          summary
                        </span>
                      )}
                    </div>
                  )}
                  {item.snippets.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-2 border-l-2 border-border-subtle pl-3">
                      {item.snippets.map((s, i) => (
                        <li key={`${s.segmentId}-${i}`} className="text-sm text-ink-soft">
                          <span className="mr-2 font-mono text-xs text-gold-700">
                            {s.speakerName} · {formatDuration(s.tStartSec)}
                          </span>
                          <MarkedSnippet snippet={s.snippet} />
                        </li>
                      ))}
                    </ul>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptyState
          icon={<SearchIcon className="h-6 w-6" />}
          title={`No matches for “${query}”`}
          description="Try a different phrase, a participant's name, or a broader term."
        />
      )}
    </div>
  );
}
