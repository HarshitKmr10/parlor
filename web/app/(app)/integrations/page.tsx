import type { Metadata } from "next";
import { listCalendarAccounts, calendarConnectUrl } from "@/lib/api/calendar";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import type { CalendarAccount } from "@/lib/api/types";
import { IntegrationCard } from "@/components/integrations/IntegrationCard";
import { CalendarConnections } from "@/components/integrations/CalendarConnections";
import {
  CalendarGlyph,
  CrmGlyph,
  NotionGlyph,
  SlackGlyph,
} from "@/components/integrations/logos";
import { BackendDownState } from "@/components/ui/BackendDownState";

export const metadata: Metadata = {
  title: "Integrations — Verdant",
};

export default async function IntegrationsPage() {
  let accounts: CalendarAccount[] = [];
  let backendDown = false;
  try {
    accounts = await listCalendarAccounts();
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
        <section
          aria-label="Available integrations"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <IntegrationCard
            name="Calendar"
            description="Connect Google or Microsoft so Verdant joins scheduled meetings automatically."
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
            name="Slack"
            description="Post meeting summaries and action items straight into a channel."
            logo={<SlackGlyph className="h-6 w-6 text-sage-600" />}
            comingSoon
          >
            <ComingSoonNote />
          </IntegrationCard>

          <IntegrationCard
            name="Notion"
            description="Sync transcripts and summaries into a Notion database per meeting."
            logo={<NotionGlyph className="h-6 w-6 text-sage-600" />}
            comingSoon
          >
            <ComingSoonNote />
          </IntegrationCard>

          <IntegrationCard
            name="HubSpot & Salesforce"
            description="Attach call notes and follow-ups to the right deal or contact."
            logo={<CrmGlyph className="h-6 w-6 text-sage-600" />}
            comingSoon
          >
            <ComingSoonNote />
          </IntegrationCard>
        </section>
      )}
    </div>
  );
}

function ComingSoonNote() {
  return (
    <p className="rounded-md border border-dashed border-border-default bg-surface-1 px-3 py-2 text-xs text-ink-muted">
      We&rsquo;re polishing this connector. Want early access? Reach out from
      Settings.
    </p>
  );
}
