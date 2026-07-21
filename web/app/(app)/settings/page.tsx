import type { Metadata } from "next";
import Link from "next/link";
import { getMe } from "@/lib/api/auth";
import { listApiKeys, listInvites } from "@/lib/api/workspaces";
import { listCalendarAccounts, calendarConnectUrl } from "@/lib/api/calendar";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import type { ApiKey, CalendarAccount, WorkspaceInvite, WorkspaceRole } from "@/lib/api/types";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { ProfilePanel, WorkspacePanel } from "@/components/settings/ProfilePanel";
import { ApiKeysManager } from "@/components/settings/ApiKeysManager";
import { TeamInvites } from "@/components/settings/TeamInvites";
import { CalendarConnections } from "@/components/integrations/CalendarConnections";
import { BackendDownState } from "@/components/ui/BackendDownState";

export const metadata: Metadata = {
  title: "Settings — Parlor",
};

export default async function SettingsPage() {
  // Resolve the active workspace id from /auth/me (also confirms the session).
  let workspaceId: string | null = null;
  let workspaceRole: WorkspaceRole | null = null;
  let apiKeys: ApiKey[] = [];
  let calendarAccounts: CalendarAccount[] = [];
  let invites: WorkspaceInvite[] = [];
  let backendDown = false;

  try {
    const me = await getMe();
    workspaceId = me.currentWorkspace.id;
    workspaceRole = me.currentWorkspace.role;
    const canManageTeam = workspaceRole === "owner" || workspaceRole === "admin";
    const [keysResult, accountsResult, invitesResult] = await Promise.all([
      listApiKeys(workspaceId).catch(() => [] as ApiKey[]),
      listCalendarAccounts().catch(() => [] as CalendarAccount[]),
      canManageTeam
        ? listInvites(workspaceId)
            .then((r) => r.items)
            .catch(() => [] as WorkspaceInvite[])
        : Promise.resolve([] as WorkspaceInvite[]),
    ]);
    apiKeys = keysResult;
    calendarAccounts = accountsResult;
    invites = invitesResult;
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
            description="How you appear across Parlor."
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
            title="Team"
            description="Invite teammates into this workspace instead of starting a new one."
          >
            {workspaceRole === "owner" || workspaceRole === "admin" ? (
              <TeamInvites workspaceId={workspaceId} initialInvites={invites} />
            ) : (
              <p className="rounded-md border border-dashed border-border-default bg-surface-1 px-3.5 py-3 text-sm text-ink-muted">
                Only workspace owners and admins can invite teammates.
              </p>
            )}
          </SettingsSection>

          <SettingsSection
            title="API keys"
            description="Programmatic access for the MCP server and your own integrations."
          >
            <ApiKeysManager workspaceId={workspaceId} initialKeys={apiKeys} />
          </SettingsSection>

          <SettingsSection
            title="Calendars"
            description="Connect calendars so Parlor can auto-join your meetings."
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
            description="Tailor how Parlor summarizes each kind of meeting — sales calls, standups, interviews."
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
            title="Privacy & redaction"
            description="Redact PII from transcripts and add custom vocabulary for summaries."
          >
            <Link
              href="/settings/privacy"
              className="inline-flex items-center gap-2 rounded-md border border-border-default bg-surface-0 px-4 py-2.5 text-sm font-medium text-ink shadow-soft-sm transition-colors hover:border-border-strong hover:bg-surface-1"
            >
              Manage privacy & redaction
              <span aria-hidden="true">→</span>
            </Link>
          </SettingsSection>

          <SettingsSection
            title="Sharing defaults"
            description="Control expiry and passcodes for shared meeting links."
          >
            <Link
              href="/settings/sharing"
              className="inline-flex items-center gap-2 rounded-md border border-border-default bg-surface-0 px-4 py-2.5 text-sm font-medium text-ink shadow-soft-sm transition-colors hover:border-border-strong hover:bg-surface-1"
            >
              Manage sharing defaults
              <span aria-hidden="true">→</span>
            </Link>
          </SettingsSection>

          <SettingsSection
            title="Redaction rules"
            description="Custom regex, keyword, and built-in detectors that scrub sensitive text from transcripts locally — with a live preview."
          >
            <Link
              href="/settings/redaction"
              className="inline-flex items-center gap-2 rounded-md border border-border-default bg-surface-0 px-4 py-2.5 text-sm font-medium text-ink shadow-soft-sm transition-colors hover:border-border-strong hover:bg-surface-1"
            >
              Manage redaction rules
              <span aria-hidden="true">→</span>
            </Link>
          </SettingsSection>

          <SettingsSection
            title="Capture exclusions"
            description="Keep sensitive meetings from ever being auto-joined or recorded."
          >
            <Link
              href="/settings/exclusions"
              className="inline-flex items-center gap-2 rounded-md border border-border-default bg-surface-0 px-4 py-2.5 text-sm font-medium text-ink shadow-soft-sm transition-colors hover:border-border-strong hover:bg-surface-1"
            >
              Manage capture exclusions
              <span aria-hidden="true">→</span>
            </Link>
          </SettingsSection>

          <SettingsSection
            title="Prompt library"
            description="Save reusable Ask prompts — recurring recaps, follow-up extractors — and drop them in instead of retyping."
          >
            <Link
              href="/settings/prompts"
              className="inline-flex items-center gap-2 rounded-md border border-border-default bg-surface-0 px-4 py-2.5 text-sm font-medium text-ink shadow-soft-sm transition-colors hover:border-border-strong hover:bg-surface-1"
            >
              Manage prompt library
              <span aria-hidden="true">→</span>
            </Link>
          </SettingsSection>

          <SettingsSection
            title="Saved views"
            description="Save reusable searches — open action items, recurring topic filters — and re-run them with one click instead of retyping."
          >
            <Link
              href="/settings/views"
              className="inline-flex items-center gap-2 rounded-md border border-border-default bg-surface-0 px-4 py-2.5 text-sm font-medium text-ink shadow-soft-sm transition-colors hover:border-border-strong hover:bg-surface-1"
            >
              Manage saved views
              <span aria-hidden="true">→</span>
            </Link>
          </SettingsSection>

          <SettingsSection
            title="Meeting tags"
            description="Workspace-defined tags (name + color) to organize meetings by team, customer, or topic."
          >
            <Link
              href="/settings/tags"
              className="inline-flex items-center gap-2 rounded-md border border-border-default bg-surface-0 px-4 py-2.5 text-sm font-medium text-ink shadow-soft-sm transition-colors hover:border-border-strong hover:bg-surface-1"
            >
              Manage meeting tags
              <span aria-hidden="true">→</span>
            </Link>
          </SettingsSection>

          <SettingsSection
            title="Auto-tag rules"
            description="Automatically apply a meeting tag when a meeting's title matches a pattern — composes with your meeting tags."
          >
            <Link
              href="/settings/auto-tags"
              className="inline-flex items-center gap-2 rounded-md border border-border-default bg-surface-0 px-4 py-2.5 text-sm font-medium text-ink shadow-soft-sm transition-colors hover:border-border-strong hover:bg-surface-1"
            >
              Manage auto-tag rules
              <span aria-hidden="true">→</span>
            </Link>
          </SettingsSection>

          <SettingsSection
            title="Speaker identities"
            description="Map diarized speaker labels to named people for per-person analytics."
          >
            <Link
              href="/settings/speakers"
              className="inline-flex items-center gap-2 rounded-md border border-border-default bg-surface-0 px-4 py-2.5 text-sm font-medium text-ink shadow-soft-sm transition-colors hover:border-border-strong hover:bg-surface-1"
            >
              Manage speaker identities
              <span aria-hidden="true">→</span>
            </Link>
          </SettingsSection>

          <SettingsSection
            title="Retention & compliance"
            description="Set data-retention windows, place a legal hold, and export workspace data."
          >
            <Link
              href="/settings/compliance"
              className="inline-flex items-center gap-2 rounded-md border border-border-default bg-surface-0 px-4 py-2.5 text-sm font-medium text-ink shadow-soft-sm transition-colors hover:border-border-strong hover:bg-surface-1"
            >
              Manage retention & data
              <span aria-hidden="true">→</span>
            </Link>
          </SettingsSection>

          <SettingsSection
            title="Usage"
            description="Admin-only workspace activity: meetings, minutes captured."
          >
            <Link
              href="/settings/usage"
              className="inline-flex items-center gap-2 rounded-md border border-border-default bg-surface-0 px-4 py-2.5 text-sm font-medium text-ink shadow-soft-sm transition-colors hover:border-border-strong hover:bg-surface-1"
            >
              View usage
              <span aria-hidden="true">→</span>
            </Link>
          </SettingsSection>

          <SettingsSection
            title="Audit log"
            description="Review sensitive actions — shares, deletions, key changes — across the workspace."
          >
            <Link
              href="/settings/audit"
              className="inline-flex items-center gap-2 rounded-md border border-border-default bg-surface-0 px-4 py-2.5 text-sm font-medium text-ink shadow-soft-sm transition-colors hover:border-border-strong hover:bg-surface-1"
            >
              View audit log
              <span aria-hidden="true">→</span>
            </Link>
          </SettingsSection>

          <SettingsSection
            title="Developers"
            description="REST API, HMAC-signed webhooks, and developer guides."
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
