"use client";

import { useState } from "react";
import { postJson, patchJson, del } from "@/lib/api/browser";
import type { WebhookEndpoint } from "@/lib/api/types";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";

type Props = {
  initialEndpoints: WebhookEndpoint[];
  eventTypes: string[];
};

export function WebhooksManager({ initialEndpoints, eventTypes }: Props) {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>(initialEndpoints);
  const [url, setUrl] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, string>>({});

  const toggleEvent = (e: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(e)) next.delete(e);
      else next.add(e);
      return next;
    });
  };

  const create = async () => {
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await postJson<WebhookEndpoint>("/api/webhooks", {
        url: url.trim(),
        eventTypes: Array.from(selected),
      });
      setEndpoints((prev) => [...prev, created]);
      setUrl("");
      setSelected(new Set());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create webhook.");
    } finally {
      setBusy(false);
    }
  };

  const toggleEnabled = async (ep: WebhookEndpoint) => {
    const next = !ep.enabled;
    setEndpoints((prev) => prev.map((x) => (x.id === ep.id ? { ...x, enabled: next } : x)));
    try {
      await patchJson<WebhookEndpoint>(`/api/webhooks/${ep.id}`, { enabled: next });
    } catch {
      setEndpoints((prev) => prev.map((x) => (x.id === ep.id ? { ...x, enabled: !next } : x)));
    }
  };

  const test = async (ep: WebhookEndpoint) => {
    setTestResult((prev) => ({ ...prev, [ep.id]: "sending…" }));
    try {
      await postJson(`/api/webhooks/${ep.id}/test`, {});
      setTestResult((prev) => ({ ...prev, [ep.id]: "test event queued ✓" }));
    } catch (e: unknown) {
      setTestResult((prev) => ({
        ...prev,
        [ep.id]: e instanceof Error ? e.message : "test failed",
      }));
    }
  };

  const remove = async (id: string) => {
    const snapshot = endpoints;
    setEndpoints((prev) => prev.filter((x) => x.id !== id));
    try {
      await del(`/api/webhooks/${id}`);
    } catch {
      setEndpoints(snapshot);
      setError("Failed to delete webhook.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="text-sm text-error">{error}</p>}

      {endpoints.length > 0 && (
        <ul className="flex flex-col gap-3">
          {endpoints.map((ep) => (
            <li
              key={ep.id}
              className="rounded-lg border border-border-subtle bg-surface-0 p-4 shadow-soft-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm text-ink">{ep.url}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {ep.eventTypes.length === 0
                      ? "all events"
                      : ep.eventTypes.join(", ")}
                    {ep.consecutiveFailures > 0 && (
                      <span className="text-error">
                        {" "}
                        · {ep.consecutiveFailures} recent failure
                        {ep.consecutiveFailures === 1 ? "" : "s"}
                      </span>
                    )}
                  </p>
                </div>
                <Toggle
                  checked={ep.enabled}
                  onChange={() => toggleEnabled(ep)}
                  label="Enabled"
                />
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-md bg-surface-1 px-3 py-2">
                <span className="text-xs text-ink-muted">Signing secret</span>
                <code className="flex-1 truncate font-mono text-xs text-ink-soft">
                  {ep.secret}
                </code>
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs">
                <button type="button" onClick={() => test(ep)} className="text-ink-muted hover:text-sage-700">
                  Send test
                </button>
                <button type="button" onClick={() => remove(ep.id)} className="text-ink-muted hover:text-error">
                  Delete
                </button>
                {testResult[ep.id] && (
                  <span className="text-ink-faint">{testResult[ep.id]}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-lg border border-border-subtle bg-surface-1/60 p-4">
        <p className="eyebrow mb-3">Add an endpoint</p>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/webhooks/verdant"
          className="w-full rounded-md border border-border-default bg-surface-0 px-3 py-2 font-mono text-sm text-ink"
        />
        {eventTypes.length > 0 && (
          <div className="mt-3">
            <p className="mb-2 text-xs text-ink-muted">
              Events (none selected = all)
            </p>
            <div className="flex flex-wrap gap-2">
              {eventTypes.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => toggleEvent(e)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    selected.has(e)
                      ? "bg-sage-600 text-surface-cream"
                      : "border border-border-default bg-surface-0 text-ink-soft hover:border-border-strong"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <Button onClick={create} disabled={busy || !url.trim()} size="sm">
            {busy ? "Adding…" : "Add webhook"}
          </Button>
        </div>
      </div>
    </div>
  );
}
