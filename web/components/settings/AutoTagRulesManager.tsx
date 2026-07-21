"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Toggle } from "@/components/ui/Toggle";
import { postJson, patchJson, del } from "@/lib/api/browser";
import type { AutoTagMatchType, AutoTagRule, Tag } from "@/lib/api/types";

const MATCH_TYPE_LABEL: Record<AutoTagMatchType, string> = {
  title_contains: "Title contains",
  title_regex: "Title regex",
};

type Props = {
  initialRules: AutoTagRule[];
  tags: Tag[];
};

export function AutoTagRulesManager({ initialRules, tags }: Props) {
  const [rules, setRules] = useState<AutoTagRule[]>(initialRules);
  const [pattern, setPattern] = useState("");
  const [matchType, setMatchType] = useState<AutoTagMatchType>("title_contains");
  const [tagId, setTagId] = useState<string>(tags[0]?.id ?? "");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [busyId, setBusyId] = useState<string | null>(null);

  const tagById = new Map(tags.map((t) => [t.id, t]));

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pattern.trim().length === 0 || tagId.length === 0 || isCreating) return;
    setIsCreating(true);
    setError(undefined);
    try {
      const created = await postJson<AutoTagRule>("/api/auto-tag-rules", {
        pattern: pattern.trim(),
        matchType,
        tagId,
      });
      setRules((prev) => [...prev, created]);
      setPattern("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't create the rule.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggle = async (rule: AutoTagRule) => {
    setBusyId(rule.id);
    setError(undefined);
    try {
      const updated = await patchJson<AutoTagRule>(`/api/auto-tag-rules/${rule.id}`, {
        enabled: !rule.enabled,
      });
      setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
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
      await del(`/api/auto-tag-rules/${id}`);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't delete the rule.");
    } finally {
      setBusyId(null);
    }
  };

  if (tags.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border-default bg-surface-1 px-3.5 py-3 text-sm text-ink-muted">
        Create at least one meeting tag first — auto-tag rules apply an existing
        tag when a meeting title matches. Head to{" "}
        <a href="/settings/tags" className="underline hover:text-ink">
          Meeting tags
        </a>{" "}
        to add one.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleCreate} className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField
            label={matchType === "title_regex" ? "Pattern (regex)" : "Title contains"}
            placeholder={matchType === "title_regex" ? "^\\[SALES\\]" : "standup"}
            value={pattern}
            onChange={(event) => setPattern(event.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rule-match-type" className="text-sm font-medium text-ink">
              Match type
            </label>
            <select
              id="rule-match-type"
              value={matchType}
              onChange={(event) => setMatchType(event.target.value as AutoTagMatchType)}
              className="rounded-md border border-border-default bg-surface-0 px-3 py-2 text-sm text-ink focus:border-border-strong focus:outline-none"
            >
              <option value="title_contains">Title contains (literal text)</option>
              <option value="title_regex">Title regex (advanced)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rule-tag" className="text-sm font-medium text-ink">
              Apply tag
            </label>
            <select
              id="rule-tag"
              value={tagId}
              onChange={(event) => setTagId(event.target.value)}
              className="rounded-md border border-border-default bg-surface-0 px-3 py-2 text-sm text-ink focus:border-border-strong focus:outline-none"
            >
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <Button
            type="submit"
            disabled={isCreating || pattern.trim().length === 0 || tagId.length === 0}
          >
            {isCreating ? "Adding…" : "Add rule"}
          </Button>
        </div>
      </form>

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}

      {rules.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-default bg-surface-1 px-3.5 py-3 text-sm text-ink-muted">
          No auto-tag rules yet. Add one to automatically tag meetings by their
          title — for example, tag every &ldquo;standup&rdquo; as your team tag.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-subtle rounded-md border border-border-subtle">
          {rules.map((rule) => {
            const tag = tagById.get(rule.tagId);
            return (
              <li key={rule.id} className="flex items-center justify-between gap-3 px-3.5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {tag?.name ?? "Unknown tag"}
                    <span className="ml-2 rounded-sm bg-surface-2 px-1.5 py-0.5 text-xs font-normal text-ink-muted">
                      {MATCH_TYPE_LABEL[rule.matchType]}
                    </span>
                  </p>
                  <p className="truncate font-mono text-xs text-ink-muted">{rule.pattern}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Toggle
                    checked={rule.enabled}
                    onChange={() => handleToggle(rule)}
                    disabled={busyId === rule.id}
                    label={`Toggle rule ${rule.pattern}`}
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
            );
          })}
        </ul>
      )}
    </div>
  );
}
