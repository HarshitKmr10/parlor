"use client";

import { useState } from "react";
import { putJson } from "@/lib/api/browser";
import type { Integration, IntegrationKind } from "@/lib/api/types";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";

type Field = { key: string; label: string; placeholder: string };

// Config field schema per push destination.
const FIELDS: Partial<Record<IntegrationKind, Field[]>> = {
  notion: [
    { key: "token", label: "Internal integration token", placeholder: "secret_…" },
    { key: "databaseId", label: "Database ID", placeholder: "32-char id" },
  ],
  hubspot: [{ key: "accessToken", label: "Private app token", placeholder: "pat-…" }],
  salesforce: [
    { key: "instanceUrl", label: "Instance URL", placeholder: "https://x.my.salesforce.com" },
    { key: "accessToken", label: "Access token", placeholder: "00D…" },
  ],
  slack: [{ key: "webhookUrl", label: "Incoming webhook URL", placeholder: "https://hooks.slack.com/…" }],
};

const LABELS: Record<string, string> = {
  notion: "Notion",
  hubspot: "HubSpot",
  salesforce: "Salesforce",
  slack: "Slack",
};

function Row({ integration }: { integration: Integration }) {
  const fields = FIELDS[integration.kind] ?? [];
  const [config, setConfig] = useState<Record<string, string>>(integration.config ?? {});
  const [enabled, setEnabled] = useState(integration.enabled);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      await putJson(`/api/integrations`, { kind: integration.kind, enabled, config });
      setStatus("Saved.");
    } catch (e: unknown) {
      setStatus(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-0 p-4 shadow-soft-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display text-base text-ink">{LABELS[integration.kind] ?? integration.kind}</span>
        <Toggle checked={enabled} onChange={setEnabled} label={`Enable ${integration.kind}`} />
      </div>
      <div className="flex flex-col gap-2.5">
        {fields.map((f) => (
          <label key={f.key} className="flex flex-col gap-1 text-sm">
            <span className="text-ink-muted">{f.label}</span>
            <input
              value={config[f.key] ?? ""}
              onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              className="rounded-md border border-border-default bg-surface-0 px-3 py-2 font-mono text-xs text-ink"
            />
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        {status && <span className="text-xs text-sage-700">{status}</span>}
      </div>
    </div>
  );
}

export function RecapDestinations({ integrations }: { integrations: Integration[] }) {
  // Only push destinations that are actually implemented + have a field schema.
  const pushable = integrations.filter(
    (i) => i.implemented && FIELDS[i.kind] && i.kind !== "email",
  );
  if (pushable.length === 0) return null;
  return (
    <section aria-label="Recap destinations" className="mt-8">
      <h2 className="mb-1 font-display text-lg text-ink">Push recaps to your tools</h2>
      <p className="mb-4 text-sm text-ink-muted">
        When a meeting is summarized, push the recap to these destinations.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {pushable.map((i) => (
          <Row key={i.kind} integration={i} />
        ))}
      </div>
    </section>
  );
}
