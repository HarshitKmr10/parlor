"use client";

import { useCallback } from "react";
import { LiveMeetingView } from "@/components/live-transcript/LiveMeetingView";
import { LiveAssist } from "@/components/live-transcript/LiveAssist";
import type {
  ActionItem,
  AskAnswer,
  MeetingMeta,
} from "@/components/live-transcript/types";
import { postJson } from "@/lib/api/browser";
import type { AskResponse, MeetingStatus } from "@/lib/api/types";

type Props = {
  meetingId: string;
  meeting: MeetingMeta;
  initialStatus: MeetingStatus;
  summaryBullets: readonly string[];
  actionItems: readonly ActionItem[];
};

/**
 * Client bridge for the live page: wires the meeting's real transcript poll,
 * status, and the real /ask endpoint into the shared LiveMeetingView. Shows
 * real data only — no mock fallback on the authenticated route.
 */
export function LiveContainer({
  meetingId,
  meeting,
  initialStatus,
  summaryBullets,
  actionItems,
}: Props) {
  const handleAsk = useCallback(
    async (question: string): Promise<AskAnswer> => {
      const result = await postJson<AskResponse>(
        `/api/meetings/${meetingId}/ask`,
        { question },
      );
      return {
        question,
        answer: result.answer,
        citations: result.citations.map((citation) => ({
          segmentId: citation.segmentId,
          // The live components index by speaker id; the contract citation
          // carries a name, so we surface it as the id for label rendering.
          speakerId: citation.speakerName,
          text: citation.text,
          tSec: citation.tStartSec,
        })),
      };
    },
    [meetingId],
  );

  return (
    <div className="flex flex-col gap-4">
      <LiveAssist meetingId={meetingId} />
      <LiveMeetingView
        meeting={meeting}
        summaryBullets={summaryBullets}
        actionItems={actionItems}
        meetingId={meetingId}
        initialStatus={initialStatus}
        onAsk={handleAsk}
      />
    </div>
  );
}
