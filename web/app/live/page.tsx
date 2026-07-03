import type { Metadata } from "next";
import { LiveMeetingView } from "@/components/live-transcript/LiveMeetingView";
import {
  MOCK_ACTION_ITEMS,
  MOCK_MEETING,
  MOCK_SUMMARY_BULLETS,
} from "@/components/live-transcript/mockData";

export const metadata: Metadata = {
  title: "Live meeting — Parlor",
  description:
    "Watch Parlor transcribe a meeting in real time, surface a running summary, capture action items, and answer questions with cited transcript snippets.",
};

export default function LivePage() {
  return (
    <LiveMeetingView
      meeting={MOCK_MEETING}
      summaryBullets={MOCK_SUMMARY_BULLETS}
      actionItems={MOCK_ACTION_ITEMS}
    />
  );
}
