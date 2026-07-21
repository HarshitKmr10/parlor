import type { Metadata } from "next";
import Link from "next/link";
import { listTags } from "@/lib/api/tags";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import type { Tag } from "@/lib/api/types";
import { TagsManager } from "@/components/settings/TagsManager";
import { BackendDownState } from "@/components/ui/BackendDownState";

export const metadata: Metadata = {
  title: "Meeting tags",
};

export default async function TagsSettingsPage() {
  let tags: Tag[] = [];
  let backendDown = false;
  try {
    tags = await listTags();
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
        <p className="eyebrow mb-1.5 mt-3">Organization</p>
        <h1 className="font-display text-2xl text-ink">Meeting tags</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Workspace-defined tags — a name and a color — that you can assign to
          meetings to group them by team, customer, or topic. Manage the
          definitions here, then apply them from any meeting&apos;s detail page.
        </p>
      </header>

      {backendDown ? (
        <BackendDownState resource="meeting tags" />
      ) : (
        <TagsManager initialTags={tags} />
      )}
    </div>
  );
}
