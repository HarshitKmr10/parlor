"use client";

import { useState } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { CalendarIcon } from "@/components/ui/icons";
import { isApiErrorBody } from "@/lib/api/error";
import type { CalendarAccount, CalendarProvider } from "@/lib/api/types";

type Props = {
  accounts: CalendarAccount[];
  /** Connect URLs by provider (point at the backend OAuth endpoints). */
  connectUrls: Record<CalendarProvider, string>;
};

const PROVIDER_LABEL: Record<CalendarProvider, string> = {
  google: "Google Calendar",
  microsoft: "Microsoft Outlook",
};

export function CalendarConnections({ accounts, connectUrls }: Props) {
  const [items, setItems] = useState<CalendarAccount[]>(accounts);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();

  const toggleAutoJoin = async (account: CalendarAccount) => {
    const nextValue = !account.autoJoin;
    setPendingId(account.id);
    setError(undefined);
    // Optimistic update.
    setItems((prev) =>
      prev.map((item) =>
        item.id === account.id ? { ...item, autoJoin: nextValue } : item,
      ),
    );
    try {
      const response = await fetch(`/api/calendar/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoJoin: nextValue }),
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        throw new Error(
          isApiErrorBody(body)
            ? body.error.message
            : "Couldn't update auto-join.",
        );
      }
    } catch (err: unknown) {
      // Roll back on failure.
      setItems((prev) =>
        prev.map((item) =>
          item.id === account.id ? { ...item, autoJoin: !nextValue } : item,
        ),
      );
      setError(err instanceof Error ? err.message : "Couldn't update auto-join.");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((account) => (
            <li
              key={account.id}
              className="flex items-center justify-between gap-4 rounded-md border border-border-subtle bg-surface-1 px-3.5 py-3"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <CalendarIcon className="h-4 w-4 shrink-0 text-sage-600" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {account.email}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {PROVIDER_LABEL[account.provider]}
                  </p>
                </div>
              </div>
              <label className="flex shrink-0 items-center gap-2 text-xs text-ink-muted">
                Auto-join
                <Toggle
                  checked={account.autoJoin}
                  onChange={() => toggleAutoJoin(account)}
                  label={`Auto-join meetings from ${account.email}`}
                  disabled={pendingId === account.id}
                />
              </label>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            window.location.href = connectUrls.google;
          }}
        >
          Connect Google
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            window.location.href = connectUrls.microsoft;
          }}
        >
          Connect Microsoft
        </Button>
      </div>
    </div>
  );
}
