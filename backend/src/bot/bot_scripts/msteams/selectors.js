'use strict';

// Teams web client selectors, tuned against the layouts actually observed
// in our own join runs (free "light-meetings" guest flow and the
// corporate /l/meetup-join/ flow). Teams ships several prejoin chrome
// variants depending on tenant policy and guest vs. authenticated state,
// so each list below is deliberately narrow — only add an entry once it
// has been seen to match in a real run, not speculatively.

const continueOnBrowser = [
  'button:has-text("Continue")',
];

// `joinNow` intentionally matches the exact prejoin label rather than the
// looser `button:has-text("Join")`. The launcher page (which offers
// "Continue on this browser" vs. "Join on the Teams app") also renders a
// button whose text contains the substring "Join" — a loose match would
// fire on the launcher before the real prejoin form has even mounted.
const joinNow = [
  'button:has-text("Join now")',
  '[aria-label*="Join now"]',
];

const nameInput = [
  'input[placeholder*="name"]',
  'input[placeholder*="Name"]',
  'input[type="text"]',
];

const computerAudioRadio = [
  'radio[aria-label*="Computer audio"]',
  'radio:has-text("Computer audio")',
  '[role="radio"][aria-label*="Computer audio"]',
];

const dontUseAudioRadio = [
  'radio[aria-label*="Don\'t use audio"]',
  'radio:has-text("Don\'t use audio")',
  '[role="radio"][aria-label*="Don\'t use audio"]',
];

// Camera toggle button — covers the aria-label phrasing variants seen
// across states (on/off) and terminology (camera/video).
const cameraToggle = [
  'button[aria-label*="Turn off camera"]',
  'button[aria-label*="Turn on camera"]',
  'button[aria-label*="Turn camera off"]',
  'button[aria-label*="Turn camera on"]',
  'button[aria-label*="Turn off video"]',
  'button[aria-label*="Turn on video"]',
  'button[aria-label*="Turn video off"]',
  'button[aria-label*="Turn video on"]',
];

// There is no dedicated mic-toggle selector here by design — post-admission
// mic muting goes through the Ctrl+Shift+M keyboard shortcut instead, since
// that fires reliably once the meeting page has focus. See join.js's
// muteMicPostAdmission().

// In-meeting marker. `#hangup-button` is the most stable indicator across
// Teams web layouts we've tested against; the data-tid variant is kept as
// a single fallback for tenants that render the newer control bar.
const inMeetingMarkers = [
  '#hangup-button',
  'button[data-tid="hangup-main-btn"]',
];

// Lobby (waiting-room) detection — Teams web surfaces these messages.
const lobbyMarkers = [
  'text="Someone in the meeting should let you in soon"',
  'text*="should let you in soon"',
  'text="When the meeting starts"',
];

const removalMarkers = [
  'text="You\'ve been removed from this meeting"',
  'text*="You\'ve been removed from this meeting"',
  'text="You have been removed from this meeting"',
  'text*="You have been removed from this meeting"',
  'text="Removed from meeting"',
  'text*="Removed from meeting"',
  'text="Meeting ended"',
  'text*="Meeting ended"',
  'text="Call ended"',
  'text*="Call ended"',
  'text="Connection lost"',
  'text*="Connection lost"',
  'text="Unable to connect"',
  'text*="Unable to connect"',
];

// Speaker (output) toggles on the prejoin screen, so the bot's own output
// device stays enabled and it can actually hear participants.
const speakerEnable = [
  'button[aria-label*="Turn speaker on"]',
  'button[aria-label*="Speaker is off"]',
  'button:has-text("Turn speaker on")',
  'button:has-text("Speaker is off")',
];

const speakerDisable = [
  'button[aria-label*="Turn speaker off"]',
  'button[aria-label*="Speaker is on"]',
  'button:has-text("Turn speaker off")',
  'button:has-text("Speaker is on")',
];

const captionsLine = [
  'div[data-tid="closed-caption-renderer-wrapper"] [data-tid="closed-caption-text"]',
];

const captionsAuthor = [
  'div[data-tid="closed-caption-renderer-wrapper"] [data-tid="author"]',
];

const rosterButton = [
  'button[data-tid="app-bar-people-button"]',
  '#roster-button',
];

const rosterParticipant = [
  'li[data-cid="roster-participant"]',
  'li[data-tid="roster-participant"]',
];

const voiceLevelIndicator = [
  '[data-tid="voice-level-stream-outline"]',
];

// Composite "prejoin ready" check — at least one of these must be visible
// to confirm the prejoin FORM itself has rendered (as opposed to the
// launcher page or a loading splash). Since `joinNow` is now a strict
// match, it no longer false-positives on the launcher's "Join on the
// Teams app" button, so it's safe to include alongside the other
// prejoin-only controls as an readiness signal.
const prejoinAnyControl = [
  ...joinNow,
  ...nameInput,
  ...cameraToggle,
  ...computerAudioRadio,
];

module.exports = {
  continueOnBrowser,
  joinNow,
  nameInput,
  computerAudioRadio,
  dontUseAudioRadio,
  cameraToggle,
  speakerEnable,
  speakerDisable,
  prejoinAnyControl,
  inMeetingMarkers,
  lobbyMarkers,
  removalMarkers,
  captionsLine,
  captionsAuthor,
  rosterButton,
  rosterParticipant,
  voiceLevelIndicator,
};
