"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { getJson, postJson, del } from "@/lib/api/browser";
import type {
  EventSubscribeResponse,
  EventSubscription,
  EventSubscriptionsResponse,
} from "@/lib/api/google-workspace";
import { Card, StatusBadge } from "./Card";

type Props = {
  isConfigured: boolean;
  initialSubscriptions: EventSubscription[];
};

function stateTone(state: string): "ok" | "warn" | "muted" {
  const s = state.toLowerCase();
  if (s === "active") return "ok";
  if (s === "deleted" || s === "expired" || s === "failed") return "warn";
  return "muted";
}

export function EventSubscriptionsCard({
  isConfigured,
  initialSubscriptions,
}: Props) {
  const [subscriptions, setSubscriptions] = useState<EventSubscription[]>(
    initialSubscriptions,
  );
  const [busy, setBusy] = useState<"subscribe" | "teardown" | "refresh" | null>(
    null,
  );
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();

  const refresh = async () => {
    setBusy("refresh");
    setError(undefined);
    try {
      const data = await getJson<EventSubscriptionsResponse>(
        "/api/google-workspace/events/subscriptions",
      );
      setSubscriptions(data.subscriptions);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Couldn't load subscriptions.",
      );
    } finally {
      setBusy(null);
    }
  };

  const handleSubscribe = async () => {
    setBusy("subscribe");
    setError(undefined);
    setSuccess(undefined);
    try {
      const summary = await postJson<EventSubscribeResponse>(
        "/api/google-workspace/events/subscribe",
        {},
      );
      setSuccess(
        `Provisioned ${summary.created} of ${summary.total} subscriptions${
          summary.failed > 0 ? ` (${summary.failed} failed)` : ""
        }.`,
      );
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't subscribe.");
    } finally {
      setBusy(null);
    }
  };

  const handleTeardown = async () => {
    setBusy("teardown");
    setError(undefined);
    setSuccess(undefined);
    try {
      await del("/api/google-workspace/events/subscriptions");
      setSubscriptions([]);
      setSuccess("Subscriptions torn down.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't tear down.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card
      title="Meet event subscriptions"
      description="Pub/Sub subscriptions that catch ad-hoc and instant Meet calls — the ones that never touch a calendar."
    >
      {!isConfigured ? (
        <p className="rounded-md border border-dashed border-border-default bg-surface-1 px-3.5 py-3 text-sm text-ink-muted">
          Connect a service account first. Subscriptions fan out across the org
          and require an enabled config plus a Pub/Sub topic.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={handleSubscribe}
              disabled={busy !== null}
            >
              {busy === "subscribe" ? "Subscribing…" : "Subscribe to Meet events"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={refresh}
              disabled={busy !== null}
            >
              {busy === "refresh" ? "Refreshing…" : "Refresh"}
            </Button>
            {subscriptions.length > 0 && (
              <Button
                variant="danger"
                size="sm"
                onClick={handleTeardown}
                disabled={busy !== null}
              >
                {busy === "teardown" ? "Tearing down…" : "Tear down"}
              </Button>
            )}
          </div>

          {error && (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          )}
          {success && (
            <p role="status" className="text-sm text-sage-700">
              {success}
            </p>
          )}

          {subscriptions.length === 0 ? (
            <p className="rounded-md border border-dashed border-border-default bg-surface-1 px-3.5 py-3 text-sm text-ink-muted">
              No subscriptions yet. Subscribe to start catching instant meetings
              across the org.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border-subtle rounded-md border border-border-subtle">
              {subscriptions.map((sub) => (
                <li
                  key={sub.id}
                  className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                >
                  <p className="min-w-0 truncate font-mono text-xs text-ink">
                    {sub.targetUserEmail}
                  </p>
                  <StatusBadge tone={stateTone(sub.state)}>
                    {sub.state}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
