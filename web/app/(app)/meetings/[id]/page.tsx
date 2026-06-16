import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getMeeting, getTranscript } from "@/lib/api/meetings";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import type { MeetingDetail, TranscriptSegment } from "@/lib/api/types";
import { MeetingHeader } from "@/components/meetings/detail/MeetingHeader";
import { MeetingTabs } from "@/components/meetings/detail/MeetingTabs";
import { SummaryTab } from "@/components/meetings/detail/SummaryTab";
import { TranscriptTab } from "@/components/meetings/detail/TranscriptTab";
import { AskTab } from "@/components/meetings/detail/AskTab";
import { GenerateSummary } from "@/components/meetings/detail/GenerateSummary";
import { BackendDownState } from "@/components/ui/BackendDownState";

export const metadata: Metadata = {
  title: "Meeting — Verdant",
};

type Params = Promise<{ id: string }>;

export default async function MeetingDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;

  let meeting: MeetingDetail;
  let segments: TranscriptSegment[] = [];

  try {
    // Fetch meeting + transcript in parallel — no request waterfall.
    const [meetingResult, transcriptResult] = await Promise.all([
      getMeeting(id),
      getTranscript(id).catch(() => ({ items: [], lastSegmentAt: null })),
    ]);
    meeting = meetingResult;
    segments = transcriptResult.items;
  } catch (error: unknown) {
    if (ApiError.isApiError(error)) {
      if (error.code === BACKEND_UNAVAILABLE_CODE) {
        return (
          <div className="mx-auto max-w-4xl">
            <BackendDownState resource="this meeting" />
          </div>
        );
      }
      if (error.status === 404) notFound();
    }
    throw error;
  }

  const hasTranscript = segments.length > 0;

  return (
    <div className="mx-auto max-w-4xl">
      <MeetingHeader meeting={meeting} />
      <div className="mt-8">
        <MeetingTabs
          summary={
            meeting.insights ? (
              <SummaryTab insights={meeting.insights} />
            ) : (
              <GenerateSummary meetingId={meeting.id} canSummarize={hasTranscript} />
            )
          }
          transcript={<TranscriptTab segments={segments} />}
          ask={<AskTab meetingId={meeting.id} />}
        />
      </div>
    </div>
  );
}
