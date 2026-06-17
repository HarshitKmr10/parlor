import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMeeting } from "@/lib/api/meetings";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import type {
  ActionItem,
  MeetingMeta,
  Speaker,
  SpeakerTint,
} from "@/components/live-transcript/types";
import type {
  MeetingDetail,
  MeetingInsights,
  Participant,
} from "@/lib/api/types";
import { BackendDownState } from "@/components/ui/BackendDownState";
import { LiveContainer } from "./LiveContainer";

export const metadata: Metadata = {
  title: "Live meeting — Verdant",
};

type Params = Promise<{ id: string }>;

const TINTS: SpeakerTint[] = ["sage-500", "sage-400", "sage-300"];

function toInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function toSpeakers(participants: Participant[]): Speaker[] {
  return participants.map((participant, index) => ({
    id: participant.id,
    name: participant.name,
    initials: toInitials(participant.name),
    sageTint: TINTS[index % TINTS.length],
  }));
}

/**
 * Build the summary bullets + action items from the meeting's real insights.
 * Prefers the model's key points, falling back to splitting the summary prose.
 * When the meeting has not been summarized yet (typical mid-meeting), both are
 * empty and the view shows a tasteful placeholder instead of fabricated data.
 */
function toInsightProps(insights: MeetingInsights | undefined): {
  summaryBullets: string[];
  actionItems: ActionItem[];
} {
  if (!insights) return { summaryBullets: [], actionItems: [] };

  const summaryBullets =
    insights.keyPoints.length > 0
      ? insights.keyPoints
      : insights.summary
        ? insights.summary
            .split(/\n+/)
            .map((line) => line.trim())
            .filter(Boolean)
        : [];

  const actionItems: ActionItem[] = insights.actionItems.map((item) => ({
    id: item.id,
    text: item.text,
    // The contract assigns by name; the live components key owners by speaker
    // id, which we don't have here, so we leave the owner unattributed.
    ownerId: undefined,
    tSec: 0,
  }));

  return { summaryBullets, actionItems };
}

export default async function LiveMeetingPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;

  let meeting: MeetingDetail;
  try {
    meeting = await getMeeting(id);
  } catch (error: unknown) {
    if (ApiError.isApiError(error)) {
      if (error.code === BACKEND_UNAVAILABLE_CODE) {
        return (
          <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
            <BackendDownState resource="this live meeting" />
          </div>
        );
      }
      if (error.status === 404) notFound();
    }
    throw error;
  }

  const meta: MeetingMeta = {
    id: meeting.id,
    title: meeting.title,
    startedAt: meeting.startedAt ?? new Date().toISOString(),
    participants: toSpeakers(meeting.participants),
  };

  const { summaryBullets, actionItems } = toInsightProps(meeting.insights);

  return (
    <LiveContainer
      meetingId={id}
      meeting={meta}
      initialStatus={meeting.status}
      summaryBullets={summaryBullets}
      actionItems={actionItems}
    />
  );
}
