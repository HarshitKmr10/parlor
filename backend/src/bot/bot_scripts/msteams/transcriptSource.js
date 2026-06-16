'use strict';

const TRANSCRIPT_SOURCE = Object.freeze({
  CSRC_ASR: 'csrc_asr',
  TEAMS_CAPTIONS: 'teams_captions',
});

function normalizeTranscriptSource(raw = process.env.MSTEAMS_TRANSCRIPT_SOURCE) {
  const value = String(raw || '').trim().toLowerCase();
  if ([
    'teams_captions',
    'team_captions',
    'captions',
    'closed_captions',
    'closed_caption',
    'closed_caption_from_platform',
  ].includes(value)) {
    return TRANSCRIPT_SOURCE.TEAMS_CAPTIONS;
  }
  return TRANSCRIPT_SOURCE.CSRC_ASR;
}

module.exports = { TRANSCRIPT_SOURCE, normalizeTranscriptSource };
