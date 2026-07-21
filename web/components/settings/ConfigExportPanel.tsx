"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

const INCLUDED = [
  "Meeting tags",
  "Saved views",
  "Prompt library",
  "Redaction rules",
  "Capture exclusions",
  "Auto-tag rules",
  "Sharing defaults",
  "Auto-join & capture preferences",
];

function triggerDownload(json: string) {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "parlor-config.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function ConfigExportPanel() {
  const [status, setStatus] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/config-export", { cache: "no-store" });
      if (!res.ok) {
        let message = `Export failed (${res.status}).`;
        try {
          const body = (await res.json()) as {
            error?: { message?: string };
          };
          if (body?.error?.message) message = body.error.message;
        } catch {
          // non-JSON error body; keep the generic message
        }
        setStatus(message);
        return;
      }
      const data = (await res.json()) as unknown;
      triggerDownload(JSON.stringify(data, null, 2));
      setStatus("Downloaded parlor-config.json");
    } catch {
      setStatus("Could not reach the server. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button onClick={download} disabled={downloading}>
          {downloading ? "Preparing…" : "Download configuration (JSON)"}
        </Button>
      </div>
      {status && <p className="text-sm text-sage-700">{status}</p>}
      <div className="rounded-md border border-border-subtle bg-surface-1 px-3.5 py-3">
        <p className="mb-1.5 text-sm font-medium text-ink">
          What&apos;s included
        </p>
        <ul className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm text-ink-muted sm:grid-cols-2">
          {INCLUDED.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink-faint">
          Configuration only — no meeting recordings, transcripts, or summaries.
          Requires the admin role.
        </p>
      </div>
    </div>
  );
}
