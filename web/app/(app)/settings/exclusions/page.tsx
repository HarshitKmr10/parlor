import type { Metadata } from "next";
import Link from "next/link";
import { listCaptureExclusions } from "@/lib/api/exclusions";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import type { CaptureExclusion } from "@/lib/api/types";
import { CaptureExclusionsManager } from "@/components/settings/CaptureExclusionsManager";
import { BackendDownState } from "@/components/ui/BackendDownState";

export const metadata: Metadata = {
  title: "Capture exclusions",
};

export default async function CaptureExclusionsSettingsPage() {
  let exclusions: CaptureExclusion[] = [];
  let backendDown = false;
  try {
    exclusions = await listCaptureExclusions();
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
        <p className="eyebrow mb-1.5 mt-3">Privacy</p>
        <h1 className="font-display text-2xl text-ink">Capture exclusions</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Do-not-record rules: when a meeting&apos;s title or URL matches one of
          these patterns, Parlor never auto-joins or records it. Matching runs
          locally against the calendar event before any bot is dispatched.
        </p>
      </header>

      {backendDown ? (
        <BackendDownState resource="capture exclusions" />
      ) : (
        <CaptureExclusionsManager initialExclusions={exclusions} />
      )}
    </div>
  );
}
