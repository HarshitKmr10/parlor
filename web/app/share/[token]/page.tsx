import type { Metadata } from "next";
import { getPublicShare } from "@/lib/api/shares";
import type { PublicMeetingView } from "@/lib/api/types";
import { SummaryTab } from "@/components/meetings/detail/SummaryTab";
import { AnalyticsTab } from "@/components/meetings/detail/AnalyticsTab";
import { formatDurationLong } from "@/lib/format";

export const metadata: Metadata = {
  title: "Shared recap — Verdant",
  robots: { index: false, follow: false },
};

type Params = Promise<{ token: string }>;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface-0">
      <header className="border-b border-border-subtle">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <span className="font-display text-lg text-ink">Verdant</span>
          <a
            href="/signup"
            className="rounded-md bg-sage-600 px-3 py-1.5 text-sm font-medium text-surface-cream hover:bg-sage-700"
          >
            Try Verdant
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10">{children}</main>
    </div>
  );
}

export default async function PublicSharePage({ params }: { params: Params }) {
  const { token } = await params;

  let view: PublicMeetingView;
  try {
    view = await getPublicShare(token);
  } catch {
    return (
      <Shell>
        <div className="rounded-lg border border-dashed border-border-default bg-surface-1/60 px-6 py-16 text-center">
          <h1 className="font-display text-xl text-ink">This link isn’t available</h1>
          <p className="mt-2 text-sm text-ink-muted">
            The share link is invalid, was revoked, or has expired.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <article className="flex flex-col gap-8">
        <header>
          <p className="eyebrow mb-1.5">Shared recap</p>
          <h1 className="font-display text-3xl text-ink">
            {view.title ?? "Meeting recap"}
          </h1>
          {view.durationSec ? (
            <p className="mt-1 text-sm text-ink-muted">
              {formatDurationLong(view.durationSec)}
            </p>
          ) : null}
        </header>

        {(view.summary || view.keyPoints.length > 0) && (
          <section>
            <SummaryTab
              insights={{
                summary: view.summary,
                keyPoints: view.keyPoints,
                actionItems: view.actionItems,
                chapters: view.chapters,
              }}
            />
          </section>
        )}

        {view.highlights && view.highlights.length > 0 && (
          <section>
            <h2 className="mb-3 font-display text-lg text-ink">Highlights</h2>
            <ul className="flex flex-col gap-2">
              {view.highlights.map((h, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-border-subtle bg-surface-0 p-3.5 shadow-soft-sm"
                >
                  {h.label && (
                    <p className="font-sans text-sm font-medium text-ink">{h.label}</p>
                  )}
                  {h.excerpt && (
                    <p className="mt-1 text-sm text-ink-soft">“{h.excerpt}”</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {view.analytics && (
          <section>
            <h2 className="mb-3 font-display text-lg text-ink">Analytics</h2>
            <AnalyticsTab analytics={view.analytics} />
          </section>
        )}

        <footer className="border-t border-border-subtle pt-6 text-center text-xs text-ink-faint">
          Captured and summarized with Verdant.
        </footer>
      </article>
    </Shell>
  );
}
