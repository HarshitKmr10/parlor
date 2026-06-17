import type { Metadata } from "next";
import Link from "next/link";
import { getMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import {
  getGoogleWorkspaceConfig,
  getOrgMeetingPolicy,
  listMeetEventSubscriptions,
  type EventSubscription,
  type GoogleWorkspaceConfig,
  type OrgMeetingPolicy,
} from "@/lib/api/google-workspace";
import { BackendDownState } from "@/components/ui/BackendDownState";
import { GoogleWorkspaceManager } from "@/components/google-workspace/GoogleWorkspaceManager";

export const metadata: Metadata = {
  title: "Org-wide Google Meet capture — Verdant",
};

const NOT_CONFIGURED = "google_workspace_not_configured";

const DEFAULT_POLICY: OrgMeetingPolicy = {
  autoJoinEnabled: true,
  mode: "all",
  allow: { emails: [], domains: [], ous: [] },
  deny: { emails: [], domains: [], ous: [] },
  optOutEmails: [],
  recordingDisclosureText: null,
};

export default async function GoogleWorkspacePage() {
  let backendDown = false;
  let config: GoogleWorkspaceConfig | null = null;
  let policy: OrgMeetingPolicy = DEFAULT_POLICY;
  let subscriptions: EventSubscription[] = [];

  try {
    // Confirms the session and the active workspace.
    await getMe();

    const [configResult, policyResult, subsResult] = await Promise.allSettled([
      getGoogleWorkspaceConfig(),
      getOrgMeetingPolicy(),
      listMeetEventSubscriptions(),
    ]);

    if (configResult.status === "fulfilled") {
      config = configResult.value;
    } else if (
      !(
        ApiError.isApiError(configResult.reason) &&
        configResult.reason.code === NOT_CONFIGURED
      )
    ) {
      // A not-configured 400 is the expected unconfigured state; rethrow only
      // a backend-down so the outer catch renders the offline state.
      if (
        ApiError.isApiError(configResult.reason) &&
        configResult.reason.code === BACKEND_UNAVAILABLE_CODE
      ) {
        throw configResult.reason;
      }
    }

    if (policyResult.status === "fulfilled") {
      policy = policyResult.value;
    }
    if (subsResult.status === "fulfilled") {
      subscriptions = subsResult.value.subscriptions;
    }
  } catch (error: unknown) {
    if (ApiError.isApiError(error) && error.code === BACKEND_UNAVAILABLE_CODE) {
      backendDown = true;
    } else if (ApiError.isApiError(error) && error.status === 401) {
      throw error;
    } else if (!ApiError.isApiError(error)) {
      throw error;
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <nav aria-label="Breadcrumb" className="mb-4">
        <Link
          href="/settings"
          className="text-sm text-ink-muted transition-colors hover:text-ink"
        >
          ← Back to Settings
        </Link>
      </nav>

      <header className="mb-7">
        <p className="eyebrow mb-1.5">Admin · Org-wide capture</p>
        <h1 className="font-display text-2xl text-ink">Google Workspace</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Authorize Verdant once, as a Workspace admin, to capture{" "}
          <strong className="font-medium text-ink-soft">every</strong> Google
          Meet across your org — scheduled and ad-hoc — through a single
          domain-authorized service account. This is distinct from the per-user{" "}
          <Link
            href="/integrations"
            className="text-sage-700 underline decoration-sage-300 underline-offset-2 hover:decoration-sage-500"
          >
            calendar connect
          </Link>
          , which only covers an individual&rsquo;s own meetings.
        </p>
      </header>

      {backendDown ? (
        <BackendDownState resource="org-wide Google Meet capture" />
      ) : (
        <GoogleWorkspaceManager
          initialConfig={config}
          initialPolicy={policy}
          initialSubscriptions={subscriptions}
        />
      )}
    </div>
  );
}
