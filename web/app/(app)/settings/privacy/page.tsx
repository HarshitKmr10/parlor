import type { Metadata } from "next";
import Link from "next/link";
import { getNlpSettings } from "@/lib/api/nlp";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import type { NlpSettings } from "@/lib/api/types";
import { PrivacySettings } from "@/components/settings/PrivacySettings";
import { BackendDownState } from "@/components/ui/BackendDownState";

export const metadata: Metadata = {
  title: "Privacy & redaction — Parlor",
};

const DEFAULTS: NlpSettings = {
  redactionEnabled: false,
  redactEmails: true,
  redactPhones: true,
  redactCards: true,
  customVocab: [],
  summaryLanguage: "en",
};

export default async function PrivacyPage() {
  let settings: NlpSettings = DEFAULTS;
  let backendDown = false;
  try {
    settings = await getNlpSettings();
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
        <h1 className="font-display text-2xl text-ink">Redaction &amp; vocabulary</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Strip sensitive data from transcripts before AI processing and sharing,
          and teach the summarizer your team&apos;s vocabulary.
        </p>
      </header>

      {backendDown ? (
        <BackendDownState resource="privacy settings" />
      ) : (
        <PrivacySettings initial={settings} />
      )}
    </div>
  );
}
