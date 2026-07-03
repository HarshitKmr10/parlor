import type { Metadata } from "next";
import Link from "next/link";
import { listAuditEvents } from "@/lib/api/audit";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import type { AuditEvent } from "@/lib/api/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { BackendDownState } from "@/components/ui/BackendDownState";
import { ListIcon } from "@/components/ui/icons";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = {
  title: "Audit log — Parlor",
};

const ACTION_COLOR: Record<string, string> = {
  "share.created": "bg-info-bg text-info",
  "share.revoked": "bg-warning-bg text-gold-700",
  "meeting.deleted": "bg-error-bg text-error",
};

export default async function AuditPage() {
  let events: AuditEvent[] = [];
  let backendDown = false;
  try {
    events = (await listAuditEvents()).items;
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
        <p className="eyebrow mb-1.5 mt-3">Security</p>
        <h1 className="font-display text-2xl text-ink">Audit log</h1>
        <p className="mt-1 text-sm text-ink-muted">
          An append-only record of sensitive actions in this workspace.
        </p>
      </header>

      {backendDown ? (
        <BackendDownState resource="the audit log" />
      ) : events.length === 0 ? (
        <EmptyState
          icon={<ListIcon className="h-6 w-6" />}
          title="No events yet"
          description="Sensitive actions like sharing a recap or deleting a meeting will be recorded here."
        />
      ) : (
        <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-surface-0 shadow-soft-sm">
          {events.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span
                  className={`rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold ${
                    ACTION_COLOR[e.action] ?? "bg-surface-2 text-ink-soft"
                  }`}
                >
                  {e.action}
                </span>
                <span className="text-xs text-ink-muted">
                  {e.resourceType}
                  {e.resourceId ? ` · ${e.resourceId.slice(0, 8)}` : ""}
                </span>
              </div>
              <span className="shrink-0 text-xs text-ink-faint">
                {formatDateTime(e.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
