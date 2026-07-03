import type { Metadata } from "next";
import Link from "next/link";
import { getUsage } from "@/lib/api/usage";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import type { UsageSummary } from "@/lib/api/types";
import { BackendDownState } from "@/components/ui/BackendDownState";

export const metadata: Metadata = {
  title: "Usage — Parlor",
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-0 p-4 shadow-soft-sm">
      <p className="eyebrow mb-2">{label}</p>
      <p className="font-display text-2xl text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

export default async function UsagePage() {
  let usage: UsageSummary | null = null;
  let backendDown = false;
  try {
    usage = await getUsage();
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
        <Link href="/settings" className="text-sm text-ink-muted hover:text-ink">
          ← Settings
        </Link>
        <p className="eyebrow mb-1.5 mt-3">Admin</p>
        <h1 className="font-display text-2xl text-ink">Usage</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Workspace activity at a glance. Admin-only.
        </p>
      </header>

      {backendDown || !usage ? (
        <BackendDownState resource="usage" />
      ) : (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Meetings" value={String(usage.meetingCount)} />
          <Stat label="Completed" value={String(usage.completedCount)} />
          <Stat label="Minutes" value={String(Math.round(usage.totalMinutes))} hint="captured" />
        </section>
      )}
    </div>
  );
}
