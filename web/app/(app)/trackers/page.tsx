import Link from "next/link";
import type { Metadata } from "next";
import { listTrackers, listTrackerHits } from "@/lib/api/trackers";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import type { Tracker, TrackerHit } from "@/lib/api/types";
import { TrackersManager } from "@/components/trackers/TrackersManager";
import { BackendDownState } from "@/components/ui/BackendDownState";
import { formatDuration, formatRelative } from "@/lib/format";

export const metadata: Metadata = {
  title: "Trackers — Verdant",
};

export default async function TrackersPage() {
  let trackers: Tracker[] = [];
  let hits: TrackerHit[] = [];
  let backendDown = false;
  try {
    const [t, h] = await Promise.all([listTrackers(), listTrackerHits()]);
    trackers = t;
    hits = h.items;
  } catch (error: unknown) {
    if (ApiError.isApiError(error) && error.code === BACKEND_UNAVAILABLE_CODE) {
      backendDown = true;
    } else {
      throw error;
    }
  }

  const nameById = new Map(trackers.map((t) => [t.id, t.name]));

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <p className="eyebrow mb-1.5">Monitors</p>
        <h1 className="font-display text-2xl text-ink">Trackers</h1>
        <p className="mt-1.5 max-w-xl text-sm text-ink-muted">
          Define topics to watch for — competitors, pricing, next steps. Verdant
          flags every mention across your meetings.
        </p>
      </header>

      {backendDown ? (
        <BackendDownState resource="trackers" />
      ) : (
        <>
          <TrackersManager initial={trackers} />

          <section className="mt-9">
            <h2 className="mb-3 font-display text-lg text-ink">Recent hits</h2>
            {hits.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border-default bg-surface-1/60 px-5 py-10 text-center text-sm text-ink-muted">
                No hits yet. Hits appear as new meetings are summarized.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {hits.map((h) => (
                  <li key={h.id}>
                    <Link
                      href={`/meetings/${h.meetingId}`}
                      className="block rounded-lg border border-border-subtle bg-surface-0 p-3.5 shadow-soft-sm transition-colors hover:border-border-strong"
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-gold-100 px-2 py-0.5 text-xs font-semibold text-gold-700">
                          {nameById.get(h.trackerId) ?? "Tracker"}
                        </span>
                        <span className="font-mono text-xs text-ink-faint">
                          “{h.matchedKeyword}” · {formatDuration(h.tStartSec)}
                        </span>
                        <span className="ml-auto text-xs text-ink-faint">
                          {formatRelative(h.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{h.snippet}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
