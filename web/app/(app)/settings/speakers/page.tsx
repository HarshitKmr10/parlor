import type { Metadata } from "next";
import Link from "next/link";
import { listSpeakerProfiles } from "@/lib/api/speakers";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import type { SpeakerProfile } from "@/lib/api/types";
import { SpeakersManager } from "@/components/settings/SpeakersManager";
import { BackendDownState } from "@/components/ui/BackendDownState";

export const metadata: Metadata = {
  title: "Speakers — Verdant",
};

export default async function SpeakersPage() {
  let profiles: SpeakerProfile[] = [];
  let backendDown = false;
  try {
    profiles = await listSpeakerProfiles();
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
        <p className="eyebrow mb-1.5 mt-3">People</p>
        <h1 className="font-display text-2xl text-ink">Speaker identities</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Map diarized labels like &ldquo;Speaker 1&rdquo; to named people so
          analytics and transcripts show who actually spoke — across every meeting.
        </p>
      </header>

      {backendDown ? (
        <BackendDownState resource="speaker profiles" />
      ) : (
        <SpeakersManager initial={profiles} />
      )}
    </div>
  );
}
