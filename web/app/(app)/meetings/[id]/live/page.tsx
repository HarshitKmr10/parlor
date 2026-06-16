import type { Metadata } from "next";
import { getMeeting } from "@/lib/api/meetings";
import { ApiError } from "@/lib/api/error";
import type {
  MeetingMeta,
  Speaker,
  SpeakerTint,
} from "@/components/live-transcript/types";
import {
  MOCK_ACTION_ITEMS,
  MOCK_SUMMARY_BULLETS,
} from "@/components/live-transcript/mockData";
import type { MeetingDetail, Participant } from "@/lib/api/types";
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

export default async function LiveMeetingPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;

  let meta: MeetingMeta;
  try {
    const meeting: MeetingDetail = await getMeeting(id);
    const speakers = toSpeakers(meeting.participants);
    meta = {
      id: meeting.id,
      title: meeting.title,
      startedAt: meeting.startedAt ?? new Date().toISOString(),
      participants: speakers,
    };
  } catch (error: unknown) {
    // Backend down or meeting missing: render a placeholder room so the live
    // view (with its mock fallback) still works for demos.
    if (
      ApiError.isApiError(error) &&
      (error.code === "backend_unavailable" || error.status === 404)
    ) {
      meta = {
        id,
        title: "Live meeting",
        startedAt: new Date().toISOString(),
        participants: [
          { id: "s1", name: "Maya Okonkwo", initials: "MO", sageTint: "sage-500" },
          { id: "s2", name: "Devin Reyes", initials: "DR", sageTint: "sage-400" },
          { id: "s3", name: "Priya Nair", initials: "PN", sageTint: "sage-300" },
          { id: "s4", name: "Tom Albrecht", initials: "TA", sageTint: "sage-500" },
        ],
      };
    } else {
      throw error;
    }
  }

  return (
    <LiveContainer
      meetingId={id}
      meeting={meta}
      summaryBullets={MOCK_SUMMARY_BULLETS}
      actionItems={MOCK_ACTION_ITEMS}
    />
  );
}
