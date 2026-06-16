'use strict';

// Per-speaker capture already gives us "who spoke" via the trackId/peerId
// from the bridge — that's the strong signal. We additionally maintain a
// peerId -> displayName mapping derived from the participant roster; until
// the roster surfaces a name we tag attribution as the peer label so segments
// remain useful.
//
// The classic word-overlap mapping is kept as a fallback for the edge case
// where Teams is in single-mixed mode (e.g. some legacy lobby flows). It uses
// "most overlap with caption boundary, ties broken by closest start" which
// behaves well on rapid-turn speech.

// Build a stable speaker_id from a display name so caption-driven and
// audio-driven segments collapse onto the same identity in the dashboard.
function speakerSlug(name) {
  const normalized = String(name).trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');
  return 'name-' + normalized;
}

function attributeFromTrack({ peerId, trackId, peerLabel, roster, activeSpeakerName, botName, lastBoundSpeaker, csrcSources }) {
  // Highest priority: CSRC-based attribution. The bridge has already
  // resolved each CSRC source ID to a display name (via the
  // correlation map it learns during the meeting). Pick the dominant
  // matched source — preferring (a) the loudest by audioLevel when
  // present, then (b) the most recent by timestamp, then (c) first
  // matched. CSRC is voice-independent, overlap-aware, and survives
  // rosterWatcher flicker.
  if (Array.isArray(csrcSources) && csrcSources.length > 0) {
    const matched = csrcSources.filter((c) => c && typeof c.name === 'string' && c.name.trim());
    if (matched.length > 0) {
      // Pick dominant: lowest audioLevel value indicates loudest in some
      // RTP encodings (dBov, smaller = louder). Treat undefined as 127
      // (silent default per RFC 6464). Then tiebreak by most recent ts.
      const sorted = matched.slice().sort((a, b) => {
        const al = Number.isFinite(a.audioLevel) ? a.audioLevel : 127;
        const bl = Number.isFinite(b.audioLevel) ? b.audioLevel : 127;
        if (al !== bl) return al - bl;
        return (b.timestamp || 0) - (a.timestamp || 0);
      });
      const dom = sorted[0];
      return {
        speaker: dom.name,
        speaker_id: speakerSlug(dom.name),
        confidence: 'csrc_match',
        csrc_sources: matched.map((c) => ({ source: c.source, name: c.name })),
      };
    }
  }

  // Next priority: caller already resolved an active speaker name from
  // the roster history for the chunk's time window — use it.
  if (activeSpeakerName) {
    return {
      speaker: activeSpeakerName,
      speaker_id: speakerSlug(activeSpeakerName),
      confidence: 'roster_active',
    };
  }
  // The peerId → roster-index mapping was unsound. Only useful roster
  // fallback: "exactly one human in the panel" → that's the speaker by
  // elimination. Otherwise fall back to a generic peer label.
  //
  // Two bugs fixed here vs the prior implementation that surfaced on
  // staging meeting 73fa5bf7-... where bot was named "Test" + Harshit:
  //   1. `list` is a string[], NOT an array of {name} objects, so the
  //      old `.map((p) => p?.name)` mapped EVERY entry to undefined and
  //      `humans` was always empty → always fell through to peer_label.
  //   2. The `/bot/i` filter only matches the literal substring "bot".
  //      Bot names like "Test", "ABC", "AIOps" pass through and
  //      compete with the real human, defeating roster_solo.
  // Use the explicit botName param (case-insensitive substring match,
  // matching the binder's _isBot logic) so attribution is consistent
  // across all paths.
  const list = roster?.list;
  if (Array.isArray(list)) {
    const bot = (botName || '').trim().toLowerCase();
    // Normalise the shape: rosterWatcher.snapshot().list returns
    // OBJECTS like {name, speaking}, but captureBridge's cumulative
    // _seenHumans (when wired correctly) feeds plain strings here.
    // Accept both — assuming strings silently dropped every roster
    // entry, which was the root cause of every "Speaker N" PR.
    const humans = list
      .map((entry) => (typeof entry === 'string' ? entry : entry?.name))
      .filter((n) => typeof n === 'string' && n.trim())
      .filter((n) => {
        if (!bot) return true;
        const a = n.trim().toLowerCase();
        return a !== bot && !a.includes(bot) && !bot.includes(a);
      });
    if (humans.length === 1) {
      return {
        speaker: humans[0],
        speaker_id: speakerSlug(humans[0]),
        confidence: 'roster_solo',
      };
    }
  }
  // EXPLICIT user request (staging meeting fa13d898-...): if we don't
  // know who is speaking right now, attribute the segment to the LAST
  // person we confidently bound. Never emit "Speaker N" / raw peerId
  // labels — they're strictly worse than a stale-but-real name (which
  // the end-of-meeting LLM cleanup pass + batch re-diarize can correct
  // later if wrong). Only fall through to the soft "Unknown speaker"
  // label when we've never had a confident binding (true cold start).
  if (lastBoundSpeaker && typeof lastBoundSpeaker === 'string' && lastBoundSpeaker.trim()) {
    return {
      speaker: lastBoundSpeaker,
      speaker_id: speakerSlug(lastBoundSpeaker),
      confidence: 'last_known_speaker',
    };
  }
  return {
    speaker_id: peerId != null ? `peer-${peerId}` : (trackId || 'unknown'),
    speaker: 'Unknown speaker',
    confidence: 'fallback',
  };
}

function attributeWordsByOverlap(words, captionBoundaries) {
  // captionBoundaries: [{ start, end, speaker }]; both arrays sorted by start.
  if (!Array.isArray(words) || !Array.isArray(captionBoundaries) || captionBoundaries.length === 0) {
    return (words || []).map((w) => ({ ...w, speaker: 'Unknown' }));
  }
  let i = 0;
  return words.map((word) => {
    while (i < captionBoundaries.length && captionBoundaries[i].end < word.start) i++;
    let best = null;
    let bestOverlap = -1;
    for (let j = i; j < captionBoundaries.length; j++) {
      const cb = captionBoundaries[j];
      if (cb.start > word.end) break;
      const overlap = Math.min(word.end, cb.end) - Math.max(word.start, cb.start);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        best = cb;
      }
    }
    if (!best) {
      // Nearest neighbour fallback by midpoint distance.
      const mid = (word.start + word.end) / 2;
      let nearest = null;
      let nearestDist = Infinity;
      for (const cb of captionBoundaries) {
        const cMid = (cb.start + cb.end) / 2;
        const dist = Math.abs(cMid - mid);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = cb;
        }
      }
      best = nearest;
    }
    return { ...word, speaker: best?.speaker || 'Unknown' };
  });
}

function groupAdjacentBySpeaker(attributedWords) {
  if (!attributedWords?.length) return [];
  const groups = [];
  let current = null;
  for (const w of attributedWords) {
    if (!current || current.speaker !== w.speaker) {
      if (current) groups.push(current);
      current = { speaker: w.speaker, start: w.start, end: w.end, words: [w] };
    } else {
      current.end = w.end;
      current.words.push(w);
    }
  }
  if (current) groups.push(current);
  return groups.map((g) => ({
    ...g,
    text: g.words.map((w) => w.word).join(' ').replace(/\s+([,.;:!?])/g, '$1'),
  }));
}

module.exports = { attributeFromTrack, attributeWordsByOverlap, groupAdjacentBySpeaker, speakerSlug };
