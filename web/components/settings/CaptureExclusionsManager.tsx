"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Toggle } from "@/components/ui/Toggle";
import { postJson, patchJson, del } from "@/lib/api/browser";
import type {
  CaptureExclusion,
  CaptureExclusionMatchType,
} from "@/lib/api/types";

const MATCH_TYPE_LABEL: Record<CaptureExclusionMatchType, string> = {
  title_contains: "Title contains",
  url_contains: "URL contains",
  title_regex: "Title regex",
};

type Props = {
  initialExclusions: CaptureExclusion[];
};

export function CaptureExclusionsManager({ initialExclusions }: Props) {
  const [exclusions, setExclusions] =
    useState<CaptureExclusion[]>(initialExclusions);
  const [pattern, setPattern] = useState("");
  const [matchType, setMatchType] =
    useState<CaptureExclusionMatchType>("title_contains");
  const [note, setNote] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pattern.trim().length === 0 || isCreating) return;
    setIsCreating(true);
    setError(undefined);
    try {
      const created = await postJson<CaptureExclusion>("/api/capture-exclusions", {
        pattern: pattern.trim(),
        matchType,
        note: note.trim() || undefined,
      });
      setExclusions((prev) => [...prev, created]);
      setPattern("");
      setNote("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't create the rule.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggle = async (rule: CaptureExclusion) => {
    setBusyId(rule.id);
    setError(undefined);
    try {
      const updated = await patchJson<CaptureExclusion>(
        `/api/capture-exclusions/${rule.id}`,
        { enabled: !rule.enabled },
      );
      setExclusions((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't update the rule.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    setError(undefined);
    try {
      await del(`/api/capture-exclusions/${id}`);
      setExclusions((prev) => prev.filter((r) => r.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't delete the rule.");
    } finally {
      setBusyId(null);
    }
  };

  const patternLabel =
    matchType === "title_regex"
      ? "Pattern (title regex)"
      : matchType === "url_contains"
        ? "URL substring"
        : "Title substring";
  const patternPlaceholder =
    matchType === "title_regex"
      ? "^\\[HR\\]"
      : matchType === "url_contains"
        ? "private-room"
        : "1:1";

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleCreate} className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="exclusion-match-type" className="text-sm font-medium text-ink">
              Match on
            </label>
            <select
              id="exclusion-match-type"
              value={matchType}
              onChange={(event) => {
                setMatchType(event.target.value as CaptureExclusionMatchType);
                setPattern("");
              }}
              className="rounded-md border border-border-default bg-surface-0 px-3 py-2 text-sm text-ink focus:border-border-strong focus:outline-none"
            >
              <option value="title_contains">Title contains (literal text)</option>
              <option value="url_contains">URL contains (literal text)</option>
              <option value="title_regex">Title regex (advanced)</option>
            </select>
          </div>
          <TextField
            label={patternLabel}
            placeholder={patternPlaceholder}
            value={pattern}
            onChange={(event) => setPattern(event.target.value)}
          />
        </div>

        <TextField
          label="Note (optional)"
          placeholder="e.g. Never record 1:1s with reports"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />

        <div>
          <Button type="submit" disabled={isCreating || pattern.trim().length === 0}>
            {isCreating ? "Adding…" : "Add exclusion"}
          </Button>
        </div>
      </form>

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}

      {exclusions.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-default bg-surface-1 px-3.5 py-3 text-sm text-ink-muted">
          No exclusions yet. Add one to keep sensitive meetings — 1:1s, HR
          reviews, private rooms — from ever being auto-joined or recorded.
          Matching happens locally on the meeting title or URL.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-subtle rounded-md border border-border-subtle">
          {exclusions.map((rule) => (
            <li key={rule.id} className="flex items-center justify-between gap-3 px-3.5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  <span className="font-mono">{rule.pattern}</span>
                  <span className="ml-2 rounded-sm bg-surface-2 px-1.5 py-0.5 text-xs font-normal text-ink-muted">
                    {MATCH_TYPE_LABEL[rule.matchType]}
                  </span>
                </p>
                {rule.note && (
                  <p className="truncate text-xs text-ink-muted">{rule.note}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Toggle
                  checked={rule.enabled}
                  onChange={() => handleToggle(rule)}
                  disabled={busyId === rule.id}
                  label={`Toggle exclusion ${rule.pattern}`}
                />
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDelete(rule.id)}
                  disabled={busyId === rule.id}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
