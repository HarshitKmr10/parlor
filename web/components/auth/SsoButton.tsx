"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/api/browser";

type Status = { enabled: boolean; provider: string | null };

export function SsoButton() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getJson<Status>("/api/auth/sso/status", controller.signal)
      .then(setStatus)
      .catch(() => setStatus({ enabled: false, provider: null }));
    return () => controller.abort();
  }, []);

  if (!status?.enabled) return null;

  const label = status.provider
    ? `Sign in with ${status.provider.replace(/^\w/, (c) => c.toUpperCase())}`
    : "Sign in with SSO";

  return (
    <div className="mt-4">
      <div className="relative my-4 flex items-center">
        <span className="h-px flex-1 bg-border-subtle" />
        <span className="px-3 text-xs text-ink-faint">or</span>
        <span className="h-px flex-1 bg-border-subtle" />
      </div>
      <a
        href="/api/auth/sso/start"
        className="flex w-full items-center justify-center rounded-md border border-border-default bg-surface-0 px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-border-strong hover:bg-surface-1"
      >
        {label}
      </a>
    </div>
  );
}
