"use client";

import { useState } from "react";
import Link from "next/link";
import { putJson } from "@/lib/api/browser";
import type { Tag } from "@/lib/api/types";

type Props = {
  meetingId: string;
  initialTags: Tag[];
  allTags: Tag[];
};

export function MeetingTagsPicker({ meetingId, initialTags, allTags }: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialTags.map((t) => t.id)),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const persist = async (next: Set<string>) => {
    setIsSaving(true);
    setError(undefined);
    try {
      const saved = await putJson<Tag[]>(`/api/tags/meetings/${meetingId}`, {
        tagIds: Array.from(next),
      });
      setSelected(new Set(saved.map((t) => t.id)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't update tags.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggle = (id: string) => {
    if (isSaving) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    void persist(next);
  };

  if (allTags.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        No tags defined yet.{" "}
        <Link href="/settings/tags" className="underline hover:text-ink">
          Create tags in settings
        </Link>{" "}
        to organize your meetings.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {allTags.map((tag) => {
          const isOn = selected.has(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggle(tag.id)}
              disabled={isSaving}
              aria-pressed={isOn}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-60 ${
                isOn
                  ? "border-border-strong bg-surface-2 text-ink"
                  : "border-border-subtle bg-surface-0 text-ink-muted hover:border-border-default hover:text-ink"
              }`}
            >
              <span
                aria-hidden="true"
                style={{ backgroundColor: tag.color }}
                className="h-2.5 w-2.5 rounded-full border border-border-subtle"
              />
              {tag.name}
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
