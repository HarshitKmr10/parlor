import type { Metadata } from "next";
import { getPublicShare } from "@/lib/api/shares";
import { ApiError } from "@/lib/api/error";
import type { PublicMeetingView } from "@/lib/api/types";
import { SummaryTab } from "@/components/meetings/detail/SummaryTab";
import { AnalyticsTab } from "@/components/meetings/detail/AnalyticsTab";
import { formatDurationLong } from "@/lib/format";

export const metadata: Metadata = {
  title: "Shared recap — Parlor",
  robots: { index: false, follow: false },
};

type Params = Promise<{ token: string }>;
type Search = Promise<{ passcode?: string | string[] }>;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface-0">
      <header className="border-b border-border-subtle">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <span className="font-display text-lg text-ink">Parlor</span>
          <a
            href="/signup"
            className="rounded-md bg-sage-600 px-3 py-1.5 text-sm font-medium text-surface-cream hover:bg-sage-700"
          >
            Try Parlor
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10">{children}</main>
    </div>
  );
}

function PasscodePrompt({
  token,
  invalid,
}: {
  token: string;
  invalid: boolean;
}) {
  return (
    <Shell>
      <div className="mx-auto max-w-sm rounded-lg border border-border-default bg-surface-1/60 px-6 py-12 text-center">
        <h1 className="font-display text-xl text-ink">Enter passcode</h1>
        <p className="mt-2 text-sm text-ink-muted">
          This shared recap is protected. Enter its passcode to continue.
        </p>
        <form
          method="get"
          action={`/share/${token}`}
          className="mt-6 flex flex-col gap-3"
        >
          <input
            type="password"
            name="passcode"
            autoFocus
            required
            placeholder="Passcode"
            aria-label="Passcode"
            className="rounded-md border border-border-default bg-surface-0 px-3 py-2 text-sm text-ink outline-none focus:border-sage-600"
          />
          {invalid ? (
            <p className="text-sm text-red-600" role="alert">
              That passcode is incorrect. Try again.
            </p>
          ) : null}
          <button
            type="submit"
            className="rounded-md bg-sage-600 px-3 py-2 text-sm font-medium text-surface-cream hover:bg-sage-700"
          >
            Unlock
          </button>
        </form>
      </div>
    </Shell>
  );
}

export default async function PublicSharePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { token } = await params;
  const { passcode: rawPasscode } = await searchParams;
  const passcode = Array.isArray(rawPasscode) ? rawPasscode[0] : rawPasscode;

  let view: PublicMeetingView;
  try {
    view = await getPublicShare(token, passcode);
  } catch (error) {
    if (ApiError.isApiError(error)) {
      if (error.code === "passcode_required") {
        return <PasscodePrompt token={token} invalid={false} />;
      }
      if (error.code === "invalid_passcode") {
        return <PasscodePrompt token={token} invalid={true} />;
      }
    }
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
          Captured and summarized with Parlor.
        </footer>
      </article>
    </Shell>
  );
}
