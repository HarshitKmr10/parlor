"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SparkIcon } from "@/components/ui/icons";
import { postJson } from "@/lib/api/browser";
import type { MeetingInsights } from "@/lib/api/types";

type Props = {
  meetingId: string;
};

/**
 * Subtle "Regenerate" affordance shown when a meeting already has insights.
 * POSTs the same `/api/meetings/{id}/summarize` route handler the empty-state
 * button uses, then refreshes the server component to render the new insights.
 */
export function RegenerateSummary({ meetingId }: Props) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const handleRegenerate = async () => {
    setIsGenerating(true);
    setError(undefined);
    try {
      await postJson<MeetingInsights>(
        `/api/meetings/${meetingId}/summarize`,
        {},
      );
      router.refresh();
      // Leave the spinner up until the refreshed insights replace this view.
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't regenerate the summary. Try again.",
      );
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-3">
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
      <Button
        variant="secondary"
        size="sm"
        onClick={handleRegenerate}
        disabled={isGenerating}
        aria-label="Regenerate summary"
      >
        <SparkIcon className="h-4 w-4" />
        {isGenerating ? "Regenerating…" : "Regenerate"}
      </Button>
    </div>
  );
}
