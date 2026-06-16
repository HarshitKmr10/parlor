"use client";

import { useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";

type TabKey = "summary" | "transcript" | "ask";

type Props = {
  summary: ReactNode;
  transcript: ReactNode;
  ask: ReactNode;
  /** Initial tab — e.g. open on Ask when arriving from a CTA. */
  defaultTab?: TabKey;
};

const TABS: { key: TabKey; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "transcript", label: "Transcript" },
  { key: "ask", label: "Ask" },
];

function isTabKey(value: string): value is TabKey {
  return value === "summary" || value === "transcript" || value === "ask";
}

/** Subscribe to the URL hash so a `#ask` deep-link selects the right tab. */
function subscribeToHash(callback: () => void): () => void {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

function getHashTab(): TabKey | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace("#", "");
  return isTabKey(hash) ? hash : null;
}

export function MeetingTabs({
  summary,
  transcript,
  ask,
  defaultTab = "summary",
}: Props) {
  // User selection overrides the URL hash once they click a tab.
  const [override, setOverride] = useState<TabKey | null>(null);
  const hashTab = useSyncExternalStore(
    subscribeToHash,
    getHashTab,
    () => null,
  );
  const active = override ?? hashTab ?? defaultTab;
  const setActive = setOverride;

  const panel =
    active === "summary" ? summary : active === "transcript" ? transcript : ask;

  return (
    <div>
      <div
        role="tablist"
        aria-label="Meeting content"
        className="flex gap-1 border-b border-border-subtle"
      >
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`tab-${tab.key}`}
              aria-selected={isActive}
              aria-controls={`panel-${tab.key}`}
              onClick={() => setActive(tab.key)}
              className={`relative -mb-px px-4 py-2.5 font-sans text-sm font-medium transition-colors ${
                isActive
                  ? "text-ink"
                  : "text-ink-muted hover:text-ink-soft"
              }`}
            >
              {tab.label}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-gold-400"
                />
              )}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`panel-${active}`}
        aria-labelledby={`tab-${active}`}
        className="pt-6"
      >
        {panel}
      </div>
    </div>
  );
}
