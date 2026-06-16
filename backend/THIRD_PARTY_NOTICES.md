# Third-Party Notices

This product includes third-party software. The components below are redistributed
under their respective licenses.

## Humanized input module

`src/bot/bot_scripts/googlemeet/humanizedInput.js` is a bundled (esbuild) build of the
humanized OS-level input module from the **vexa-bot** project
(https://github.com/Vexa-ai/vexa), licensed under the **Apache License, Version 2.0**.

The bundle comprises the humanized interaction layer, the motion-sequence engine,
the synthetic min-jerk motion-sequence data, and the X11/XTEST input wrapper. Per
that module's own metadata, the motion-sequence data is synthetic (generated from a
minimum-jerk motion model with a seeded PRNG) and is not derived from any recording.

A copy of the Apache License 2.0 is available at:
https://www.apache.org/licenses/LICENSE-2.0

Modifications by this project: bundled into a single CommonJS file; internal
identifiers and headers renamed; no behavioral changes to the motion or input logic.
