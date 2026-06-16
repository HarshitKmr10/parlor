'use strict';

// Thin re-export shim. The platformRouter requires
// `../bot/bot_scripts/{platform}/joinMeeting`, so this file provides the
// canonical entry. Implementation lives in index.js.

module.exports = require('./index');
