"use client";

import { useAuth } from "@/lib/auth/AuthProvider";

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-sans text-sm font-medium text-ink-soft">
        {label}
      </span>
      <span className="rounded-md border border-border-subtle bg-surface-1 px-3 py-2.5 text-base text-ink">
        {value}
      </span>
    </div>
  );
}

export function ProfilePanel() {
  const { user } = useAuth();
  return (
    <div className="flex flex-col gap-4">
      <ReadonlyField label="Name" value={user.name} />
      <ReadonlyField label="Email" value={user.email} />
    </div>
  );
}

export function WorkspacePanel() {
  const { currentWorkspace } = useAuth();
  return (
    <div className="flex flex-col gap-4">
      <ReadonlyField label="Workspace name" value={currentWorkspace.name} />
      <ReadonlyField label="Slug" value={currentWorkspace.slug} />
      <ReadonlyField label="Your role" value={currentWorkspace.role} />
    </div>
  );
}
