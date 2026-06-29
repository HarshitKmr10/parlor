/**
 * Builds a realistic multi-meeting workspace for E2E + manual exploration.
 *
 * Three meetings with distinct topics and multiple speakers so that search,
 * analytics (talk-time / interactivity), highlights, comments, action items
 * and sharing all have meaningful data to render.
 */
import {
  type Account,
  type Meeting,
  type TranscriptSegment,
  createActionItem,
  createComment,
  createHighlight,
  createMeeting,
  createShare,
  embed,
  seedNotification,
  seedTranscript,
  summarize,
} from "./backend";

interface MeetingSeed {
  title: string;
  urlSlug: string;
  segments: TranscriptSegment[];
  highlights: { tStartSec: number; tEndSec: number; label: string; color?: string }[];
  comments: { body: string; anchorTSec?: number }[];
  actionItems: { text: string; assignee?: string }[];
  share?: { includeTranscript?: boolean; includeAnalytics?: boolean };
}

function seg(
  i: number,
  speaker: string,
  text: string,
  start: number,
  end: number,
): TranscriptSegment {
  const id = `seg-${i}`;
  return { id, speaker, speakerId: `u-${speaker.toLowerCase()}`, text, startTime: start, endTime: end };
}

const SEEDS: MeetingSeed[] = [
  {
    title: "Q3 Roadmap & Billing Migration",
    urlSlug: "q3-roadmap",
    segments: [
      seg(1, "Alice", "Welcome everyone. Today we are planning the Q3 roadmap and the migration to the new billing system.", 0, 12),
      seg(2, "Bob", "The billing migration is the top priority. I will own the database cutover and we need to finish it by next Friday.", 12, 30),
      seg(3, "Carol", "For the roadmap, the three Q3 milestones are billing migration, the analytics dashboard, and the mobile onboarding flow.", 30, 52),
      seg(4, "Alice", "Great. Action item: Bob will lead the billing migration, Carol will follow up on the analytics dashboard design.", 52, 74),
      seg(5, "Bob", "Agreed. Can we reconvene next week to review migration progress before the Friday deadline?", 74, 92),
      seg(6, "Carol", "Yes. I am a little worried about the data volume during the cutover, but overall I think we are in good shape.", 92, 110),
    ],
    highlights: [
      { tStartSec: 12, tEndSec: 30, label: "Billing cutover owner + deadline", color: "gold" },
      { tStartSec: 30, tEndSec: 52, label: "Three Q3 milestones", color: "sage" },
    ],
    comments: [
      { body: "We should double-check the Friday deadline against the freeze window.", anchorTSec: 74 },
      { body: "Love that the milestones are crisp this quarter.", anchorTSec: 30 },
    ],
    actionItems: [
      { text: "Lead the billing database cutover", assignee: "Bob" },
      { text: "Follow up on analytics dashboard design", assignee: "Carol" },
      { text: "Schedule next week's migration review", assignee: "Alice" },
    ],
    share: { includeTranscript: true, includeAnalytics: true },
  },
  {
    title: "Acme Corp — Discovery Sales Call",
    urlSlug: "acme-discovery",
    segments: [
      seg(1, "Dana", "Thanks for taking the time. To start, what does your current meeting workflow look like?", 0, 14),
      seg(2, "Evan", "Honestly it is a mess. We record calls but nobody ever goes back to watch them, so decisions get lost.", 14, 36),
      seg(3, "Dana", "That is exactly the pain we solve. Verdant gives you searchable transcripts and automatic summaries.", 36, 56),
      seg(4, "Evan", "How does pricing work for a team of about fifty people?", 56, 70),
      seg(5, "Dana", "We have a per-seat plan, and I can put together a tailored quote. What is your timeline to decide?", 70, 90),
      seg(6, "Evan", "We want to roll something out before the end of the quarter, so fairly soon.", 90, 104),
    ],
    highlights: [
      { tStartSec: 14, tEndSec: 36, label: "Pain: lost decisions from unwatched calls", color: "gold" },
      { tStartSec: 90, tEndSec: 104, label: "Buying signal: end-of-quarter timeline", color: "sage" },
    ],
    comments: [{ body: "Strong buying signal here — fast-track the quote.", anchorTSec: 90 }],
    actionItems: [
      { text: "Send tailored 50-seat quote to Evan", assignee: "Dana" },
      { text: "Share searchable-transcript demo recording", assignee: "Dana" },
    ],
    share: { includeAnalytics: true },
  },
  {
    title: "Engineering Daily Standup",
    urlSlug: "eng-standup",
    segments: [
      seg(1, "Frank", "Quick standup. Yesterday I shipped the rate-limiting middleware, today I am on idempotency keys.", 0, 16),
      seg(2, "Grace", "I finished the webhook retry queue and I am blocked on a review for the search ranking change.", 16, 34),
      seg(3, "Frank", "I can review the search ranking PR right after this.", 34, 44),
      seg(4, "Grace", "Thanks. No other blockers from me.", 44, 52),
    ],
    highlights: [{ tStartSec: 16, tEndSec: 34, label: "Blocker: search ranking review", color: "gold" }],
    comments: [{ body: "Frank to unblock Grace on the search PR today.", anchorTSec: 34 }],
    actionItems: [{ text: "Review search ranking PR", assignee: "Frank" }],
  },
];

export interface SeededMeeting {
  id: string;
  title: string;
  shareToken?: string;
}

/** Full pipeline: create → transcript → summarize → embed → highlights/comments/actions/share. */
async function seedOne(acct: Account, s: MeetingSeed): Promise<SeededMeeting> {
  const stamp = Math.abs(hash(s.urlSlug)) % 9000;
  const meeting: Meeting = await createMeeting(acct, {
    meetingUrl: `https://meet.google.com/${s.urlSlug}-${stamp}`,
    title: s.title,
    botName: "Verdant Bot",
  });
  // Transcript must land before summarize/highlight-excerpt read it.
  seedTranscript(meeting.id, s.segments);
  // Everything downstream of the transcript is independent — run concurrently.
  await Promise.all([
    summarize(acct, meeting.id),
    embed(acct, meeting.id, s.segments),
    ...s.highlights.map((h) => createHighlight(acct, meeting.id, h)),
    ...s.comments.map((c) => createComment(acct, meeting.id, c)),
    ...s.actionItems.map((a) => createActionItem(acct, meeting.id, a)),
  ]);
  let shareToken: string | undefined;
  if (s.share) shareToken = (await createShare(acct, meeting.id, s.share)).token;
  return { id: meeting.id, title: s.title, shareToken };
}

export async function seedWorkspace(acct: Account): Promise<SeededMeeting[]> {
  // Seed the meetings concurrently — they're independent.
  const meetings = await Promise.all(SEEDS.map((s) => seedOne(acct, s)));
  // Give the inbox content (a real pipeline would emit these on completion).
  seedNotification(acct, {
    type: "recap_ready",
    title: "Your recap is ready",
    body: `"${meetings[0].title}" has been summarized.`,
    link: `/meetings/${meetings[0].id}`,
    meetingId: meetings[0].id,
  });
  return meetings;
}

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h;
}
