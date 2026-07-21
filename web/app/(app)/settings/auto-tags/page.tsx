import type { Metadata } from "next";
import Link from "next/link";
import { listAutoTagRules } from "@/lib/api/autoTag";
import { listTags } from "@/lib/api/tags";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import type { AutoTagRule, Tag } from "@/lib/api/types";
import { AutoTagRulesManager } from "@/components/settings/AutoTagRulesManager";
import { BackendDownState } from "@/components/ui/BackendDownState";

export const metadata: Metadata = {
  title: "Auto-tag rules",
};

export default async function AutoTagSettingsPage() {
  let rules: AutoTagRule[] = [];
  let tags: Tag[] = [];
  let backendDown = false;
  try {
    [rules, tags] = await Promise.all([listAutoTagRules(), listTags()]);
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
        <h1 className="font-display text-2xl text-ink">Auto-tag rules</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Automatically apply a meeting tag when a meeting&rsquo;s title matches a
          pattern. Rules run when a meeting is summarized and add their tag
          alongside any tags you assigned manually.
        </p>
      </header>

      {backendDown ? (
        <BackendDownState resource="auto-tag rules" />
      ) : (
        <AutoTagRulesManager initialRules={rules} tags={tags} />
      )}
    </div>
  );
}
