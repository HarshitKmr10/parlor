'use strict';

// Whisper hallucinations cluster around three patterns:
//   1. Identical short phrases on near-silent inputs ("thank you" loops,
//      "fema.gov", "[Music]").
//   2. Ngram repetition inside a single segment ("you you you you you").
//   3. Generic filler under a token-count floor.
// We catch all three with composable predicates so callers can pick the
// strictness for their pipeline (e.g. real-time vs offline reconciliation).

const KNOWN_PHRASES = new Set(
  [
    'thank you', 'thanks', 'thank you very much', 'thank you so much',
    'you', 'okay', 'mm hmm', 'mm-hmm', 'uh-huh', 'um', 'uh', 'hmm',
    'fema.gov', 'subscribe', 'thanks for watching', 'please subscribe',
    '[music]', '[applause]', '[laughter]', '[silence]', '[noise]',
    'bye', 'bye bye',
  ].map((s) => s.toLowerCase())
);

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isKnownPhrase(text) {
  const norm = normalize(text);
  if (!norm) return true;
  if (KNOWN_PHRASES.has(norm)) return true;
  return false;
}

function hasRepetitionLoop(text, { minRepeats = 3, ngramRange = [2, 6] } = {}) {
  const tokens = normalize(text).split(' ').filter(Boolean);
  if (tokens.length < minRepeats * ngramRange[0]) return false;
  const [low, high] = ngramRange;
  for (let n = low; n <= high; n++) {
    let runs = 1;
    for (let i = n; i + n <= tokens.length; i += n) {
      const a = tokens.slice(i - n, i).join(' ');
      const b = tokens.slice(i, i + n).join(' ');
      if (a === b) {
        runs += 1;
        if (runs >= minRepeats) return true;
      } else {
        runs = 1;
      }
    }
  }
  return false;
}

function isFillerOnly(text, { minChars = 4 } = {}) {
  const norm = normalize(text);
  return norm.length < minChars;
}

function shouldDrop(segment, options = {}) {
  const text = segment?.text;
  if (typeof text !== 'string') return { drop: true, reason: 'no_text' };
  if (isKnownPhrase(text)) return { drop: true, reason: 'known_phrase' };
  if (isFillerOnly(text, options)) return { drop: true, reason: 'filler_only' };
  if (hasRepetitionLoop(text, options)) return { drop: true, reason: 'repetition_loop' };
  return { drop: false, reason: null };
}

module.exports = { shouldDrop, isKnownPhrase, hasRepetitionLoop, isFillerOnly, normalize };
