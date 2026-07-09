"use client";

import { useState } from "react";

type Lang = "curl" | "python" | "typescript" | "go";

const LABELS: Record<Lang, string> = {
  curl: "curl",
  python: "Python",
  typescript: "TypeScript",
  go: "Go",
};

const ORDER: Lang[] = ["curl", "python", "typescript", "go"];

export function CodeTabs(props: Partial<Record<Lang, string>>) {
  const available = ORDER.filter((lang) => props[lang]);
  const [active, setActive] = useState<Lang>(available[0]);

  return (
    <div className="overflow-hidden rounded-lg border border-border-subtle">
      <div className="flex gap-1 border-b border-border-subtle bg-surface-1 px-2 pt-2">
        {available.map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => setActive(lang)}
            aria-pressed={active === lang}
            className={`rounded-t-md px-3 py-1.5 font-mono text-xs transition-colors ${
              active === lang
                ? "bg-surface-0 text-ink"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {LABELS[lang]}
          </button>
        ))}
      </div>
      <pre className="overflow-x-auto bg-surface-1 p-4 font-mono text-xs leading-relaxed text-ink-soft">
        <code>{props[active]}</code>
      </pre>
    </div>
  );
}
