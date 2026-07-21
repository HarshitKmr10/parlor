import type { Metadata } from "next";
import Link from "next/link";
import { getCapturePrefs } from "@/lib/api/capturePrefs";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import type { CapturePrefs } from "@/lib/api/types";
import { CapturePrefsSettings } from "@/components/settings/CapturePrefsSettings";
import { BackendDownState } from "@/components/ui/BackendDownState";

export const metadata: Metadata = {
  title: "Auto-join & capture — Parlor",
};

const DEFAULTS: CapturePrefs = {
  autoJoinEnabled: true,
  joinLeadMinutes: 2,
  joinZoom: true,
  joinMeet: true,
  joinTeams: true,
};

export default async function CapturePrefsPage() {
  let prefs: CapturePrefs = DEFAULTS;
  let backendDown = false;
  try {
    prefs = await getCapturePrefs();
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
        <p className="eyebrow mb-1.5 mt-3">Capture</p>
        <h1 className="font-display text-2xl text-ink">Auto-join &amp; capture</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Control what Parlor auto-joins from connected calendars — turn it off
          entirely, set how far ahead it joins, or silence a platform.
        </p>
      </header>

      {backendDown ? (
        <BackendDownState resource="auto-join preferences" />
      ) : (
        <CapturePrefsSettings initial={prefs} />
      )}
    </div>
  );
}
