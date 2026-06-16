import type {
  ActionItem,
  AskAnswer,
  MeetingMeta,
  Speaker,
  TranscriptSegment,
} from "./types";

/**
 * Seed data for a realistic 4-person product meeting. The simulation hook
 * (`useMockTranscript`) replays `SCRIPTED_SEGMENTS` on an interval; swapping
 * this module out for a WebSocket feed leaves the components untouched.
 */

export const MOCK_SPEAKERS: Speaker[] = [
  { id: "s1", name: "Maya Okonkwo", initials: "MO", sageTint: "sage-500" },
  { id: "s2", name: "Devin Reyes", initials: "DR", sageTint: "sage-400" },
  { id: "s3", name: "Priya Nair", initials: "PN", sageTint: "sage-300" },
  { id: "s4", name: "Tom Albrecht", initials: "TA", sageTint: "sage-500" },
];

export const MOCK_MEETING: MeetingMeta = {
  id: "m_2026_q3_kickoff",
  title: "Q3 Product Kickoff — Onboarding Revamp",
  startedAt: new Date().toISOString(),
  participants: MOCK_SPEAKERS,
};

/**
 * Pre-written transcript beats. Times are illustrative seeds; the simulation
 * re-stamps each segment with a live, monotonic clock as it emits.
 */
export const SCRIPTED_SEGMENTS: ReadonlyArray<Omit<TranscriptSegment, "id">> = [
  { speakerId: "s1", text: "Alright, thanks everyone for hopping on. Today is all about the onboarding revamp — let's keep it tight.", tStartSec: 0, tEndSec: 7 },
  { speakerId: "s2", text: "Quick context: activation dropped four points last quarter, and most of the fall-off is in the first session.", tStartSec: 7, tEndSec: 15 },
  { speakerId: "s3", text: "We saw the same thing in the session replays. People stall right after the workspace creation step.", tStartSec: 15, tEndSec: 22 },
  { speakerId: "s4", text: "Engineering-wise, that step makes three sequential network calls. We can collapse those into one.", tStartSec: 22, tEndSec: 30 },
  { speakerId: "s1", text: "Love that. So proposal one: a single provisioning call with an optimistic UI while it settles.", tStartSec: 30, tEndSec: 38 },
  { speakerId: "s2", text: "I'd pair it with a progress checklist so the empty state never feels empty. Three steps, no more.", tStartSec: 38, tEndSec: 46 },
  { speakerId: "s3", text: "Design can have that checklist ready by Thursday. I'll mock the optimistic and the error states too.", tStartSec: 46, tEndSec: 54 },
  { speakerId: "s4", text: "If Priya lands the states Thursday, I can have the collapsed call behind a flag by end of next week.", tStartSec: 54, tEndSec: 63 },
  { speakerId: "s1", text: "Good. Let's also instrument time-to-first-value so we can actually prove the win, not just feel it.", tStartSec: 63, tEndSec: 71 },
  { speakerId: "s2", text: "Agreed. I'll define the TTFV event and get it into the spec before we cut the ticket.", tStartSec: 71, tEndSec: 79 },
  { speakerId: "s3", text: "One open question — do we sunset the old tour, or run both behind the flag for a week?", tStartSec: 79, tEndSec: 86 },
  { speakerId: "s1", text: "Run both for a week, then sunset on green metrics. Tom, can you own the flag rollout plan?", tStartSec: 86, tEndSec: 94 },
];

export const MOCK_SUMMARY_BULLETS: readonly string[] = [
  "Activation fell four points; most drop-off is in the first session.",
  "Decision: collapse the three provisioning calls into one with optimistic UI.",
  "New three-step onboarding checklist replaces the empty workspace state.",
  "Instrument time-to-first-value (TTFV) to measure the change.",
  "Old tour runs behind a flag for one week, then sunsets on green metrics.",
];

export const MOCK_ACTION_ITEMS: readonly ActionItem[] = [
  { id: "a1", text: "Mock the checklist plus optimistic and error states by Thursday.", ownerId: "s3", tSec: 54 },
  { id: "a2", text: "Ship the collapsed provisioning call behind a flag by end of next week.", ownerId: "s4", tSec: 63 },
  { id: "a3", text: "Define the TTFV event and add it to the spec before cutting the ticket.", ownerId: "s2", tSec: 79 },
  { id: "a4", text: "Own the flag rollout plan for running the old and new tours in parallel.", ownerId: "s4", tSec: 94 },
];

/**
 * Default mocked "ask this meeting" handler. Returns a cited answer drawn from
 * the scripted transcript so the AskBar is demonstrable without a backend.
 */
export async function mockAsk(question: string): Promise<AskAnswer> {
  // Simulate model latency without hanging the UI.
  await new Promise((resolve) => setTimeout(resolve, 650));
  return {
    question,
    answer:
      "The team decided to collapse the three provisioning network calls into a single call with an optimistic UI, and to replace the empty workspace with a three-step checklist. Success will be measured via a new time-to-first-value metric.",
    citations: [
      {
        segmentId: "c_s4_22",
        speakerId: "s4",
        text: "That step makes three sequential network calls. We can collapse those into one.",
        tSec: 22,
      },
      {
        segmentId: "c_s1_63",
        speakerId: "s1",
        text: "Let's also instrument time-to-first-value so we can actually prove the win.",
        tSec: 63,
      },
    ],
  };
}
