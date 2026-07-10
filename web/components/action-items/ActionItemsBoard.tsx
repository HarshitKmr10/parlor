"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { patchJson } from "@/lib/api/browser";
import type { ActionItemRecord } from "@/lib/api/types";

type Props = {
  initialItems: ActionItemRecord[];
};

type Filter = "open" | "done" | "all";

export function ActionItemsBoard({ initialItems }: Props) {
  const [items, setItems] = useState<ActionItemRecord[]>(initialItems);
  const [filter, setFilter] = useState<Filter>("open");

  const visible = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((i) => (filter === "done" ? i.done : !i.done));
  }, [items, filter]);

  const openCount = items.filter((i) => !i.done).length;

  const toggle = async (item: ActionItemRecord) => {
    const next = !item.done;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: next } : i)));
    try {
      await patchJson<ActionItemRecord>(`/api/action-items/${item.id}`, { done: next });
    } catch {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: !next } : i)));
    }
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "open", label: `Open (${openCount})` },
    { key: "done", label: "Done" },
    { key: "all", label: "All" },
  ];

  return (
    <div>
      <div className="mb-5 inline-flex rounded-lg border border-border-subtle bg-surface-1 p-0.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f.key
                ? "bg-surface-0 text-ink shadow-soft-sm"
                : "text-ink-muted hover:text-ink-soft"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-default bg-surface-1/60 px-5 py-12 text-center text-sm text-ink-muted">
          {filter === "open"
            ? "No open action items. Nice and clear."
            : "Nothing here yet."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-3 rounded-lg border border-border-subtle bg-surface-0 p-3.5 shadow-soft-sm"
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={item.done}
                aria-label={item.done ? "Mark not done" : "Mark done"}
                onClick={() => toggle(item)}
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors ${
                  item.done
                    ? "border-sage-600 bg-sage-600 text-surface-cream"
                    : "border-border-strong bg-surface-0 hover:border-sage-500"
                }`}
              >
                {item.done && (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`text-base font-medium ${item.done ? "text-ink-faint line-through" : "text-ink"}`}>
                  {item.text}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-muted">
                  {item.assignee && (
                    <span className="rounded-full bg-sage-50 px-2 py-0.5 text-sage-700">
                      {item.assignee}
                    </span>
                  )}
                  {item.dueDate && <span>due {item.dueDate}</span>}
                  {item.source === "ai" && <span className="text-gold-700">AI-detected</span>}
                  <Link
                    href={`/meetings/${item.meetingId}`}
                    className="text-ink-muted underline-offset-2 hover:text-sage-700 hover:underline"
                  >
                    view meeting
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
