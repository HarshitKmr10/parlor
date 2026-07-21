"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Toggle } from "@/components/ui/Toggle";
import { postJson, patchJson, del } from "@/lib/api/browser";
import type {
  RedactionPreviewResponse,
  RedactionRule,
  RedactionRuleKind,
} from "@/lib/api/types";

const BUILTIN_DETECTORS = ["email", "phone", "credit_card", "ssn", "ipv4"] as const;

const KIND_LABEL: Record<RedactionRuleKind, string> = {
  builtin: "Built-in",
  keyword: "Keyword",
  regex: "Regex",
};

type Props = {
  initialRules: RedactionRule[];
};

export function RedactionRulesManager({ initialRules }: Props) {
  const [rules, setRules] = useState<RedactionRule[]>(initialRules);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<RedactionRuleKind>("keyword");
  const [pattern, setPattern] = useState("");
  const [replacement, setReplacement] = useState("[REDACTED]");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [busyId, setBusyId] = useState<string | null>(null);

  const [sample, setSample] = useState(
    "Email jane.doe@example.com, call +1 415 555 0132, card 4111 1111 1111 1111.",
  );
  const [preview, setPreview] = useState<RedactionPreviewResponse | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const effectivePattern = kind === "builtin" ? pattern || BUILTIN_DETECTORS[0] : pattern;

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (name.trim().length === 0 || effectivePattern.trim().length === 0 || isCreating) return;
    setIsCreating(true);
    setError(undefined);
    try {
      const created = await postJson<RedactionRule>("/api/redaction/rules", {
        name: name.trim(),
        kind,
        pattern: effectivePattern.trim(),
        replacement: replacement.trim() || "[REDACTED]",
      });
      setRules((prev) => [...prev, created]);
      setName("");
      setPattern("");
      setReplacement("[REDACTED]");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't create the rule.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggle = async (rule: RedactionRule) => {
    setBusyId(rule.id);
    setError(undefined);
    try {
      const updated = await patchJson<RedactionRule>(`/api/redaction/rules/${rule.id}`, {
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
      await del(`/api/redaction/rules/${id}`);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't delete the rule.");
    } finally {
      setBusyId(null);
    }
  };

  const handlePreview = async () => {
    setIsPreviewing(true);
    setError(undefined);
    try {
      setPreview(await postJson<RedactionPreviewResponse>("/api/redaction/preview", { text: sample }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't run the preview.");
    } finally {
      setIsPreviewing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleCreate} className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField
            label="Rule name"
            placeholder="e.g. Internal project codenames"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rule-kind" className="text-sm font-medium text-ink">
              Kind
            </label>
            <select
              id="rule-kind"
              value={kind}
              onChange={(event) => {
                setKind(event.target.value as RedactionRuleKind);
                setPattern("");
              }}
              className="rounded-md border border-border-default bg-surface-0 px-3 py-2 text-sm text-ink focus:border-border-strong focus:outline-none"
            >
              <option value="keyword">Keyword (literal text)</option>
              <option value="regex">Regex (advanced)</option>
              <option value="builtin">Built-in detector</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {kind === "builtin" ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="rule-detector" className="text-sm font-medium text-ink">
                Detector
              </label>
              <select
                id="rule-detector"
                value={pattern || BUILTIN_DETECTORS[0]}
                onChange={(event) => setPattern(event.target.value)}
                className="rounded-md border border-border-default bg-surface-0 px-3 py-2 text-sm text-ink focus:border-border-strong focus:outline-none"
              >
                {BUILTIN_DETECTORS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <TextField
              label={kind === "regex" ? "Pattern (regex)" : "Text to redact"}
              placeholder={kind === "regex" ? "ACME-\\d+" : "Project Aurora"}
              value={pattern}
              onChange={(event) => setPattern(event.target.value)}
            />
          )}
          <TextField
            label="Replacement"
            placeholder="[REDACTED]"
            value={replacement}
            onChange={(event) => setReplacement(event.target.value)}
          />
        </div>

        <div>
          <Button
            type="submit"
            disabled={isCreating || name.trim().length === 0 || effectivePattern.trim().length === 0}
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
          No custom rules yet. Add one to scrub project names, internal URLs, or
          any pattern the built-in detectors miss — everything runs locally
          before a transcript reaches the model.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-subtle rounded-md border border-border-subtle">
          {rules.map((rule) => (
            <li key={rule.id} className="flex items-center justify-between gap-3 px-3.5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {rule.name}
                  <span className="ml-2 rounded-sm bg-surface-2 px-1.5 py-0.5 text-xs font-normal text-ink-muted">
                    {KIND_LABEL[rule.kind]}
                  </span>
                </p>
                <p className="truncate font-mono text-xs text-ink-muted">
                  {rule.pattern} → {rule.replacement}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Toggle
                  checked={rule.enabled}
                  onChange={() => handleToggle(rule)}
                  disabled={busyId === rule.id}
                  label={`Toggle ${rule.name}`}
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

      <div className="rounded-md border border-border-subtle bg-surface-1 p-3.5">
        <p className="text-sm font-medium text-ink">Live preview</p>
        <p className="mb-2 mt-0.5 text-xs text-ink-muted">
          See exactly what your enabled rules remove. Nothing here is saved.
        </p>
        <textarea
          value={sample}
          onChange={(event) => setSample(event.target.value)}
          rows={3}
          className="w-full rounded-md border border-border-default bg-surface-0 px-3 py-2 font-mono text-sm text-ink focus:border-border-strong focus:outline-none"
        />
        <div className="mt-2 flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={handlePreview} disabled={isPreviewing}>
            {isPreviewing ? "Redacting…" : "Preview redaction"}
          </Button>
          {preview && (
            <span className="text-xs text-ink-muted">
              {preview.totalRedactions} redaction{preview.totalRedactions === 1 ? "" : "s"}
            </span>
          )}
        </div>
        {preview && (
          <pre className="mt-2 overflow-x-auto rounded-sm border border-border-subtle bg-surface-0 px-3 py-2 font-mono text-sm text-ink">
            {preview.redacted}
          </pre>
        )}
      </div>
    </div>
  );
}
