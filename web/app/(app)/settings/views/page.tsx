import type { Metadata } from "next";
import Link from "next/link";
import { listSavedViews } from "@/lib/api/savedViews";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import type { SavedView } from "@/lib/api/types";
import { SavedViewsManager } from "@/components/settings/SavedViewsManager";
import { BackendDownState } from "@/components/ui/BackendDownState";

export const metadata: Metadata = {
  title: "Saved views",
};

export default async function SavedViewsSettingsPage() {
  let views: SavedView[] = [];
  let backendDown = false;
  try {
    views = await listSavedViews();
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
        <p className="eyebrow mb-1.5 mt-3">Productivity</p>
        <h1 className="font-display text-2xl text-ink">Saved views</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Save searches you run often — open action items, a recurring topic
          filter — once, then re-run them with one click instead of retyping the
          query. Shared across everyone in this workspace.
        </p>
      </header>

      {backendDown ? (
        <BackendDownState resource="saved views" />
      ) : (
        <SavedViewsManager initialViews={views} />
      )}
    </div>
  );
}
