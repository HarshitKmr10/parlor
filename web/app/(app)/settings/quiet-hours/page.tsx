import type { Metadata } from "next";
import Link from "next/link";
import { getQuietHours } from "@/lib/api/quietHours";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import type { QuietHours } from "@/lib/api/types";
import { QuietHoursSettings } from "@/components/settings/QuietHoursSettings";
import { BackendDownState } from "@/components/ui/BackendDownState";

export const metadata: Metadata = {
  title: "Quiet hours — Parlor",
};

const DEFAULTS: QuietHours = {
  enabled: false,
  startHour: 20,
  endHour: 8,
};

export default async function QuietHoursPage() {
  let settings: QuietHours = DEFAULTS;
  let backendDown = false;
  try {
    settings = await getQuietHours();
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
        <p className="eyebrow mb-1.5 mt-3">Notifications</p>
        <h1 className="font-display text-2xl text-ink">Quiet hours</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Set a daily window during which Parlor holds back your digest and
          notification emails. Personal to you.
        </p>
      </header>

      {backendDown ? (
        <BackendDownState resource="quiet hours" />
      ) : (
        <QuietHoursSettings initial={settings} />
      )}
    </div>
  );
}
