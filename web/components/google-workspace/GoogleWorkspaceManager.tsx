"use client";

import { useState } from "react";
import type {
  EventSubscription,
  GoogleWorkspaceConfig,
  OrgMeetingPolicy,
} from "@/lib/api/google-workspace";
import { ConnectionCard } from "./ConnectionCard";
import { OrgUsersCard } from "./OrgUsersCard";
import { EventSubscriptionsCard } from "./EventSubscriptionsCard";
import { CapturePolicyCard } from "./CapturePolicyCard";

type Props = {
  initialConfig: GoogleWorkspaceConfig | null;
  initialPolicy: OrgMeetingPolicy;
  initialSubscriptions: EventSubscription[];
};

/**
 * Orchestrates the org-wide capture surface. Connection state is the source of
 * truth for whether the user/subscription cards are actionable, so it lives
 * here and is threaded down to the dependent cards.
 */
export function GoogleWorkspaceManager({
  initialConfig,
  initialPolicy,
  initialSubscriptions,
}: Props) {
  const [config, setConfig] = useState<GoogleWorkspaceConfig | null>(
    initialConfig,
  );
  const isConfigured = config !== null;

  return (
    <div className="flex flex-col gap-5">
      <ConnectionCard config={config} onConfigChange={setConfig} />
      <OrgUsersCard isConfigured={isConfigured} />
      <EventSubscriptionsCard
        isConfigured={isConfigured}
        initialSubscriptions={initialSubscriptions}
      />
      <CapturePolicyCard initialPolicy={initialPolicy} />
    </div>
  );
}
