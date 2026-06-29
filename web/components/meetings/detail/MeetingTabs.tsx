"use client";

import { useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";

export type TabDef = {
  key: string;
  label: string;
  panel: ReactNode;
};

type Props = {
  tabs: TabDef[];
  /** Initial tab — e.g. open on Ask when arriving from a CTA. */
  defaultTab?: string;
};

/** Subscribe to the URL hash so a `#ask` deep-link selects the right tab. */
function subscribeToHash(callback: () => void): () => void {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

function getHashTab(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace("#", "");
  return hash || null;
}

export function MeetingTabs({ tabs, defaultTab }: Props) {
  const fallback = defaultTab ?? tabs[0]?.key;
  // User selection overrides the URL hash once they click a tab.
  const [override, setOverride] = useState<string | null>(null);
  const hashTab = useSyncExternalStore(subscribeToHash, getHashTab, () => null);
  const hashValid =
    hashTab && tabs.some((t) => t.key === hashTab) ? hashTab : null;
  const active = override ?? hashValid ?? fallback;

  // Persist the active tab in the URL hash so a reload (or a shared link)
  // restores it instead of snapping back to the default.
  const setActive = (key: string) => {
    setOverride(key);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${key}`);
    }
  };

  const panel = tabs.find((t) => t.key === active)?.panel ?? null;

  return (
    <div>
      <div
        role="tablist"
        aria-label="Meeting content"
        className="flex gap-1 overflow-x-auto border-b border-border-subtle"
      >
        {tabs.map((tab) => {
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
              className={`relative -mb-px whitespace-nowrap px-4 py-2.5 font-sans text-sm font-medium transition-colors ${
                isActive ? "text-ink" : "text-ink-muted hover:text-ink-soft"
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
