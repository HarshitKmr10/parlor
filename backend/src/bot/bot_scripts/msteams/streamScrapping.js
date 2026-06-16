'use strict';

// Compatibility shim. Audio capture starts inside joinMeeting() so the
// historical "open-roster-and-poll" stream-scrapping step is a no-op here.
// We retain the export so platformRouter.startStreamScrapping keeps a stable
// interface across all platforms.

const { startStreamScrapping } = require('./joinMeeting');

module.exports = { startStreamScrapping };
