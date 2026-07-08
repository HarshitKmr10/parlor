"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { postJson } from "@/lib/api/browser";
import { isApiErrorBody } from "@/lib/api/error";
import { formatDate } from "@/lib/format";
import type { InviteRole, WorkspaceInvite, WorkspaceInviteCreated } from "@/lib/api/types";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

type Props = {
  workspaceId: string;
  initialInvites: WorkspaceInvite[];
};

export function TeamInvites({ workspaceId, initialInvites }: Props) {
  const [invites, setInvites] = useState<WorkspaceInvite[]>(initialInvites);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("member");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const basePath = `/api/workspaces/${workspaceId}/invites`;

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(undefined);
    if (!isValidEmail(email) || isCreating) return;

    setIsCreating(true);
    try {
      const created = await postJson<WorkspaceInviteCreated>(basePath, {
        email: email.trim(),
        role,
      });
      setInvites((prev) => [created, ...prev]);
      setCreatedLink(created.acceptUrl ?? null);
      setEmail("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't send the invite.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (inviteId: string) => {
    setRevokingId(inviteId);
    setError(undefined);
    try {
      const response = await fetch(`${basePath}/${inviteId}`, { method: "DELETE" });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        throw new Error(
          isApiErrorBody(body) ? body.error.message : "Couldn't revoke the invite.",
        );
      }
      setInvites((prev) => prev.filter((invite) => invite.id !== inviteId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't revoke the invite.");
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={handleInvite}
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <TextField
            label="Invite a teammate"
            type="email"
            placeholder="teammate@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-ink-muted">Role</span>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as InviteRole)}
            className="rounded-md border border-border-default bg-surface-0 px-3 py-2.5 text-sm text-ink"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <Button type="submit" disabled={isCreating || !isValidEmail(email)}>
          {isCreating ? "Sending…" : "Send invite"}
        </Button>
      </form>

      {createdLink && (
        <div className="rounded-md border border-gold-300 bg-gold-50 p-3.5">
          <p className="text-sm font-medium text-gold-800">
            Invite sent. If email delivery isn&rsquo;t configured, share this
            link directly:
          </p>
          <code className="mt-2 block overflow-x-auto rounded-sm border border-gold-200 bg-surface-0 px-3 py-2 font-mono text-sm text-ink">
            {createdLink}
          </code>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}

      {invites.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-default bg-surface-1 px-3.5 py-3 text-sm text-ink-muted">
          No pending invites. Invite a teammate to give them access to this
          workspace.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-subtle rounded-md border border-border-subtle">
          {invites.map((invite) => (
            <li
              key={invite.id}
              className="flex items-center justify-between gap-3 px-3.5 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {invite.email}
                </p>
                <p className="text-xs text-ink-muted">
                  {invite.role} · invited {formatDate(invite.createdAt)}
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleRevoke(invite.id)}
                disabled={revokingId === invite.id}
              >
                {revokingId === invite.id ? "Revoking…" : "Revoke"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
