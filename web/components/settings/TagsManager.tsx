"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { postJson, del } from "@/lib/api/browser";
import type { Tag } from "@/lib/api/types";

const PALETTE = [
  "#6b7280",
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
] as const;

type Props = {
  initialTags: Tag[];
};

export function TagsManager({ initialTags }: Props) {
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(PALETTE[0]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (name.trim().length === 0 || isCreating) return;
    setIsCreating(true);
    setError(undefined);
    try {
      const created = await postJson<Tag>("/api/tags", {
        name: name.trim(),
        color,
      });
      setTags((prev) => [created, ...prev]);
      setName("");
      setColor(PALETTE[0]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't create the tag.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    setError(undefined);
    try {
      await del(`/api/tags/${id}`);
      setTags((prev) => prev.filter((t) => t.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't delete the tag.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleCreate} className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          <TextField
            label="Tag name"
            placeholder="e.g. Sales call, Internal, Q3"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="tag-color" className="text-sm font-medium text-ink">
              Color
            </label>
            <div className="flex items-center gap-2">
              <input
                id="tag-color"
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                aria-label="Tag color"
                className="h-9 w-12 cursor-pointer rounded-md border border-border-default bg-surface-0 p-1"
              />
              <div className="flex items-center gap-1.5">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Use color ${c}`}
                    aria-pressed={color === c}
                    style={{ backgroundColor: c }}
                    className={`h-6 w-6 rounded-full border transition-transform hover:scale-110 ${
                      color === c ? "border-border-strong ring-2 ring-border-strong" : "border-border-subtle"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div>
          <Button type="submit" disabled={isCreating || name.trim().length === 0}>
            {isCreating ? "Adding…" : "Add tag"}
          </Button>
        </div>
      </form>

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}

      {tags.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-default bg-surface-1 px-3.5 py-3 text-sm text-ink-muted">
          No tags yet. Add one to organize meetings — by team, customer, or topic
          — then assign it from any meeting&apos;s detail page.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-subtle rounded-md border border-border-subtle">
          {tags.map((tag) => (
            <li key={tag.id} className="flex items-center justify-between gap-3 px-3.5 py-3">
              <span className="inline-flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  style={{ backgroundColor: tag.color }}
                  className="h-3 w-3 shrink-0 rounded-full border border-border-subtle"
                />
                <span className="truncate text-sm font-medium text-ink">{tag.name}</span>
              </span>
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleDelete(tag.id)}
                disabled={busyId === tag.id}
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
