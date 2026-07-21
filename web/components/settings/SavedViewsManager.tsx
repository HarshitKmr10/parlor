"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { postJson, del } from "@/lib/api/browser";
import type { SavedView } from "@/lib/api/types";

type Props = {
  initialViews: SavedView[];
};

export function SavedViewsManager({ initialViews }: Props) {
  const [views, setViews] = useState<SavedView[]>(initialViews);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (name.trim().length === 0 || isCreating) return;
    setIsCreating(true);
    setError(undefined);
    try {
      const created = await postJson<SavedView>("/api/saved-views", {
        name: name.trim(),
        query: query.trim(),
      });
      setViews((prev) => [created, ...prev]);
      setName("");
      setQuery("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't save the view.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    setError(undefined);
    try {
      await del(`/api/saved-views/${id}`);
      setViews((prev) => prev.filter((v) => v.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't delete the view.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleCreate} className="flex flex-col gap-3">
        <TextField
          label="View name"
          placeholder="e.g. Open action items"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          label="Search query"
          placeholder="e.g. status:open owner:me"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div>
          <Button
            type="submit"
            disabled={isCreating || name.trim().length === 0}
          >
            {isCreating ? "Saving…" : "Save view"}
          </Button>
        </div>
      </form>

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}

      {views.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-default bg-surface-1 px-3.5 py-3 text-sm text-ink-muted">
          No saved views yet. Save a search you run often — open action items, a
          recurring topic filter — and re-run it with one click instead of
          retyping the query each time.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-subtle rounded-md border border-border-subtle">
          {views.map((view) => (
            <li key={view.id} className="flex items-start justify-between gap-3 px-3.5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{view.name}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{view.query || "No query"}</p>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleDelete(view.id)}
                disabled={busyId === view.id}
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
