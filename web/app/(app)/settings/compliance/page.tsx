import type { Metadata } from "next";
import Link from "next/link";
import { getRetentionSettings } from "@/lib/api/compliance";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import type { RetentionSettings } from "@/lib/api/types";
import { ComplianceSettings } from "@/components/settings/ComplianceSettings";
import { BackendDownState } from "@/components/ui/BackendDownState";

export const metadata: Metadata = {
  title: "Retention & compliance — Parlor",
};

const DEFAULTS: RetentionSettings = { retentionDays: null, legalHold: false };

export default async function CompliancePage() {
  let settings: RetentionSettings = DEFAULTS;
  let backendDown = false;
  try {
    settings = await getRetentionSettings();
  } catch (error: unknown) {
    if (ApiError.isApiError(error) && error.code === BACKEND_UNAVAILABLE_CODE) {
      backendDown = true;
    } else {
      throw error;
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <Link href="/settings" className="text-sm text-ink-muted hover:text-ink">
          ← Settings
        </Link>
        <p className="eyebrow mb-1.5 mt-3">Compliance</p>
        <h1 className="font-display text-2xl text-ink">Retention &amp; data</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Control how long meetings are kept, place a legal hold, and export your
          workspace data.
        </p>
      </header>

      {backendDown ? (
        <BackendDownState resource="compliance settings" />
      ) : (
        <ComplianceSettings initial={settings} />
      )}
    </div>
  );
}
