"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { postJson } from "@/lib/api/browser";
import { isApiErrorBody } from "@/lib/api/error";
import { formatDate } from "@/lib/format";
import type { ApiKey, ApiKeyCreated } from "@/lib/api/types";

type Props = {
  workspaceId: string;
  initialKeys: ApiKey[];
};

export function ApiKeysManager({ workspaceId, initialKeys }: Props) {
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys);
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [revealedKey, setRevealedKey] = useState<ApiKeyCreated | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const basePath = `/api/workspaces/${workspaceId}/api-keys`;

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (name.trim().length === 0 || isCreating) return;
    setIsCreating(true);
    setError(undefined);
    try {
      const created = await postJson<ApiKeyCreated>(basePath, {
        name: name.trim(),
      });
      setRevealedKey(created);
      setKeys((prev) => [created, ...prev]);
      setName("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't create the key.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    setRevokingId(keyId);
    setError(undefined);
    try {
      const response = await fetch(`${basePath}/${keyId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        throw new Error(
          isApiErrorBody(body) ? body.error.message : "Couldn't revoke the key.",
        );
      }
      setKeys((prev) => prev.filter((key) => key.id !== keyId));
      if (revealedKey?.id === keyId) setRevealedKey(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't revoke the key.");
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={handleCreate}
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <TextField
            label="New API key"
            placeholder="e.g. Production MCP"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <Button type="submit" disabled={isCreating || name.trim().length === 0}>
          {isCreating ? "Creating…" : "Create key"}
        </Button>
      </form>

      {revealedKey && (
        <div className="rounded-md border border-gold-300 bg-gold-50 p-3.5">
          <p className="text-sm font-medium text-gold-800">
            Copy your key now — it won&rsquo;t be shown again.
          </p>
          <code className="mt-2 block overflow-x-auto rounded-sm border border-gold-200 bg-surface-0 px-3 py-2 font-mono text-sm text-ink">
            {revealedKey.key}
          </code>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}

      {keys.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-default bg-surface-1 px-3.5 py-3 text-sm text-ink-muted">
          No API keys yet. Create one to query your meetings from the MCP server
          or your own scripts.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-subtle rounded-md border border-border-subtle">
          {keys.map((key) => (
            <li
              key={key.id}
              className="flex items-center justify-between gap-3 px-3.5 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {key.name}
                </p>
                <p className="font-mono text-xs text-ink-muted">
                  {key.prefix}··· · created {formatDate(key.createdAt)}
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleRevoke(key.id)}
                disabled={revokingId === key.id}
              >
                {revokingId === key.id ? "Revoking…" : "Revoke"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
