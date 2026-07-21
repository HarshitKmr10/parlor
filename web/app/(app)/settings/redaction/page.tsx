import type { Metadata } from "next";
import Link from "next/link";
import { listRedactionRules } from "@/lib/api/redaction";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import type { RedactionRule } from "@/lib/api/types";
import { RedactionRulesManager } from "@/components/settings/RedactionRulesManager";
import { BackendDownState } from "@/components/ui/BackendDownState";

export const metadata: Metadata = {
  title: "Redaction rules",
};

export default async function RedactionSettingsPage() {
  let rules: RedactionRule[] = [];
  let backendDown = false;
  try {
    rules = await listRedactionRules();
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
        <h1 className="font-display text-2xl text-ink">Redaction rules</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Custom rules that scrub sensitive text from every transcript before it
          reaches the AI service, embeddings, or a shared page. They run
          alongside the built-in email/phone/card policy — all locally, on your
          own machine.
        </p>
      </header>

      {backendDown ? (
        <BackendDownState resource="redaction rules" />
      ) : (
        <RedactionRulesManager initialRules={rules} />
      )}
    </div>
  );
}
