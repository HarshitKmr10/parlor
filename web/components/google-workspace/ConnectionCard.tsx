"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Toggle } from "@/components/ui/Toggle";
import { postJson, del } from "@/lib/api/browser";
import { formatDate } from "@/lib/format";
import type {
  GoogleWorkspaceConfig,
  GoogleWorkspaceConfigRequest,
} from "@/lib/api/google-workspace";
import { Card, StatusBadge } from "./Card";

type Props = {
  config: GoogleWorkspaceConfig | null;
  onConfigChange: (config: GoogleWorkspaceConfig | null) => void;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ConnectionCard({ config, onConfigChange }: Props) {
  const isConfigured = config !== null;

  // The SA JSON is a secret — never pre-filled from the server response.
  const [serviceAccountJson, setServiceAccountJson] = useState("");
  const [domain, setDomain] = useState(config?.domain ?? "");
  const [delegatedAdminEmail, setDelegatedAdminEmail] = useState(
    config?.delegatedAdminEmail ?? "",
  );
  const [notetakerEmail, setNotetakerEmail] = useState(
    config?.notetakerEmail ?? "",
  );
  const [enabled, setEnabled] = useState(config?.enabled ?? true);

  const [isSaving, setIsSaving] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();
  const [fieldErrors, setFieldErrors] = useState<{
    serviceAccountJson?: string;
    delegatedAdminEmail?: string;
    notetakerEmail?: string;
  }>({});

  const validate = (): boolean => {
    const next: typeof fieldErrors = {};
    // SA JSON required only on first configure (no stored key yet).
    if (!isConfigured && serviceAccountJson.trim().length === 0) {
      next.serviceAccountJson =
        "Paste the service-account JSON to connect for the first time.";
    }
    if (serviceAccountJson.trim().length > 0) {
      try {
        JSON.parse(serviceAccountJson);
      } catch {
        next.serviceAccountJson = "This is not valid JSON.";
      }
    }
    if (delegatedAdminEmail.trim().length === 0) {
      next.delegatedAdminEmail =
        "A delegated admin email is required for domain-wide delegation.";
    } else if (!EMAIL_RE.test(delegatedAdminEmail.trim())) {
      next.delegatedAdminEmail = "Enter a valid email address.";
    }
    if (
      notetakerEmail.trim().length > 0 &&
      !EMAIL_RE.test(notetakerEmail.trim())
    ) {
      next.notetakerEmail = "Enter a valid email address.";
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(undefined);
    setSuccess(undefined);
    if (!validate()) return;

    setIsSaving(true);
    const body: GoogleWorkspaceConfigRequest = {
      authMode: "dwd",
      enabled,
      delegatedAdminEmail: delegatedAdminEmail.trim(),
    };
    if (serviceAccountJson.trim().length > 0) {
      body.serviceAccountJson = serviceAccountJson;
    }
    if (domain.trim().length > 0) body.domain = domain.trim();
    if (notetakerEmail.trim().length > 0) {
      body.notetakerEmail = notetakerEmail.trim();
    }

    try {
      const saved = await postJson<GoogleWorkspaceConfig>(
        "/api/google-workspace",
        body,
      );
      onConfigChange(saved);
      // Clear the secret field — the backend only ever returns a fingerprint.
      setServiceAccountJson("");
      setSuccess("Org-wide capture saved.");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Couldn't save the configuration.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setError(undefined);
    setSuccess(undefined);
    setIsDisconnecting(true);
    try {
      await del("/api/google-workspace");
      onConfigChange(null);
      setServiceAccountJson("");
      setSuccess("Disconnected. Org-wide capture is no longer active.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't disconnect.");
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <Card
      title="Connection"
      description="A single admin-authorized service account drives org-wide capture."
      badge={
        isConfigured ? (
          config.enabled ? (
            <StatusBadge tone="ok">Connected · capture on</StatusBadge>
          ) : (
            <StatusBadge tone="warn">Connected · disabled</StatusBadge>
          )
        ) : (
          <StatusBadge tone="muted">Not configured</StatusBadge>
        )
      }
    >
      {isConfigured && (
        <dl className="mb-5 grid grid-cols-1 gap-x-6 gap-y-3 rounded-md border border-border-subtle bg-surface-1 p-4 sm:grid-cols-2">
          <Detail label="Domain" value={config.domain ?? "—"} />
          <Detail
            label="Delegated admin"
            value={config.delegatedAdminEmail ?? "—"}
          />
          <Detail
            label="Service-account fingerprint"
            value={config.serviceAccountFingerprint ?? "—"}
            mono
          />
          <Detail
            label="Notetaker"
            value={config.notetakerEmail ?? "Uses platform default"}
          />
          <Detail label="Last updated" value={formatDate(config.updatedAt)} />
        </dl>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="gw-sa-json"
            className="font-sans text-sm font-medium text-ink-soft"
          >
            Service-account JSON{" "}
            <span className="font-normal text-ink-muted">
              (secret — never stored in the browser or shown again)
            </span>
          </label>
          <textarea
            id="gw-sa-json"
            value={serviceAccountJson}
            onChange={(e) => setServiceAccountJson(e.target.value)}
            rows={6}
            spellCheck={false}
            autoComplete="off"
            placeholder={
              isConfigured
                ? "Leave blank to keep the current key. Paste a new key to rotate it."
                : '{ "type": "service_account", "project_id": "…", "private_key": "…" }'
            }
            aria-invalid={fieldErrors.serviceAccountJson ? true : undefined}
            aria-describedby={
              fieldErrors.serviceAccountJson ? "gw-sa-json-error" : undefined
            }
            className={`rounded-md border bg-surface-0 px-3 py-2.5 font-mono text-xs text-ink outline-none transition-colors placeholder:text-ink-faint ${
              fieldErrors.serviceAccountJson
                ? "border-error focus:border-error"
                : "border-border-default focus:border-border-strong"
            }`}
          />
          {fieldErrors.serviceAccountJson && (
            <p id="gw-sa-json-error" className="text-sm text-error">
              {fieldErrors.serviceAccountJson}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Domain"
            placeholder="acme.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            hint="Optional — your primary Workspace domain."
            autoComplete="off"
          />
          <TextField
            label="Delegated admin email"
            placeholder="admin@acme.com"
            value={delegatedAdminEmail}
            onChange={(e) => setDelegatedAdminEmail(e.target.value)}
            error={fieldErrors.delegatedAdminEmail}
            hint="The admin the service account impersonates for Directory + calendar reads."
            autoComplete="off"
          />
          <TextField
            label="Notetaker email"
            placeholder="notetaker@acme.com"
            value={notetakerEmail}
            onChange={(e) => setNotetakerEmail(e.target.value)}
            error={fieldErrors.notetakerEmail}
            hint="Optional — the account the bot joins meetings as."
            autoComplete="off"
          />
          <div className="flex flex-col gap-1.5">
            <span className="font-sans text-sm font-medium text-ink-soft">
              Capture enabled
            </span>
            <label className="flex items-center gap-3 rounded-md border border-border-default bg-surface-0 px-3 py-2.5">
              <Toggle
                checked={enabled}
                onChange={setEnabled}
                label="Enable org-wide capture"
              />
              <span className="text-sm text-ink-muted">
                {enabled ? "Auto-join is active" : "Stored but paused"}
              </span>
            </label>
          </div>
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

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={isSaving}>
            {isSaving
              ? "Saving…"
              : isConfigured
                ? "Save changes"
                : "Connect org-wide capture"}
          </Button>
          {isConfigured && (
            <Button
              type="button"
              variant="danger"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? "Disconnecting…" : "Disconnect"}
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

function Detail({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium tracking-wide text-ink-muted uppercase">
        {label}
      </dt>
      <dd
        className={`mt-0.5 truncate text-sm text-ink ${mono ? "font-mono text-xs" : ""}`}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
