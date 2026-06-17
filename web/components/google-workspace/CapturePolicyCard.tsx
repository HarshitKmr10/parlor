"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { putJson } from "@/lib/api/browser";
import type {
  OrgMeetingPolicy,
  PolicyMode,
} from "@/lib/api/google-workspace";
import { Card } from "./Card";

type Props = {
  initialPolicy: OrgMeetingPolicy;
};

const MODE_OPTIONS: { value: PolicyMode; label: string; hint: string }[] = [
  { value: "all", label: "All meetings", hint: "Capture everything org-wide." },
  {
    value: "allowlist",
    label: "Allowlist only",
    hint: "Capture only matching emails / domains.",
  },
  {
    value: "denylist",
    label: "Everything except denylist",
    hint: "Capture all but matching emails / domains.",
  },
];

/** Split a textarea value into a trimmed, de-duplicated list (comma or newline). */
function parseList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  );
}

function joinList(items: string[]): string {
  return items.join("\n");
}

export function CapturePolicyCard({ initialPolicy }: Props) {
  const [autoJoinEnabled, setAutoJoinEnabled] = useState(
    initialPolicy.autoJoinEnabled,
  );
  const [mode, setMode] = useState<PolicyMode>(initialPolicy.mode);
  const [allowEmails, setAllowEmails] = useState(
    joinList(initialPolicy.allow.emails),
  );
  const [allowDomains, setAllowDomains] = useState(
    joinList(initialPolicy.allow.domains),
  );
  const [denyEmails, setDenyEmails] = useState(
    joinList(initialPolicy.deny.emails),
  );
  const [denyDomains, setDenyDomains] = useState(
    joinList(initialPolicy.deny.domains),
  );
  const [optOutEmails, setOptOutEmails] = useState(
    joinList(initialPolicy.optOutEmails),
  );
  const [disclosure, setDisclosure] = useState(
    initialPolicy.recordingDisclosureText ?? "",
  );

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();

  const handleSave = async () => {
    setError(undefined);
    setSuccess(undefined);
    setIsSaving(true);
    const body: OrgMeetingPolicy = {
      autoJoinEnabled,
      mode,
      allow: {
        emails: parseList(allowEmails),
        domains: parseList(allowDomains),
        ous: initialPolicy.allow.ous,
      },
      deny: {
        emails: parseList(denyEmails),
        domains: parseList(denyDomains),
        ous: initialPolicy.deny.ous,
      },
      optOutEmails: parseList(optOutEmails),
      recordingDisclosureText:
        disclosure.trim().length > 0 ? disclosure.trim() : null,
    };
    try {
      const saved = await putJson<OrgMeetingPolicy>(
        "/api/google-workspace/policy",
        body,
      );
      // Re-sync editors with the canonical server response.
      setAllowEmails(joinList(saved.allow.emails));
      setAllowDomains(joinList(saved.allow.domains));
      setDenyEmails(joinList(saved.deny.emails));
      setDenyDomains(joinList(saved.deny.domains));
      setOptOutEmails(joinList(saved.optOutEmails));
      setSuccess("Capture policy saved.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't save the policy.");
    } finally {
      setIsSaving(false);
    }
  };

  const showAllow = mode === "allowlist";
  const showDeny = mode === "denylist";

  return (
    <Card
      title="Capture policy"
      description="Consulted before every auto-join. Scope who gets captured and how the recording is disclosed."
    >
      <div className="flex flex-col gap-5">
        <label className="flex items-center gap-3">
          <Toggle
            checked={autoJoinEnabled}
            onChange={setAutoJoinEnabled}
            label="Enable auto-join"
          />
          <span className="text-sm text-ink-soft">
            Auto-join enabled
            <span className="block text-xs text-ink-muted">
              Master switch for unattended joining across the org.
            </span>
          </span>
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-sans text-sm font-medium text-ink-soft">
            Capture mode
          </legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {MODE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer flex-col gap-1 rounded-md border p-3 transition-colors ${
                  mode === opt.value
                    ? "border-sage-400 bg-sage-50"
                    : "border-border-default bg-surface-0 hover:border-border-strong"
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="policy-mode"
                    value={opt.value}
                    checked={mode === opt.value}
                    onChange={() => setMode(opt.value)}
                    className="accent-sage-600"
                  />
                  <span className="text-sm font-medium text-ink">
                    {opt.label}
                  </span>
                </span>
                <span className="text-xs text-ink-muted">{opt.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {showAllow && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ListEditor
              id="gw-allow-emails"
              label="Allow — emails"
              value={allowEmails}
              onChange={setAllowEmails}
              placeholder={"alice@acme.com\nbob@acme.com"}
            />
            <ListEditor
              id="gw-allow-domains"
              label="Allow — domains"
              value={allowDomains}
              onChange={setAllowDomains}
              placeholder={"acme.com\npartner.com"}
            />
          </div>
        )}

        {showDeny && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ListEditor
              id="gw-deny-emails"
              label="Deny — emails"
              value={denyEmails}
              onChange={setDenyEmails}
              placeholder={"ceo@acme.com"}
            />
            <ListEditor
              id="gw-deny-domains"
              label="Deny — domains"
              value={denyDomains}
              onChange={setDenyDomains}
              placeholder={"legal.acme.com"}
            />
          </div>
        )}

        <ListEditor
          id="gw-optout"
          label="Opt-out emails"
          value={optOutEmails}
          onChange={setOptOutEmails}
          placeholder={"private@acme.com"}
          hint="Individuals who are never captured, regardless of mode."
        />

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="gw-disclosure"
            className="font-sans text-sm font-medium text-ink-soft"
          >
            Recording-disclosure text
          </label>
          <textarea
            id="gw-disclosure"
            value={disclosure}
            onChange={(e) => setDisclosure(e.target.value)}
            rows={3}
            placeholder="This meeting is being recorded and summarized by Verdant."
            className="rounded-md border border-border-default bg-surface-0 px-3 py-2.5 font-sans text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-border-strong"
          />
          <p className="text-xs text-ink-muted">
            Shown to participants when the notetaker joins.
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="text-sm text-sage-700">
            {success}
          </p>
        )}

        <div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving…" : "Save policy"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ListEditor({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="font-sans text-sm font-medium text-ink-soft"
      >
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        spellCheck={false}
        placeholder={placeholder}
        className="rounded-md border border-border-default bg-surface-0 px-3 py-2.5 font-mono text-xs text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-border-strong"
      />
      <p className="text-xs text-ink-muted">
        {hint ?? "One per line, or comma-separated."}
      </p>
    </div>
  );
}
