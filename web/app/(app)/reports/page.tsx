import Link from "next/link";
import type { Metadata } from "next";
import { getDigest } from "@/lib/api/reports";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import type { DigestReport } from "@/lib/api/types";
import { BackendDownState } from "@/components/ui/BackendDownState";
import { formatDate, formatDurationLong, formatHours } from "@/lib/format";

export const metadata: Metadata = {
  title: "Reports — Parlor",
};

function Stat({
  label,
  value,
  hint,
  variant = "numeric",
}: {
  label: string;
  value: string;
  hint?: string;
  variant?: "numeric" | "text";
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-0 p-4 shadow-soft-sm">
      <p className="eyebrow mb-2">{label}</p>
      {variant === "numeric" ? (
        <p className="font-display text-2xl tabular-nums text-ink">{value}</p>
      ) : (
        <p className="font-display text-lg text-ink">{value}</p>
      )}
      {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

export default async function ReportsPage() {
  let digest: DigestReport | null = null;
  let backendDown = false;
  try {
    digest = await getDigest();
  } catch (error: unknown) {
    if (ApiError.isApiError(error) && error.code === BACKEND_UNAVAILABLE_CODE) {
      backendDown = true;
    } else {
      throw error;
    }
  }

  if (backendDown) {
    return (
      <div className="mx-auto max-w-3xl">
        <BackendDownState resource="your report" />
      </div>
    );
  }

  const d = digest!;
  const maxAssignee = Math.max(1, ...d.actionItems.byAssignee.map((a) => a.open + a.done));

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <p className="eyebrow mb-1.5">Digest</p>
        <h1 className="font-display text-2xl text-ink">Workspace report</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {formatDate(d.periodFrom)} – {formatDate(d.periodTo)}
        </p>
      </header>

      <section className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Meetings" value={String(d.meetingCount)} hint={`${d.completedCount} completed`} />
        <Stat label="Hours" value={formatHours(d.totalDurationSec)} hint="captured" />
        <Stat label="Avg length" value={formatDurationLong(d.avgDurationSec)} />
        <Stat label="Busiest day" value={d.busiestDay ? formatDate(d.busiestDay) : "—"} variant="text" />
      </section>

      <section className="mb-7">
        <h2 className="mb-3 font-display text-lg text-ink">Action items</h2>
        <div className="rounded-lg border border-border-subtle bg-surface-0 p-5 shadow-soft-sm">
          <div className="mb-4 flex gap-6">
            <div>
              <p className="font-display text-2xl text-ink">{d.actionItems.open}</p>
              <p className="text-xs text-ink-muted">open</p>
            </div>
            <div>
              <p className="font-display text-2xl text-ink">{d.actionItems.done}</p>
              <p className="text-xs text-ink-muted">done</p>
            </div>
            <div>
              <p className="font-display text-2xl text-ink">{d.actionItems.total}</p>
              <p className="text-xs text-ink-muted">total</p>
            </div>
          </div>
          {d.actionItems.byAssignee.length > 0 && (
            <ul className="flex flex-col gap-2.5 border-t border-border-subtle pt-4">
              {d.actionItems.byAssignee.map((a) => {
                const total = a.open + a.done;
                return (
                  <li key={a.assignee} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 truncate text-sm text-ink-soft">{a.assignee}</span>
                    <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full bg-sage-500"
                        style={{ width: `${(a.done / maxAssignee) * 100}%` }}
                      />
                      <div
                        className="h-full bg-gold-300"
                        style={{ width: `${(a.open / maxAssignee) * 100}%` }}
                      />
                    </div>
                    <span className="w-16 shrink-0 text-right font-mono text-xs text-ink-muted">
                      {a.done}/{total}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {d.meetings.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg text-ink">Meetings this period</h2>
          <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-surface-0 shadow-soft-sm">
            {d.meetings.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/meetings/${m.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-1"
                >
                  <span className="truncate text-sm text-ink">{m.title ?? "Untitled meeting"}</span>
                  <span className="shrink-0 font-mono text-xs text-ink-muted">
                    {m.durationSec ? formatDurationLong(m.durationSec) : "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
