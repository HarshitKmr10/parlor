import type { Metadata } from "next";
import Link from "next/link";
import { listPrompts } from "@/lib/api/prompts";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import type { SavedPrompt } from "@/lib/api/types";
import { PromptLibraryManager } from "@/components/settings/PromptLibraryManager";
import { BackendDownState } from "@/components/ui/BackendDownState";

export const metadata: Metadata = {
  title: "Prompt library",
};

export default async function PromptLibrarySettingsPage() {
  let prompts: SavedPrompt[] = [];
  let backendDown = false;
  try {
    prompts = await listPrompts();
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
        <h1 className="font-display text-2xl text-ink">Prompt library</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Save prompts you reuse in Ask — recurring recaps, follow-up
          extractors, review checklists — once, then drop them in instead of
          retyping. Shared across everyone in this workspace.
        </p>
      </header>

      {backendDown ? (
        <BackendDownState resource="prompt library" />
      ) : (
        <PromptLibraryManager initialPrompts={prompts} />
      )}
    </div>
  );
}
