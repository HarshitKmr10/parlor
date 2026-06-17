/**
 * Google Meet DOM Selectors
 * Locale-agnostic Google Meet selectors
 * Keep this file free of runtime logic; export constants only.
 */

// Admission indicators — selectors that must be UNIQUE to the in-call
// state. Mic / camera toggles, [role="toolbar"], background-blur and
// device-warning buttons all exist in the LOBBY PREVIEW too, so any
// lobby-side signal here causes a false-positive "already admitted"
// classification, the bot skips the "Ask to join" click, and sits in
// the lobby until aloneness / removal kicks it out.
//
// Reliable in-call-only signals:
//   - "Leave call" / "Leave meeting" / "Hang up" — only mounted once
//     the bot is past the lobby; the lobby uses "Cancel" / "Ask to
//     join" / "Other ways to join" instead.
//   - [data-meeting-id] — Meet stamps this on the meeting container
//     after admission; absent in the lobby preview.
//   - [data-participant-id] — participant tiles, only mounted in-call.
//   - "Turn on captions" / "Turn off captions" — only in the in-call
//     toolbar; lobby has no captions control.
//   - "Chat with everyone" — in-call chat panel button.
//
// People / generic chat substrings are intentionally OMITTED because
// some lobby UIs surface preview elements that match those patterns.
const googleInitialAdmissionIndicators = [
  'button[aria-label="Leave call"]',
  'button[aria-label*="Leave call"]',
  'button[aria-label="Leave meeting"]',
  'button[aria-label*="Leave meeting"]',
  'button[aria-label*="Hang up"]',
  'button[aria-label="Turn on captions"]',
  'button[aria-label="Turn off captions"]',
  'button[aria-label="Chat with everyone"]',
  '[data-meeting-id]',
  '[data-participant-id]',
];

// Waiting room indicators
const googleWaitingRoomIndicators = [
  'text="Asking to be let in..."',
  'text*="Asking to be let in"',
  'text="You\'ll join the call when someone lets you in"',
  'text*="You\'ll join the call when someone lets you"',
  'text="Please wait until a meeting host brings you into the call"',
  'text="Waiting for the host to let you in"',
  'text="You\'re in the waiting room"',
  'text="Asking to be let in"',
  '[aria-label*="waiting room"]',
  '[aria-label*="Asking to be let in"]',
  '[aria-label*="waiting for admission"]',
  '[role="progressbar"]',
  '[aria-label*="loading"]',
  '.loading-spinner',
  'text="Ask to join"',
  'text="Join now"',
  'text="Can\'t join the meeting"',
  'text="Meeting not found"'
];

// Rejection indicators — meeting not found or access denied.
//
// These intentionally lean on EXACT text matches for the canonical
// rejection strings Meet uses. The earlier loose dialog matchers
// ([role="dialog"]:has-text("not found"), :has-text("ended"), etc.)
// false-matched on Docker-only device-warning dialogs like
// "Camera not found" and "Microphone not found", which appear because
// Chromium is launched with --use-file-for-fake-{video,audio}-capture
// and Meet shows those banners. The bot would then bail thinking the
// meeting was rejected when it was actually just a device warning.
const googleRejectionIndicators = [
  // Exact text matches for common rejection messages
  'text="You can\'t join this video call"',
  'text*="You can\'t join this video call"',
  'text="You can\'t join this call"',
  'text*="can\'t join this"',
  'text="Meeting not found"',
  'text="Can\'t join the meeting"',
  'text="Unable to join"',
  'text="Access denied"',
  'text="Meeting has ended"',
  'text="This meeting has ended"',
  'text="Invalid meeting"',
  'text="Meeting link expired"',
  'text="Check your meeting code"',
  'text*="Check your meeting code"',
  'text="Return to home screen"',
  'text*="Return to home screen"',
  // Dialog-based detection — narrowed to require "meeting" in the
  // dialog text, so device-warning banners ("Camera not found",
  // "Microphone not found") don't match. Real meeting-rejection
  // dialogs always reference the meeting / call.
  '[role="dialog"]:has-text("meeting not found")',
  '[role="alertdialog"]:has-text("meeting not found")',
  '[role="dialog"]:has-text("meeting has ended")',
  '[role="alertdialog"]:has-text("meeting has ended")',
  '[role="dialog"]:has-text("can\'t join this")',
  '[role="alertdialog"]:has-text("can\'t join this")',
  '[role="dialog"]:has-text("Check your meeting code")',
  // Button-based detection (these appear on rejection screens)
  'button:has-text("Return to home screen")',
  'button[aria-label*="Return to home"]',
];

// Admission indicators - meeting controls that appear when admitted
const googleAdmissionIndicators = [
  'button[aria-label*="Chat"]',
  'button[aria-label*="chat"]',
  'button[aria-label*="People"]',
  'button[aria-label*="people"]',
  'button[aria-label*="Participants"]',
  'button[aria-label*="Leave call"]',
  'button[aria-label*="Leave meeting"]',
  'button[aria-label*="Turn off microphone"]',
  'button[aria-label*="Turn on microphone"]',
  'button[aria-label*="Turn off camera"]',
  'button[aria-label*="Turn on camera"]',
  'button[aria-label*="Share screen"]',
  'button[aria-label*="Present now"]',
  '[role="toolbar"]',
  '[data-participant-id]',
  '[data-self-name]',
  '[data-audio-level]',
  '[aria-label*="microphone"]',
  '[aria-label*="camera"]',
  '[data-tooltip*="microphone"]',
  '[data-tooltip*="camera"]',
  '[aria-label*="meeting"]',
  'div[data-meeting-id]'
];

// Participant selectors for speaker detection
const googleParticipantSelectors = [
  'div[data-participant-id]',
  '[data-participant-id]',
  '[aria-label*="participant"]',
  '[data-self-name]',
  '.participant-tile',
  '.video-tile'
];

// Speaking class names - Google Meet uses these for speaker animation
const googleSpeakingClassNames = [
  'Oaajhc',  // Google Meet speaking animation class
  'HX2H7',   // Alternative speaking class
  'wEsLMd',  // Another speaking indicator
  'OgVli',   // Additional speaking class
  'speaking',
  'active-speaker',
  'speaker-active',
  'speaking-indicator',
  'audio-active',
  'mic-active',
  'microphone-active',
  'voice-active',
  'speaking-border',
  'speaking-glow',
  'speaking-highlight'
];

// Silence class names
const googleSilenceClassNames = [
  'gjg47c',  // Google Meet silence class
  'silent',
  'muted',
  'mic-off',
  'microphone-off',
  'audio-inactive',
  'participant-silent',
  'user-silent',
  'no-audio'
];

// Participant container selectors
const googleParticipantContainerSelectors = [
  '[data-participant-id]',
  '[data-self-name]',
  '.participant-tile',
  '.video-tile',
  '[jsname="BOHaEe"]'  // Google Meet meeting container
];

// Primary leave button selectors
const googlePrimaryLeaveButtonSelectors = [
  'button[aria-label="Leave call"]',
  'button[aria-label*="Leave"]',
  'button[aria-label*="leave"]',
  'button[aria-label*="End meeting"]',
  'button[aria-label*="end meeting"]',
  'button[aria-label*="Hang up"]',
  'button[aria-label*="hang up"]',
  '[role="toolbar"] button[aria-label*="Leave"]'
];

// Secondary leave button selectors (confirmation dialogs)
const googleSecondaryLeaveButtonSelectors = [
  'button:has-text("Leave meeting")',
  'button:has-text("Just leave the meeting")',
  'button:has-text("Leave")',
  'button:has-text("End meeting")',
  'button:has-text("Hang up")',
  'button:has-text("End call")',
  'button:has-text("Leave call")',
  '[role="dialog"] button:has-text("Leave")',
  '[role="dialog"] button:has-text("End meeting")',
  '[role="alertdialog"] button:has-text("Leave")',
  'button[aria-label*="confirm"]:has-text("Leave")',
  'button[aria-label*="confirm"]:has-text("End")'
];

// Name selectors for participant identification
const googleNameSelectors = [
  'span.notranslate',  // Primary name element in Google Meet
  '[data-self-name]',
  '.zWGUib',
  '.cS7aqe.N2K3jd',
  '.XWGOtd',
  '[data-tooltip*="name"]',
  '[aria-label*="name"]',
  '.participant-name',
  '.display-name',
  '.user-name'
];

// Speaking indicators (primary speaker detection)
const googleSpeakingIndicators = [
  '.Oaajhc',
  '.HX2H7',
  '.wEsLMd',
  '.OgVli'
];

// Removal/error state indicators
const googleRemovalIndicators = [
  'text="Meeting ended"',
  'text*="Meeting ended"',
  'text="Call ended"',
  'text*="Call ended"',
  'text="You left the meeting"',
  'text*="You left the meeting"',
  'text="Connection lost"',
  'text*="Connection lost"',
  'text="Unable to connect"',
  'text*="Unable to connect"',
  'text="Reconnecting"',
  'text*="Reconnecting"',
  '[role="alert"]',
  '[role="alertdialog"]',
  '.error-message',
  '.connection-error',
  '.meeting-error'
];

// Join button selectors
const googleJoinButtonSelectors = [
  '//button[.//span[text()="Ask to join"]]',
  'button:has-text("Ask to join")',
  'button:has-text("Join now")',
  'button:has-text("Join")'
];

// "Join now" selectors — shown to an AUTHENTICATED user joining a meeting they
// can enter directly (no lobby). Locale-agnostic structural selectors first,
// English text fallbacks last (matching the existing selector style).
const googleJoinNowSelectors = [
  '//button[.//span[text()="Join now"]]',
  'button[aria-label="Join now"]',
  'button[aria-label*="Join now"]',
  'button:has-text("Join now")',
];

// "Switch here" selectors — shown to an authenticated user when the SAME
// account is already in the call on another device/tab; clicking moves the
// active session to this browser.
const googleSwitchHereSelectors = [
  '//button[.//span[text()="Switch here"]]',
  'button[aria-label="Switch here"]',
  'button[aria-label*="Switch here"]',
  'button:has-text("Switch here")',
];

// Camera button selectors
const googleCameraButtonSelectors = [
  '[aria-label*="Turn off camera"]',
  'button[aria-label*="Turn off camera"]',
  'button[aria-label*="Turn on camera"]'
];

// Microphone button selectors
const googleMicrophoneButtonSelectors = [
  '[aria-label*="Turn off microphone"]',
  'button[aria-label*="Turn off microphone"]',
  'button[aria-label*="Turn on microphone"]'
];

// Name input selectors
const googleNameInputSelectors = [
  'input[type="text"][aria-label="Your name"]',
  'input[placeholder*="name"]',
  'input[placeholder*="Name"]'
];

// Meeting container selectors
const googleMeetingContainerSelectors = [
  '[jsname="BOHaEe"]',
  '[role="main"]',
  'body'
];

// Participant ID selectors
const googleParticipantIdSelectors = [
  '[data-participant-id]',
  '[data-self-name]',
  '[jsinstance]'
];

// Comprehensive leave selectors (stateless - covers all scenarios)
const googleLeaveSelectors = [
  // Primary Google Meet leave button
  'button[aria-label="Leave call"]',
  'button[aria-label*="Leave"]',
  'button[aria-label*="leave"]',
  '[role="toolbar"] button[aria-label*="Leave"]',
  'button[aria-label*="End meeting"]',
  'button:has-text("End meeting")',
  'button[aria-label*="Hang up"]',
  'button:has-text("Hang up")',
  // Confirmation dialog buttons
  'button:has-text("Leave meeting")',
  'button:has-text("Just leave the meeting")',
  'button:has-text("Leave")',
  '[role="dialog"] button:has-text("Leave")',
  '[role="dialog"] button:has-text("End meeting")',
  '[role="alertdialog"] button:has-text("Leave")',
  // Generic patterns
  'button:has-text("Close")',
  'button[aria-label="Close"]',
  'button:has-text("Cancel")',
  'button[aria-label="Cancel"]',
  'input[type="button"][value="Leave"]',
  'input[type="submit"][value="Leave"]'
];

// People/participant panel selectors
const googlePeopleButtonSelectors = [
  'button[aria-label^="People"]',
  'button[aria-label*="people"]',
  'button[aria-label*="Participants"]',
  'button[aria-label*="participants"]',
  'button[aria-label*="Show people"]',
  'button[aria-label*="show people"]',
  'button[aria-label*="View people"]',
  'button[aria-label*="view people"]',
  'button[aria-label*="Meeting participants"]',
  'button[aria-label*="meeting participants"]',
  'button:has(span:contains("People"))',
  'button:has(span:contains("people"))',
  'button:has(span:contains("Participants"))',
  'button:has(span:contains("participants"))',
  'button[data-mdc-dialog-action]',
  'button[data-tooltip*="people"]',
  'button[data-tooltip*="People"]',
  'button[data-tooltip*="participants"]',
  'button[data-tooltip*="Participants"]'
];

module.exports = {
  googleInitialAdmissionIndicators,
  googleWaitingRoomIndicators,
  googleRejectionIndicators,
  googleAdmissionIndicators,
  googleParticipantSelectors,
  googleSpeakingClassNames,
  googleSilenceClassNames,
  googleParticipantContainerSelectors,
  googlePrimaryLeaveButtonSelectors,
  googleSecondaryLeaveButtonSelectors,
  googleNameSelectors,
  googleSpeakingIndicators,
  googleRemovalIndicators,
  googleJoinButtonSelectors,
  googleJoinNowSelectors,
  googleSwitchHereSelectors,
  googleCameraButtonSelectors,
  googleMicrophoneButtonSelectors,
  googleNameInputSelectors,
  googleMeetingContainerSelectors,
  googleParticipantIdSelectors,
  googleLeaveSelectors,
  googlePeopleButtonSelectors
};
