'use strict';

// Teams web client selectors. These are the *confirmed working* values
// (verified by Vexa's production logs, then ported here verbatim). Do not
// add speculative variants — Teams ships multiple chrome layouts and only
// these have been observed to actually match.

const continueOnBrowser = [
  'button:has-text("Continue")',
];

// `Join now` is the specific prejoin button. Note we do NOT use the looser
// `button:has-text("Join")` here — the launcher page (Continue on this
// browser / Join on the Teams app) renders a "Join on the Teams app" button
// whose text contains "Join", which would falsely match. Stick to the exact
// prejoin label, matching Vexa's verified prejoin-readiness check.
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

// Camera button — covers all aria-label variants Vexa has observed
// (on/off × camera/video × off-on/off).
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

// Vexa does NOT use a mic-toggle selector; mic mute happens via the
// Ctrl+Shift+M keyboard shortcut after admission. We follow the same
// approach in join.js — see muteMicPostAdmission().

// In-meeting marker. `#hangup-button` is the only confirmed-stable
// indicator across Teams web layouts (Vexa: "successfully clicked in
// logs"). The data-tid variant is kept as a single fallback.
const inMeetingMarkers = [
  '#hangup-button',
  'button[data-tid="hangup-main-btn"]',
];

// Lobby (waiting-room) detection — Teams web uses these messages.
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

// Speaker (output) toggles — Vexa uses these on prejoin to ensure
// the bot's *speaker* is on so it can hear participants.
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

// Captions / roster come from Vexa's voice-level + roster work.
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

// Composite "prejoin ready" — at least one of these must be visible to
// confirm the prejoin FORM has actually rendered. Now that joinNow is
// strict ("Join now" / `aria-label*="Join now"`) it can no longer false-
// positive on the launcher's "Join on the Teams app" button, so we put it
// back in alongside the prejoin-only controls. Mirrors Vexa's verified
// `waitForTeamsPreJoinReadiness` predicate.
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
