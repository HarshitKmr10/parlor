"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { getJson } from "@/lib/api/browser";
import type { GoogleWorkspaceUsersResponse } from "@/lib/api/google-workspace";
import { Card } from "./Card";

type Props = {
  isConfigured: boolean;
};

const NOT_CONFIGURED_HINT =
  "Connect a service account above, then load users to confirm Directory access and domain-wide delegation are working.";

export function OrgUsersCard({ isConfigured }: Props) {
  const [users, setUsers] = useState<string[] | null>(null);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const handleLoad = async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      const data = await getJson<GoogleWorkspaceUsersResponse>(
        "/api/google-workspace/users",
      );
      setUsers(data.users);
      setTotal(data.total);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't load org users.");
      setUsers(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card
      title="Org users"
      description="Discovered members prove Directory + delegation resolve end to end."
    >
      {!isConfigured ? (
        <p className="rounded-md border border-dashed border-border-default bg-surface-1 px-3.5 py-3 text-sm text-ink-muted">
          {NOT_CONFIGURED_HINT}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleLoad}
              disabled={isLoading}
            >
              {isLoading ? "Loading…" : "Load users"}
            </Button>
          </div>

          {error && (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          )}

          {users !== null && !error && (
            <>
              <p className="text-sm text-ink-muted">
                {total} active {total === 1 ? "member" : "members"} discovered.
              </p>
              {users.length === 0 ? (
                <p className="rounded-md border border-dashed border-border-default bg-surface-1 px-3.5 py-3 text-sm text-ink-muted">
                  No active members returned.
                </p>
              ) : (
                <ul className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto rounded-md border border-border-subtle p-1 sm:grid-cols-2">
                  {users.map((email) => (
                    <li
                      key={email}
                      className="truncate rounded-sm px-2.5 py-1.5 font-mono text-xs text-ink"
                      title={email}
                    >
                      {email}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}
