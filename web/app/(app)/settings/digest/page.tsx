import type { Metadata } from "next";
import Link from "next/link";
import { getDigestPreferences } from "@/lib/api/digest";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import type { DigestPreferences } from "@/lib/api/types";
import { DigestSettings } from "@/components/settings/DigestSettings";
import { BackendDownState } from "@/components/ui/BackendDownState";

export const metadata: Metadata = {
  title: "Digest schedule — Parlor",
};

const DEFAULTS: DigestPreferences = {
  enabled: false,
  frequency: "weekly",
  hourUtc: 13,
  dayOfWeek: 0,
  channel: "email",
};

export default async function DigestSettingsPage() {
  let prefs: DigestPreferences = DEFAULTS;
  let backendDown = false;
  try {
    prefs = await getDigestPreferences();
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
        <p className="eyebrow mb-1.5 mt-3">Reports</p>
        <h1 className="font-display text-2xl text-ink">Digest schedule</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Get a recurring rollup of meetings and action items delivered to your
          inbox or Slack — automatically.
        </p>
      </header>

      {backendDown ? (
        <BackendDownState resource="digest settings" />
      ) : (
        <DigestSettings initial={prefs} />
      )}
    </div>
  );
}
