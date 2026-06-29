import type { Metadata } from "next";
import Link from "next/link";
import { getMe } from "@/lib/api/auth";
import { listApiKeys } from "@/lib/api/workspaces";
import { listCalendarAccounts, calendarConnectUrl } from "@/lib/api/calendar";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import type { ApiKey, CalendarAccount } from "@/lib/api/types";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { ProfilePanel, WorkspacePanel } from "@/components/settings/ProfilePanel";
import { ApiKeysManager } from "@/components/settings/ApiKeysManager";
import { CalendarConnections } from "@/components/integrations/CalendarConnections";
import { BackendDownState } from "@/components/ui/BackendDownState";

export const metadata: Metadata = {
  title: "Settings — Verdant",
};

export default async function SettingsPage() {
  // Resolve the active workspace id from /auth/me (also confirms the session).
  let workspaceId: string | null = null;
  let apiKeys: ApiKey[] = [];
  let calendarAccounts: CalendarAccount[] = [];
  let backendDown = false;

  try {
    const me = await getMe();
    workspaceId = me.currentWorkspace.id;
    const [keysResult, accountsResult] = await Promise.all([
      listApiKeys(workspaceId).catch(() => [] as ApiKey[]),
      listCalendarAccounts().catch(() => [] as CalendarAccount[]),
    ]);
    apiKeys = keysResult;
    calendarAccounts = accountsResult;
  } catch (error: unknown) {
    if (ApiError.isApiError(error) && error.code === BACKEND_UNAVAILABLE_CODE) {
      backendDown = true;
    } else {
      throw error;
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-2">
        <p className="eyebrow mb-1.5">Account</p>
        <h1 className="font-display text-2xl text-ink">Settings</h1>
      </header>

      {backendDown || !workspaceId ? (
        <div className="mt-6">
          <BackendDownState resource="your settings" />
        </div>
      ) : (
        <div>
          <SettingsSection
            title="Profile"
            description="How you appear across Verdant."
          >
            <ProfilePanel />
          </SettingsSection>

          <SettingsSection
            title="Workspace"
            description="The shared home for your team's meetings."
          >
            <WorkspacePanel />
          </SettingsSection>

          <SettingsSection
            title="API keys"
            description="Programmatic access for the MCP server and your own integrations."
          >
            <ApiKeysManager workspaceId={workspaceId} initialKeys={apiKeys} />
          </SettingsSection>

          <SettingsSection
            title="Calendars"
            description="Connect calendars so Verdant can auto-join your meetings."
          >
            <CalendarConnections
              accounts={calendarAccounts}
              connectUrls={{
                google: calendarConnectUrl("google"),
                microsoft: calendarConnectUrl("microsoft"),
              }}
            />
          </SettingsSection>

          <SettingsSection
            title="Summary templates"
            description="Tailor how Verdant summarizes each kind of meeting — sales calls, standups, interviews."
          >
            <Link
              href="/settings/templates"
              className="inline-flex items-center gap-2 rounded-md border border-border-default bg-surface-0 px-4 py-2.5 text-sm font-medium text-ink shadow-soft-sm transition-colors hover:border-border-strong hover:bg-surface-1"
            >
              Manage summary templates
              <span aria-hidden="true">→</span>
            </Link>
          </SettingsSection>

          <SettingsSection
            title="Digest schedule"
            description="Automatically deliver a recurring rollup of meetings and action items to email or Slack."
          >
            <Link
              href="/settings/digest"
              className="inline-flex items-center gap-2 rounded-md border border-border-default bg-surface-0 px-4 py-2.5 text-sm font-medium text-ink shadow-soft-sm transition-colors hover:border-border-strong hover:bg-surface-1"
            >
              Configure digest schedule
              <span aria-hidden="true">→</span>
            </Link>
          </SettingsSection>

          <SettingsSection
            title="Developers"
            description="REST API, webhooks, OpenAPI spec, and SDK generation."
          >
            <Link
              href="/developers"
              className="inline-flex items-center gap-2 rounded-md border border-border-default bg-surface-0 px-4 py-2.5 text-sm font-medium text-ink shadow-soft-sm transition-colors hover:border-border-strong hover:bg-surface-1"
            >
              Open developer docs
              <span aria-hidden="true">→</span>
            </Link>
          </SettingsSection>

          <SettingsSection
            title="Webhooks"
            description="Stream meeting events to your own systems with HMAC-signed, auto-retrying webhooks."
          >
            <Link
              href="/settings/webhooks"
              className="inline-flex items-center gap-2 rounded-md border border-border-default bg-surface-0 px-4 py-2.5 text-sm font-medium text-ink shadow-soft-sm transition-colors hover:border-border-strong hover:bg-surface-1"
            >
              Manage webhooks
              <span aria-hidden="true">→</span>
            </Link>
          </SettingsSection>

          <SettingsSection
            title="Org-wide Google Meet capture"
            description="Admin-only. Capture every Meet across your Workspace via a single domain-authorized service account."
          >
            <Link
              href="/settings/google-workspace"
              className="inline-flex items-center gap-2 rounded-md border border-border-default bg-surface-0 px-4 py-2.5 text-sm font-medium text-ink shadow-soft-sm transition-colors hover:border-border-strong hover:bg-surface-1"
            >
              Manage org-wide capture
              <span aria-hidden="true">→</span>
            </Link>
          </SettingsSection>
        </div>
      )}
    </div>
  );
}
