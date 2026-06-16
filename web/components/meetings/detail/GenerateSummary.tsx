"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SparkIcon } from "@/components/ui/icons";
import { postJson } from "@/lib/api/browser";
import type { MeetingInsights } from "@/lib/api/types";

type Props = {
  meetingId: string;
  /** Whether there's a transcript to summarize yet. */
  canSummarize: boolean;
};

export function GenerateSummary({ meetingId, canSummarize }: Props) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(undefined);
    try {
      await postJson<MeetingInsights>(
        `/api/meetings/${meetingId}/summarize`,
        {},
      );
      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't generate the summary. Try again.",
      );
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <EmptyState
        icon={<SparkIcon className="h-6 w-6" />}
        title={canSummarize ? "No summary yet" : "Summary pending"}
        description={
          canSummarize
            ? "Generate AI insights — a summary, key points, action items, and chapters — from this meeting's transcript."
            : "Once this meeting has a transcript, Verdant can generate a summary, action items, and chapters."
        }
        action={
          canSummarize ? (
            <Button onClick={handleGenerate} disabled={isGenerating}>
              <SparkIcon className="h-4 w-4" />
              {isGenerating ? "Generating…" : "Generate summary"}
            </Button>
          ) : undefined
        }
      />
      {error && (
        <p
          role="alert"
          className="mx-auto rounded-md bg-error-bg px-3 py-2 text-sm text-error"
        >
          {error}
        </p>
      )}
    </div>
  );
}
