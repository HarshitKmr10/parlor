"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { postJson, del } from "@/lib/api/browser";
import type { SavedPrompt } from "@/lib/api/types";

type Props = {
  initialPrompts: SavedPrompt[];
};

export function PromptLibraryManager({ initialPrompts }: Props) {
  const [prompts, setPrompts] = useState<SavedPrompt[]>(initialPrompts);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (title.trim().length === 0 || body.trim().length === 0 || isCreating) return;
    setIsCreating(true);
    setError(undefined);
    try {
      const created = await postJson<SavedPrompt>("/api/prompts", {
        title: title.trim(),
        body: body.trim(),
      });
      setPrompts((prev) => [created, ...prev]);
      setTitle("");
      setBody("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't save the prompt.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    setError(undefined);
    try {
      await del(`/api/prompts/${id}`);
      setPrompts((prev) => prev.filter((p) => p.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't delete the prompt.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleCreate} className="flex flex-col gap-3">
        <TextField
          label="Prompt title"
          placeholder="e.g. Weekly standup recap"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="prompt-body" className="text-sm font-medium text-ink">
            Prompt
          </label>
          <textarea
            id="prompt-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            placeholder="Summarize the key decisions and open questions from this meeting."
            className="w-full rounded-md border border-border-default bg-surface-0 px-3 py-2 text-sm text-ink focus:border-border-strong focus:outline-none"
          />
        </div>
        <div>
          <Button
            type="submit"
            disabled={isCreating || title.trim().length === 0 || body.trim().length === 0}
          >
            {isCreating ? "Saving…" : "Save prompt"}
          </Button>
        </div>
      </form>

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}

      {prompts.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-default bg-surface-1 px-3.5 py-3 text-sm text-ink-muted">
          No saved prompts yet. Save a prompt you reach for often — a recurring
          recap, a follow-up extractor — and reuse it in Ask instead of retyping
          it each time.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-subtle rounded-md border border-border-subtle">
          {prompts.map((prompt) => (
            <li key={prompt.id} className="flex items-start justify-between gap-3 px-3.5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{prompt.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{prompt.body}</p>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleDelete(prompt.id)}
                disabled={busyId === prompt.id}
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
