import type { Metadata } from "next";
import Link from "next/link";
import { getShareSettings } from "@/lib/api/share";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import type { ShareSettings } from "@/lib/api/types";
import { SharingSettings } from "@/components/settings/SharingSettings";
import { BackendDownState } from "@/components/ui/BackendDownState";

export const metadata: Metadata = {
  title: "Sharing defaults — Parlor",
};

const DEFAULTS: ShareSettings = {
  defaultExpiryHours: 0,
  requirePasscode: false,
  defaultPasscode: "",
};

export default async function SharingPage() {
  let settings: ShareSettings = DEFAULTS;
  let backendDown = false;
  try {
    settings = await getShareSettings();
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
        <p className="eyebrow mb-1.5 mt-3">Sharing</p>
        <h1 className="font-display text-2xl text-ink">Sharing defaults</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Control expiry and passcodes for shared meeting links across the
          workspace.
        </p>
      </header>

      {backendDown ? (
        <BackendDownState resource="sharing defaults" />
      ) : (
        <SharingSettings initial={settings} />
      )}
    </div>
  );
}
