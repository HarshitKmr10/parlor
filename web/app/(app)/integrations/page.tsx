import type { Metadata } from "next";
import Link from "next/link";
import { listCalendarAccounts, calendarConnectUrl } from "@/lib/api/calendar";
import { listIntegrations } from "@/lib/api/integrations";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import type { CalendarAccount, Integration } from "@/lib/api/types";
import { IntegrationCard } from "@/components/integrations/IntegrationCard";
import { RecapDestinations } from "@/components/integrations/RecapDestinations";
import { CalendarConnections } from "@/components/integrations/CalendarConnections";
import { CalendarGlyph } from "@/components/integrations/logos";
import { BackendDownState } from "@/components/ui/BackendDownState";

export const metadata: Metadata = {
  title: "Integrations — Verdant",
};

export default async function IntegrationsPage() {
  let accounts: CalendarAccount[] = [];
  let integrations: Integration[] = [];
  let backendDown = false;
  try {
    accounts = await listCalendarAccounts();
    integrations = await listIntegrations().catch(() => []);
  } catch (error: unknown) {
    if (ApiError.isApiError(error) && error.code === BACKEND_UNAVAILABLE_CODE) {
      backendDown = true;
    } else if (ApiError.isApiError(error)) {
      // Treat other errors as "no accounts yet" so the page still renders.
      accounts = [];
    } else {
      throw error;
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-7">
        <p className="eyebrow mb-1.5">Connect your stack</p>
        <h1 className="font-display text-2xl text-ink">Integrations</h1>
        <p className="mt-1.5 max-w-xl text-sm text-ink-muted">
          Bring Verdant into the tools your team already lives in — calendars to
          auto-join, and destinations to push summaries.
        </p>
      </header>

      {backendDown ? (
        <BackendDownState resource="your integrations" />
      ) : (
        <>
        <section
          aria-label="Available integrations"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <IntegrationCard
            name="Connect my calendar"
            description="Per-user. Connect your own Google or Microsoft calendar so Verdant joins the meetings on it automatically."
            logo={<CalendarGlyph className="h-6 w-6 text-sage-600" />}
          >
            <CalendarConnections
              accounts={accounts}
              connectUrls={{
                google: calendarConnectUrl("google"),
                microsoft: calendarConnectUrl("microsoft"),
              }}
            />
          </IntegrationCard>

          <IntegrationCard
            name="Org-wide Google Meet capture"
            description="Admin-only. Capture every Meet across the whole Workspace — including ad-hoc and instant calls — via one domain-authorized service account."
            logo={<CalendarGlyph className="h-6 w-6 text-sage-600" />}
          >
            <div className="flex flex-col gap-3">
              <p className="rounded-md border border-dashed border-border-default bg-surface-1 px-3 py-2 text-xs text-ink-muted">
                This is different from &ldquo;Connect my calendar&rdquo;: that
                covers only your own meetings, while org-wide capture is set up
                once by a Workspace admin and covers everyone.
              </p>
              <Link
                href="/settings/google-workspace"
                className="inline-flex w-fit items-center gap-2 rounded-md bg-sage-600 px-4 py-2 text-sm font-medium text-surface-cream shadow-soft-sm transition-colors hover:bg-sage-700"
              >
                Set up org-wide capture
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </IntegrationCard>

          </section>

          <RecapDestinations integrations={integrations} />
        </>
      )}
    </div>
  );
}

