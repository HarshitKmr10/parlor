import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getMeeting, getTranscript } from "@/lib/api/meetings";
import { getMeetingAnalytics } from "@/lib/api/analytics";
import { getMeetingCoaching } from "@/lib/api/coaching";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import type {
  CoachingScorecard,
  MeetingAnalytics,
  MeetingDetail,
  TranscriptSegment,
} from "@/lib/api/types";
import { MeetingHeader } from "@/components/meetings/detail/MeetingHeader";
import { MeetingTabs, type TabDef } from "@/components/meetings/detail/MeetingTabs";
import { SummaryTab } from "@/components/meetings/detail/SummaryTab";
import { TranscriptTab } from "@/components/meetings/detail/TranscriptTab";
import { AskTab } from "@/components/meetings/detail/AskTab";
import { AnalyticsTab } from "@/components/meetings/detail/AnalyticsTab";
import { CoachingTab } from "@/components/meetings/detail/CoachingTab";
import { HighlightsTab } from "@/components/meetings/detail/HighlightsTab";
import { CommentsTab } from "@/components/meetings/detail/CommentsTab";
import { GenerateSummary } from "@/components/meetings/detail/GenerateSummary";
import { RegenerateSummary } from "@/components/meetings/detail/RegenerateSummary";
import { ShareButton } from "@/components/meetings/detail/ShareButton";
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
  let analytics: MeetingAnalytics | null = null;
  let coaching: CoachingScorecard | null = null;

  try {
    // Fetch meeting + transcript + analytics + coaching in parallel.
    const [meetingResult, transcriptResult, analyticsResult, coachingResult] =
      await Promise.all([
        getMeeting(id),
        getTranscript(id).catch(() => ({ items: [], lastSegmentAt: null })),
        getMeetingAnalytics(id).catch(() => null),
        getMeetingCoaching(id).catch(() => null),
      ]);
    meeting = meetingResult;
    segments = transcriptResult.items;
    analytics = analyticsResult;
    coaching = coachingResult;
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
  const isOngoing =
    meeting.status === "ongoing" || meeting.status === "joining";

  const tabs: TabDef[] = [
    {
      key: "summary",
      label: "Summary",
      panel: meeting.insights ? (
        <div className="flex flex-col gap-4">
          <RegenerateSummary meetingId={meeting.id} />
          <SummaryTab insights={meeting.insights} />
        </div>
      ) : (
        <GenerateSummary meetingId={meeting.id} canSummarize={hasTranscript} />
      ),
    },
    {
      key: "transcript",
      label: "Transcript",
      panel: (
        <TranscriptTab
          meetingId={meeting.id}
          initialSegments={segments}
          isOngoing={isOngoing}
        />
      ),
    },
    {
      key: "analytics",
      label: "Analytics",
      panel: analytics ? (
        <AnalyticsTab analytics={analytics} />
      ) : (
        <p className="rounded-lg border border-dashed border-border-default bg-surface-1/60 px-5 py-10 text-center text-sm text-ink-muted">
          Analytics will appear once this meeting has a transcript.
        </p>
      ),
    },
    {
      key: "coaching",
      label: "Coaching",
      panel: coaching ? (
        <CoachingTab coaching={coaching} />
      ) : (
        <p className="rounded-lg border border-dashed border-border-default bg-surface-1/60 px-5 py-10 text-center text-sm text-ink-muted">
          A coaching scorecard appears once this meeting has a transcript.
        </p>
      ),
    },
    { key: "highlights", label: "Highlights", panel: <HighlightsTab meetingId={meeting.id} /> },
    { key: "comments", label: "Comments", panel: <CommentsTab meetingId={meeting.id} /> },
    { key: "ask", label: "Ask", panel: <AskTab meetingId={meeting.id} /> },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <MeetingHeader meeting={meeting} />
        </div>
        <div className="shrink-0 pt-1">
          <ShareButton meetingId={meeting.id} />
        </div>
      </div>
      <div className="mt-8">
        <MeetingTabs tabs={tabs} />
      </div>
    </div>
  );
}
