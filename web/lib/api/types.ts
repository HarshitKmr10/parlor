/**
 * Typed domain entities mirroring docs/API-CONTRACT.md (v1).
 *
 * JSON is camelCase, IDs are UUID strings, timestamps are ISO-8601 UTC.
 * These types are shared by the server-side proxy client and client hooks.
 */

export type WorkspaceRole = "owner" | "admin" | "member";

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  /** Role of the current user within this workspace. */
  role: WorkspaceRole;
}

export type MeetingPlatform = "zoom" | "meet" | "teams";

export type MeetingStatus =
  | "scheduled"
  | "joining"
  | "ongoing"
  | "completed"
  | "failed";

export interface Participant {
  id: string;
  name: string;
  email?: string;
  joinedAt?: string;
  leftAt?: string;
}

export interface Meeting {
  id: string;
  workspaceId: string;
  title: string;
  platform: MeetingPlatform;
  meetingUrl: string;
  status: MeetingStatus;
  scheduledAt?: string;
  startedAt?: string;
  endedAt?: string;
  durationSec?: number;
  participants: Participant[];
  hasSummary: boolean;
  hasRecording: boolean;
  createdAt: string;
}

export interface TranscriptSegment {
  id: string;
  speakerId: string;
  speakerName: string;
  text: string;
  tStartSec: number;
  tEndSec: number;
  createdAt: string;
}

export interface ActionItem {
  id: string;
  text: string;
  assignee?: string;
  dueDate?: string;
  done: boolean;
}

export interface Chapter {
  id: string;
  title: string;
  tStartSec: number;
  tEndSec: number;
}

export interface MeetingInsights {
  summary: string;
  keyPoints: string[];
  actionItems: ActionItem[];
  chapters: Chapter[];
}

export interface Citation {
  segmentId: string;
  speakerName: string;
  text: string;
  tStartSec: number;
  /** Present on workspace-wide ("Ask Verdant") answers. */
  meetingId?: string;
  meetingTitle?: string;
}

export type CalendarProvider = "google" | "microsoft";

export interface CalendarAccount {
  id: string;
  provider: CalendarProvider;
  email: string;
  autoJoin: boolean;
  connectedAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  /** Prefix shown in lists (the full key is returned once on create). */
  prefix: string;
  createdAt: string;
  lastUsedAt?: string;
}

/** Returned once on key creation — the only time the full secret is visible. */
export interface ApiKeyCreated extends ApiKey {
  key: string;
}

/** Detail response augments a meeting with its insights when available. */
export type MeetingDetail = Meeting & { insights?: MeetingInsights };

/** Generic paginated list envelope. */
export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface TranscriptResponse {
  items: TranscriptSegment[];
  lastSegmentAt: string | null;
}

/** Lightweight status payload polled by the live view. */
export interface MeetingStatusResponse {
  id: string;
  status: MeetingStatus;
  hasSummary: boolean;
  endedAt: string | null;
}

export interface AskResponse {
  answer: string;
  citations: Citation[];
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/* ---- Auth payloads ---- */

export interface SignupInput {
  email: string;
  password: string;
  name: string;
  workspaceName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SignupResponse extends AuthTokens {
  user: User;
  workspace: Workspace;
}

export interface LoginResponse extends AuthTokens {
  user: User;
}

export type RefreshResponse = AuthTokens;

export interface MeResponse {
  user: User;
  workspaces: Workspace[];
  currentWorkspace: Workspace;
}

/* ---- Meeting create ---- */

export interface CreateMeetingInput {
  meetingUrl: string;
  title?: string;
  scheduledAt?: string;
  botName?: string;
}

/* ---- Error envelope ---- */

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/* ---- Search ---- */

export interface SearchSnippet {
  segmentId: string;
  speakerName: string;
  tStartSec: number;
  /** HTML with the query wrapped in <mark> tags. */
  snippet: string;
}

export interface SearchResultItem {
  meetingId: string;
  title?: string;
  score: number;
  matchedSegments: number;
  titleMatch: boolean;
  summaryMatch: boolean;
  snippets: SearchSnippet[];
}

export interface SearchResponse {
  query: string;
  items: SearchResultItem[];
  total: number;
}

/* ---- Analytics ---- */

export type Sentiment = "positive" | "neutral" | "negative";

export interface SpeakerStat {
  speakerName: string;
  talkTimeSec: number;
  /** Share of total speaking time, 0..1. */
  talkRatio: number;
  wordCount: number;
  wordsPerMinute: number;
  turns: number;
  longestMonologueSec: number;
  questionsAsked: number;
  fillerWordCount: number;
  sentiment: Sentiment;
  sentimentScore: number;
}

export interface MeetingAnalytics {
  meetingId: string;
  durationSec: number;
  totalWords: number;
  wordsPerMinute: number;
  numSpeakers: number;
  numTurns: number;
  turnsPerMinute: number;
  interactivityScore: number;
  balanceScore: number;
  longestMonologueSec: number;
  longestMonologueSpeaker?: string;
  questionCount: number;
  fillerWordCount: number;
  overallSentiment: Sentiment;
  overallSentimentScore: number;
  speakers: SpeakerStat[];
  computedAt: string;
}

/* ---- Highlights ---- */

export interface Highlight {
  id: string;
  meetingId: string;
  workspaceId?: string;
  createdBy?: string;
  tStartSec: number;
  tEndSec: number;
  label?: string;
  note?: string;
  color?: string;
  excerpt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface WorkspaceHighlight extends Highlight {
  meetingTitle?: string;
}

export interface HighlightListResponse {
  items: Highlight[];
  total: number;
}

export interface WorkspaceHighlightListResponse {
  items: WorkspaceHighlight[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateHighlightInput {
  tStartSec: number;
  tEndSec: number;
  label?: string;
  note?: string;
  color?: string;
}

/* ---- Comments ---- */

export interface CommentAuthor {
  id?: string;
  name: string;
}

export interface Comment {
  id: string;
  meetingId: string;
  parentId?: string;
  author: CommentAuthor;
  body: string;
  anchorTSec?: number;
  anchorSegmentId?: string;
  mentions: CommentAuthor[];
  resolved: boolean;
  edited: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CommentListResponse {
  items: Comment[];
  total: number;
}

/* ---- Sharing ---- */

export interface ShareLink {
  meetingId: string;
  token: string;
  /** Relative app path, e.g. /share/{token}. */
  path: string;
  url?: string;
  includeTranscript: boolean;
  includeHighlights: boolean;
  includeAnalytics: boolean;
  revoked: boolean;
  expiresAt?: string;
  viewCount: number;
  lastViewedAt?: string;
  createdAt?: string;
}

export interface CreateShareInput {
  includeTranscript?: boolean;
  includeHighlights?: boolean;
  includeAnalytics?: boolean;
  expiresInDays?: number;
}

export interface PublicHighlight {
  tStartSec: number;
  tEndSec: number;
  label?: string;
  note?: string;
  color?: string;
  excerpt?: string;
}

/** Public, unauthenticated recap view returned for a share token. */
export interface PublicMeetingView {
  title?: string;
  summary: string;
  keyPoints: string[];
  actionItems: ActionItem[];
  chapters: Chapter[];
  durationSec?: number;
  transcript?: TranscriptSegment[];
  highlights?: PublicHighlight[];
  analytics?: MeetingAnalytics;
  sharedAt: string;
}

/* ---- Action items (cross-meeting tracker) ---- */

export interface ActionItemRecord {
  id: string;
  meetingId: string;
  text: string;
  assignee?: string;
  dueDate?: string;
  done: boolean;
  source: "ai" | "manual";
  createdAt?: string;
  updatedAt?: string;
}

export interface ActionItemListResponse {
  items: ActionItemRecord[];
  total: number;
}

/* ---- Summary templates ---- */

export interface SummaryTemplate {
  id: string;
  name: string;
  instructions: string;
  sections: string[];
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SummaryTemplatePreset {
  key: string;
  name: string;
  instructions: string;
  sections: string[];
}

/* ---- Reports / digest ---- */

export interface DigestAssignee {
  assignee: string;
  open: number;
  done: number;
}

export interface DigestActionItems {
  total: number;
  open: number;
  done: number;
  byAssignee: DigestAssignee[];
}

export interface DigestMeeting {
  id: string;
  title?: string;
  status?: string;
  durationSec?: number;
  createdAt?: string;
}

export interface DigestReport {
  periodFrom: string;
  periodTo: string;
  meetingCount: number;
  completedCount: number;
  totalDurationSec: number;
  avgDurationSec: number;
  busiestDay?: string;
  actionItems: DigestActionItems;
  meetings: DigestMeeting[];
  generatedAt: string;
}

/* ---- Audit log ---- */

export interface AuditEvent {
  id: string;
  actorId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AuditEventListResponse {
  items: AuditEvent[];
  total: number;
}

/* ---- NLP settings (redaction + custom vocab) ---- */

export interface NlpSettings {
  redactionEnabled: boolean;
  redactEmails: boolean;
  redactPhones: boolean;
  redactCards: boolean;
  customVocab: string[];
}

/* ---- Outbound integrations ---- */

export type IntegrationKind = "slack" | "email" | "notion" | "hubspot" | "salesforce";

export interface Integration {
  kind: IntegrationKind;
  enabled: boolean;
  config: Record<string, string>;
  implemented: boolean;
}

/* ---- Trackers ---- */

export interface Tracker {
  id: string;
  name: string;
  keywords: string[];
  enabled: boolean;
}

export interface TrackerHit {
  id: string;
  trackerId: string;
  meetingId: string;
  matchedKeyword: string;
  snippet: string;
  segmentId?: string;
  tStartSec: number;
  createdAt: string;
}

export interface TrackerHitListResponse {
  items: TrackerHit[];
  total: number;
}

/* ---- Coaching ---- */

export interface CoachingSpeaker {
  speakerName: string;
  talkRatio: number;
  questionsAsked: number;
  wordsPerMinute: number;
  fillerWordCount: number;
}

export interface CoachingScorecard {
  meetingId: string;
  overallGrade: string;
  overallScore: number;
  talkRatioTop: number;
  longestMonologueSec: number;
  questionCount: number;
  balanceScore: number;
  tips: string[];
  perSpeaker: CoachingSpeaker[];
}

/* ---- Speaker profiles ---- */

export interface SpeakerProfile {
  id: string;
  displayName: string;
  email?: string;
  aliases: string[];
}

/* ---- Live assist ---- */

export interface MeetingAssist {
  summarySoFar: string;
  suggestedQuestions: string[];
  coverageGaps: string[];
  segmentCount: number;
}

/* ---- Notifications ---- */

export interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  meetingId?: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationListResponse {
  items: Notification[];
  unread: number;
}

/* ---- Digest preferences ---- */

export interface DigestPreferences {
  enabled: boolean;
  frequency: "daily" | "weekly";
  hourUtc: number;
  dayOfWeek: number;
  channel: "email" | "slack";
  target?: string;
  lastSentAt?: string;
}

/* ---- Webhooks (developer) ---- */

export interface WebhookEndpoint {
  id: string;
  url: string;
  description?: string;
  eventTypes: string[];
  secret: string;
  enabled: boolean;
  consecutiveFailures: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface WebhookEventCatalog {
  eventTypes: string[];
}

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  eventId: string;
  eventType: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  responseStatus?: number;
  error?: string;
  nextAttemptAt?: string;
  deliveredAt?: string;
  createdAt?: string;
}

export interface WebhookDeliveryListResponse {
  items: WebhookDelivery[];
  total: number;
}

export interface CreateWebhookInput {
  url: string;
  description?: string;
  eventTypes?: string[];
}

/* ---- Live WebSocket events ---- */

export type LiveEvent =
  | { type: "segment"; segment: TranscriptSegment }
  | { type: "active_speaker"; speakerId: string }
  | { type: "status"; status: MeetingStatus };
