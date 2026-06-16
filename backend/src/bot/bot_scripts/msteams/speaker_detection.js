/**
 * Speaker Detection Module for MS Teams
 * Based on vexa's proven approach with 5-mechanism detection
 * Key insight: voice-level-stream-outline visible = SILENT, hidden = SPEAKING
 */

// Teams selectors (from vexa)
const teamsParticipantSelectors = [
  '[data-tid*="participant"]',
  '[aria-label*="participant"]',
  '[data-tid*="roster"]',
  '[data-tid*="roster-item"]',
  '[data-tid*="video-tile"]',
  '[data-tid*="videoTile"]',
  '[data-tid*="participant-tile"]',
  '[data-tid*="participantTile"]',
  '[role="listitem"]',
  '.participant-tile',
  '.video-tile',
  '.roster-item'
];

const teamsSpeakingClassNames = [
  'speaking', 'active-speaker', 'speaker-active', 'speaking-indicator',
  'audio-active', 'mic-active', 'microphone-active', 'voice-active',
  'speaking-border', 'speaking-glow', 'speaking-highlight',
  'participant-speaking', 'user-speaking', 'speaker-indicator'
];

const teamsSilenceClassNames = [
  'silent', 'muted', 'mic-off', 'microphone-off', 'audio-inactive',
  'participant-silent', 'user-silent', 'no-audio'
];

const teamsParticipantContainerSelectors = [
  '[data-tid*="participant"]',
  '[data-tid*="roster-item"]',
  '[data-tid*="video-tile"]',
  '[data-tid*="videoTile"]',
  '.participant-tile',
  '.video-tile'
];

const teamsNameSelectors = [
  'div[class*="___2u340f0"]',
  '[data-tid*="display-name"]',
  '[data-tid*="participant-name"]',
  '[data-tid*="user-name"]',
  '[aria-label*="name"]',
  '.participant-name',
  '.display-name',
  '.user-name',
  '.roster-item-name',
  '.video-tile-name',
  'span[title]',
  '[title*="name"]',
  '.ms-Persona-primaryText',
  '.ms-Persona-secondaryText'
];

const teamsVoiceLevelSelectors = [
  '[data-tid="voice-level-stream-outline"]'
];

const teamsStreamTypeSelectors = [
  '[data-stream-type]'
];

const teamsAudioActivitySelectors = [
  '[class*="voice" i][class*="level" i]',
  '[class*="speaking" i]',
  '[data-audio-active="true"]'
];

const teamsParticipantIdSelectors = [
  '[data-tid]',
  '[data-participant-id]',
  '[data-user-id]'
];

const teamsMeetingContainerSelectors = [
  '[role="main"]',
  'body'
];

const teamsOcclusionSelectors = [
  '.vdi-frame-occlusion'
];

class SpeakerDetector {
  constructor(page) {
    this.page = page;
    this.isRunning = false;
    this.onSpeakerChange = null;
    this.speakerHistory = []; // Track speaker events for lookup
    this.currentSpeakers = new Map(); // Currently speaking participants
    this.lastSpeaker = null; // Track last known speaker
  }

  /**
   * Start comprehensive speaker detection (vexa-style 5-mechanism approach)
   * @param {Function} onSpeakerChange - Callback for speaker changes: (eventType, participantName, participantId) => void
   */
  async start(onSpeakerChange) {
    if (this.isRunning) {
      console.log('[Teams Speaker] Already running');
      return;
    }

    this.isRunning = true;
    this.onSpeakerChange = onSpeakerChange;

    console.log('[Teams Speaker] Starting vexa-style 5-mechanism speaker detection...');

    try {
      // Inject the speaker detection logic into the browser context
      await this.page.evaluate((config) => {
        const {
          participantSelectors,
          speakingClasses,
          silenceClasses,
          containerSelectors,
          nameSelectors,
          voiceLevelSelectors,
          streamTypeSelectors,
          audioActivitySelectors,
          participantIdSelectors,
          meetingContainerSelectors,
          occlusionSelectors
        } = config;

        // State tracking
        const speakingStates = new Map();
        const lastSpeakingStateById = new Map();
        const lastIndicatorStateById = new Map();
        const lastEventTsById = new Map();
        const observedIndicators = new WeakSet();
        const observedIndicatorsList = new Set();
        const DEBOUNCE_MS = 300;
        const POLL_MS = 500;

        // Helper: Get participant ID
        function getTeamsParticipantId(element) {
          let id = element.getAttribute('data-tid') ||
                  element.getAttribute('data-participant-id') ||
                  element.getAttribute('data-user-id') ||
                  element.getAttribute('data-object-id') ||
                  element.getAttribute('id');

          if (!id) {
            const stableChild = element.querySelector(participantIdSelectors.join(', '));
            if (stableChild) {
              id = stableChild.getAttribute('data-tid') ||
                   stableChild.getAttribute('data-participant-id') ||
                   stableChild.getAttribute('data-user-id');
            }
          }

          if (!id) {
            if (!element.dataset.vexaGeneratedId) {
              element.dataset.vexaGeneratedId = 'teams-id-' + Math.random().toString(36).substr(2, 9);
            }
            id = element.dataset.vexaGeneratedId;
          }

          return id;
        }

        // Helper: Get participant name
        function getTeamsParticipantName(participantElement) {
          for (const selector of nameSelectors) {
            const nameElement = participantElement.querySelector(selector);
            if (nameElement) {
              let nameText = nameElement.textContent ||
                            nameElement.innerText ||
                            nameElement.getAttribute('title') ||
                            nameElement.getAttribute('aria-label');

              if (nameText && nameText.trim()) {
                nameText = nameText.trim();

                const forbiddenSubstrings = [
                  "more_vert", "mic_off", "mic", "videocam", "videocam_off",
                  "present_to_all", "devices", "speaker", "speakers", "microphone",
                  "camera", "camera_off", "share", "chat", "participant", "user"
                ];

                if (!forbiddenSubstrings.some(sub => nameText.toLowerCase().includes(sub.toLowerCase()))) {
                  if (nameText.length > 1 && nameText.length < 50) {
                    return nameText;
                  }
                }
              }
            }
          }

          const ariaLabel = participantElement.getAttribute('aria-label');
          if (ariaLabel && ariaLabel.includes('name')) {
            const nameMatch = ariaLabel.match(/name[:\s]+([^,]+)/i);
            if (nameMatch && nameMatch[1]) {
              const nameText = nameMatch[1].trim();
              if (nameText.length > 1 && nameText.length < 50) {
                return nameText;
              }
            }
          }

          const idToDisplay = getTeamsParticipantId(participantElement);
          return `Teams Participant (${idToDisplay})`;
        }

        // Helper: Check if element is actually visible
        function isElementActuallyVisible(el) {
          const cs = getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          const ariaHidden = el.getAttribute('aria-hidden') === 'true';
          const transform = cs.transform || '';
          const scaledToZero = /matrix\((?:[^,]+,){4}\s*0(?:,|\s*\))/.test(transform) || transform.includes('scale(0');
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            cs.display !== 'none' &&
            cs.visibility !== 'hidden' &&
            cs.opacity !== '0' &&
            !ariaHidden &&
            !scaledToZero
          );
        }

        // VEXA APPROACH: Check for vdi-frame-occlusion class
        // Presence of this class = SPEAKING, absence = SILENT
        function hasVdiFrameOcclusion(el) {
          let current = el;
          while (current) {
            if (current.classList && current.classList.contains('vdi-frame-occlusion')) {
              return true;
            }
            current = current.parentElement;
          }
          return false;
        }

        // Helper: Emit speaker event
        function emitSpeakerEvent(eventType, participantName, participantId) {
          const event = new CustomEvent('teamsSpeakerEvent', {
            detail: { eventType, participantName, participantId, timestamp: Date.now() }
          });
          window.dispatchEvent(event);
        }

        // Helper: Check if speaking based on voice-level indicator
        // VEXA APPROACH: vdi-frame-occlusion class present = SPEAKING
        function isSpeakingForContainer(containerEl) {
          const vSel = voiceLevelSelectors[0];
          const voiceLevel = vSel ? containerEl.querySelector(vSel) : null;

          if (!voiceLevel) {
            // No voice level element - can't determine speaking state
            return false;
          }

          // VEXA'S KEY INSIGHT: Check for vdi-frame-occlusion class
          // If this class is present on the voice-level element or its parents, the person is SPEAKING
          if (hasVdiFrameOcclusion(voiceLevel)) {
            return true; // vdi-frame-occlusion present = SPEAKING
          }

          // Fallback: if voice-level is hidden (not visible), they might be speaking
          // This is the old logic as a secondary check
          if (!isElementActuallyVisible(voiceLevel)) {
            return true;
          }

          // Fallback indicators: any audio activity/speaking indicator visible
          if (audioActivitySelectors.length > 0) {
            const anyInd = containerEl.querySelector(audioActivitySelectors.join(', '));
            if (anyInd && isElementActuallyVisible(anyInd)) {
              return true;
            }
          }

          return false;
        }

        // Helper: Get container for indicator
        function getContainerForIndicator(indicator) {
          const sSel = streamTypeSelectors[0];
          const container = sSel ? indicator.closest(sSel) : null;
          if (container) return container;
          let parent = indicator.parentElement;
          let hops = 0;
          while (parent && hops < 5) {
            if (parent.hasAttribute('data-tid') || parent.hasAttribute('data-stream-type')) return parent;
            parent = parent.parentElement;
            hops++;
          }
          return indicator.parentElement;
        }

        // Helper: Collect same-origin documents (including iframes)
        function collectSameOriginDocs() {
          const docs = [document];
          const visit = (doc) => {
            const iframes = Array.from(doc.querySelectorAll('iframe'));
            for (const frame of iframes) {
              try {
                if (frame.contentDocument) {
                  docs.push(frame.contentDocument);
                  visit(frame.contentDocument);
                }
              } catch {}
            }
          };
          visit(document);
          return docs;
        }

        // Mechanism 1: MutationObserver on participant elements
        function observeTeamsParticipant(participantElement) {
          const participantId = getTeamsParticipantId(participantElement);
          const participantName = getTeamsParticipantName(participantElement);

          speakingStates.set(participantId, 'silent');

          console.log(`[Teams Speaker] Observing: ${participantName} (ID: ${participantId})`);

          const callback = function(mutationsList) {
            for (const mutation of mutationsList) {
              if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const targetElement = mutation.target;
                if (participantElement.contains(targetElement)) {
                  const voiceLevelElement = participantElement.querySelector(voiceLevelSelectors[0]);
                  const hasVoiceLevelElement = !!voiceLevelElement;
                  const isVoiceLevelVisible = hasVoiceLevelElement && isElementActuallyVisible(voiceLevelElement);

                  const isNowVisiblySpeaking = speakingClasses.some(cls => targetElement.classList.contains(cls));
                  const isNowVisiblySilent = silenceClasses.some(cls => targetElement.classList.contains(cls));

                  let isCurrentlySpeaking = false;
                  if (hasVoiceLevelElement) {
                    isCurrentlySpeaking = !isVoiceLevelVisible || isNowVisiblySpeaking;
                  } else {
                    isCurrentlySpeaking = isNowVisiblySpeaking && !isNowVisiblySilent;
                  }

                  const previousState = speakingStates.get(participantId) || 'silent';

                  if (isCurrentlySpeaking && previousState !== 'speaking') {
                    console.log(`[Teams Speaker] SPEAKER_START: ${participantName}`);
                    emitSpeakerEvent('SPEAKER_START', participantName, participantId);
                    speakingStates.set(participantId, 'speaking');
                  } else if (!isCurrentlySpeaking && previousState === 'speaking') {
                    console.log(`[Teams Speaker] SPEAKER_END: ${participantName}`);
                    emitSpeakerEvent('SPEAKER_END', participantName, participantId);
                    speakingStates.set(participantId, 'silent');
                  }
                }
              }
            }
          };

          const observer = new MutationObserver(callback);
          observer.observe(participantElement, {
            attributes: true,
            attributeFilter: ['class'],
            subtree: true
          });

          participantElement.dataset.vexaObserverAttached = 'true';
        }

        // Mechanism 2: MutationObserver on voice-level indicators (added in mechanism 4)

        // Mechanism 3: Polling at 500ms for containers
        const pollTeamsActiveSpeakers = () => {
          try {
            const containers = [];
            for (const sel of containerSelectors) {
              document.querySelectorAll(sel).forEach((el) => containers.push(el));
            }

            containers.forEach((container) => {
              const participantId = String(getTeamsParticipantId(container) || 'unknown');
              const participantName = String(getTeamsParticipantName(container) || participantId);
              const speaking = isSpeakingForContainer(container);
              const prev = lastSpeakingStateById.get(participantId) || 'silent';

              if (speaking && prev !== 'speaking') {
                console.log(`[Teams Speaker Poll] SPEAKER_START: ${participantName}`);
                emitSpeakerEvent('SPEAKER_START', participantName, participantId);
                lastSpeakingStateById.set(participantId, 'speaking');
              } else if (!speaking && prev === 'speaking') {
                console.log(`[Teams Speaker Poll] SPEAKER_END: ${participantName}`);
                emitSpeakerEvent('SPEAKER_END', participantName, participantId);
                lastSpeakingStateById.set(participantId, 'silent');
              } else if (!lastSpeakingStateById.has(participantId)) {
                lastSpeakingStateById.set(participantId, speaking ? 'speaking' : 'silent');
              }
            });
          } catch (e) {
            console.error('[Teams Speaker] Poll error:', e);
          }
        };

        // Mechanism 4: Polling at 150ms for voice indicators + MutationObserver
        const pollTeamsVoiceIndicators = () => {
          try {
            const vSel = voiceLevelSelectors[0];
            if (!vSel) return;
            const allDocs = collectSameOriginDocs();
            const indicators = [];
            for (const d of allDocs) {
              d.querySelectorAll(vSel).forEach(el => indicators.push(el));
            }

            indicators.forEach((indicator) => {
              const container = getContainerForIndicator(indicator);
              if (!container) return;
              const participantId = String(getTeamsParticipantId(container) || 'unknown');
              const participantName = String(getTeamsParticipantName(container) || participantId);

              // Add MutationObserver for quick visibility flips
              // VEXA APPROACH: Watch for vdi-frame-occlusion class changes
              if (!observedIndicators.has(indicator)) {
                try {
                  const observer = new MutationObserver(() => {
                    // PRIMARY: Check for vdi-frame-occlusion (Vexa's approach)
                    const hasOcclusion = hasVdiFrameOcclusion(indicator);
                    const wasSpeaking = lastIndicatorStateById.get(participantId) === true;
                    const now = Date.now();
                    const lastTs = lastEventTsById.get(participantId) || 0;

                    // Debounce: only emit if enough time has passed
                    if ((now - lastTs) < DEBOUNCE_MS) return;

                    if (hasOcclusion && !wasSpeaking) {
                      console.log(`[Teams Speaker Indicator] SPEAKER_START (vdi-occlusion): ${participantName}`);
                      emitSpeakerEvent('SPEAKER_START', participantName, participantId);
                      lastIndicatorStateById.set(participantId, true);
                      lastEventTsById.set(participantId, now);
                    } else if (!hasOcclusion && wasSpeaking) {
                      console.log(`[Teams Speaker Indicator] SPEAKER_END (vdi-occlusion): ${participantName}`);
                      emitSpeakerEvent('SPEAKER_END', participantName, participantId);
                      lastIndicatorStateById.set(participantId, false);
                      lastEventTsById.set(participantId, now);
                    }
                  });
                  // Watch both the indicator and its parent container for class changes
                  observer.observe(indicator, { attributes: true, attributeFilter: ['class', 'style', 'aria-hidden'] });
                  if (indicator.parentElement) {
                    observer.observe(indicator.parentElement, { attributes: true, attributeFilter: ['class'] });
                  }
                  observedIndicators.add(indicator);
                  observedIndicatorsList.add(indicator);
                } catch {}
              }

              // Check current state using VEXA approach
              const hasOcclusion = hasVdiFrameOcclusion(indicator);
              const prevSpeaking = lastIndicatorStateById.get(participantId) === true;
              const now = Date.now();
              const lastTs = lastEventTsById.get(participantId) || 0;

              if (hasOcclusion && !prevSpeaking && (now - lastTs) > DEBOUNCE_MS) {
                console.log(`[Teams Speaker Indicator Poll] SPEAKER_START (vdi-occlusion): ${participantName}`);
                emitSpeakerEvent('SPEAKER_START', participantName, participantId);
                lastIndicatorStateById.set(participantId, true);
                lastEventTsById.set(participantId, now);
              } else if (!hasOcclusion && prevSpeaking && (now - lastTs) > DEBOUNCE_MS) {
                console.log(`[Teams Speaker Indicator Poll] SPEAKER_END (vdi-occlusion): ${participantName}`);
                emitSpeakerEvent('SPEAKER_END', participantName, participantId);
                lastIndicatorStateById.set(participantId, false);
                lastEventTsById.set(participantId, now);
              }
            });
          } catch (e) {
            console.error('[Teams Speaker] Voice indicator poll error:', e);
          }
        };

        // Mechanism 5: requestAnimationFrame loop for near real-time indicator sampling
        // VEXA APPROACH: Check for vdi-frame-occlusion class
        function fastIndicatorTick() {
          try {
            const now = Date.now();
            observedIndicatorsList.forEach((indicator) => {
              if (!indicator.isConnected) {
                observedIndicatorsList.delete(indicator);
                return;
              }
              const container = getContainerForIndicator(indicator);
              if (!container) return;
              const participantId = String(getTeamsParticipantId(container) || 'unknown');
              const participantName = String(getTeamsParticipantName(container) || participantId);

              // VEXA APPROACH: Check for vdi-frame-occlusion class (speaking indicator)
              const hasOcclusion = hasVdiFrameOcclusion(indicator);
              const wasSpeaking = lastIndicatorStateById.get(participantId) === true;
              const lastTs = lastEventTsById.get(participantId) || 0;

              if (hasOcclusion && !wasSpeaking && (now - lastTs) > DEBOUNCE_MS) {
                console.log(`[Teams Speaker RAF] SPEAKER_START (vdi-occlusion): ${participantName}`);
                emitSpeakerEvent('SPEAKER_START', participantName, participantId);
                lastIndicatorStateById.set(participantId, true);
                lastEventTsById.set(participantId, now);
              } else if (!hasOcclusion && wasSpeaking && (now - lastTs) > DEBOUNCE_MS) {
                console.log(`[Teams Speaker RAF] SPEAKER_END (vdi-occlusion): ${participantName}`);
                emitSpeakerEvent('SPEAKER_END', participantName, participantId);
                lastIndicatorStateById.set(participantId, false);
                lastEventTsById.set(participantId, now);
              }
            });
          } catch {}
          requestAnimationFrame(fastIndicatorTick);
        }

        // Initial scan for participants
        function scanForAllTeamsParticipants() {
          for (const selector of participantSelectors) {
            const participantElements = document.querySelectorAll(selector);
            for (let i = 0; i < participantElements.length; i++) {
              const el = participantElements[i];
              if (!el.dataset.vexaObserverAttached) {
                observeTeamsParticipant(el);
              }
            }
          }
        }

        // Monitor for new participants
        const bodyObserver = new MutationObserver((mutationsList) => {
          for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
              mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                  const elementNode = node;
                  for (const selector of participantSelectors) {
                    if (elementNode.matches && elementNode.matches(selector) && !elementNode.dataset.vexaObserverAttached) {
                      observeTeamsParticipant(elementNode);
                    }
                    const childElements = elementNode.querySelectorAll ? elementNode.querySelectorAll(selector) : [];
                    for (let i = 0; i < childElements.length; i++) {
                      const childEl = childElements[i];
                      if (!childEl.dataset.vexaObserverAttached) {
                        observeTeamsParticipant(childEl);
                      }
                    }
                  }
                }
              });
            }
          }
        });

        // Start all mechanisms
        console.log('[Teams Speaker] Starting 5-mechanism detection...');

        // 1. Initial scan and MutationObservers
        scanForAllTeamsParticipants();

        // 2. Body observer for new participants
        const meetingContainer = document.querySelector(meetingContainerSelectors[0]) || document.body;
        bodyObserver.observe(meetingContainer, { childList: true, subtree: true });

        // 3. Container polling (500ms)
        setInterval(pollTeamsActiveSpeakers, POLL_MS);

        // 4. Voice indicator polling (150ms)
        setInterval(pollTeamsVoiceIndicators, 150);

        // 5. requestAnimationFrame loop
        requestAnimationFrame(fastIndicatorTick);

        console.log('[Teams Speaker] All 5 mechanisms started');

        // Expose participant functions
        window.getTeamsActiveParticipantsCount = () => {
          let count = 0;
          for (const selector of participantSelectors) {
            count += document.querySelectorAll(selector).length;
          }
          return count;
        };

        window.getTeamsActiveParticipants = () => {
          const names = [];
          for (const selector of participantSelectors) {
            document.querySelectorAll(selector).forEach(el => {
              names.push(getTeamsParticipantName(el));
            });
          }
          return [...new Set(names)];
        };

        window.__teamsSpeakerDetectionActive = true;

      }, {
        participantSelectors: teamsParticipantSelectors,
        speakingClasses: teamsSpeakingClassNames,
        silenceClasses: teamsSilenceClassNames,
        containerSelectors: teamsParticipantContainerSelectors,
        nameSelectors: teamsNameSelectors,
        voiceLevelSelectors: teamsVoiceLevelSelectors,
        streamTypeSelectors: teamsStreamTypeSelectors,
        audioActivitySelectors: teamsAudioActivitySelectors,
        participantIdSelectors: teamsParticipantIdSelectors,
        meetingContainerSelectors: teamsMeetingContainerSelectors,
        occlusionSelectors: teamsOcclusionSelectors
      });

      // Listen for speaker events from the browser context
      await this.page.exposeFunction('__teamsSpeakerCallback', (eventType, participantName, participantId) => {
        if (this.onSpeakerChange) {
          this.onSpeakerChange(eventType, participantName, participantId);
        }
      });

      // Set up event listener in browser context
      await this.page.evaluate(() => {
        window.addEventListener('teamsSpeakerEvent', (event) => {
          const { eventType, participantName, participantId } = event.detail;
          window.__teamsSpeakerCallback(eventType, participantName, participantId);
        });
      });

      console.log('[Teams Speaker] Detection started successfully');

    } catch (error) {
      console.error('[Teams Speaker] Failed to start:', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Start polling - convenience method that starts detection with internal tracking
   * This is called by transcribeProcessor.initializeSpeakerDetection()
   */
  async startPolling() {
    console.log('[Teams Speaker] Starting polling mode with internal event tracking...');

    await this.start((eventType, participantName, participantId) => {
      const timestamp = Date.now();

      // Store event in history for later lookup
      this.speakerHistory.push({
        type: eventType,
        name: participantName,
        id: participantId,
        timestamp: timestamp
      });

      // Keep only last 5 minutes of history (300,000 ms)
      const cutoff = timestamp - 300000;
      while (this.speakerHistory.length > 0 && this.speakerHistory[0].timestamp < cutoff) {
        this.speakerHistory.shift();
      }

      // Update current speakers map
      if (eventType === 'SPEAKER_START') {
        this.currentSpeakers.set(participantId, {
          name: participantName,
          startTime: timestamp
        });
        this.lastSpeaker = participantName;
        console.log(`[Teams Speaker] 🗣️ Speaking: ${participantName} (tracking ${this.currentSpeakers.size} active speakers)`);
      } else if (eventType === 'SPEAKER_END') {
        this.currentSpeakers.delete(participantId);
        console.log(`[Teams Speaker] 🔇 Stopped: ${participantName} (tracking ${this.currentSpeakers.size} active speakers)`);
      }
    });
  }

  /**
   * Get the speaker at a specific timestamp
   * @param {number} absoluteTime - Absolute timestamp in milliseconds
   * @param {number} tolerance - Time tolerance in ms (default 5000ms)
   * @returns {string|null} - Speaker name or null if not found
   */
  getSpeakerAtTime(absoluteTime, tolerance = 5000) {
    // First check if anyone is currently speaking
    if (this.currentSpeakers.size > 0) {
      // Return the most recent speaker who started before this time
      let bestMatch = null;
      let closestTime = Infinity;

      for (const [id, info] of this.currentSpeakers) {
        const timeDiff = Math.abs(absoluteTime - info.startTime);
        if (timeDiff < closestTime) {
          closestTime = timeDiff;
          bestMatch = info.name;
        }
      }

      if (bestMatch) {
        return bestMatch;
      }
    }

    // Look through history for speakers active at this time
    // Build speaker activity intervals from events
    const speakerIntervals = new Map(); // participantId -> [{start, end, name}]

    for (const event of this.speakerHistory) {
      if (!speakerIntervals.has(event.id)) {
        speakerIntervals.set(event.id, []);
      }

      const intervals = speakerIntervals.get(event.id);

      if (event.type === 'SPEAKER_START') {
        intervals.push({ start: event.timestamp, end: null, name: event.name });
      } else if (event.type === 'SPEAKER_END') {
        // Find the most recent open interval and close it
        for (let i = intervals.length - 1; i >= 0; i--) {
          if (intervals[i].end === null) {
            intervals[i].end = event.timestamp;
            break;
          }
        }
      }
    }

    // Find speakers whose intervals overlap with the target time (with tolerance)
    const targetStart = absoluteTime - tolerance;
    const targetEnd = absoluteTime + tolerance;
    let bestSpeaker = null;
    let bestOverlap = 0;

    for (const [id, intervals] of speakerIntervals) {
      for (const interval of intervals) {
        const intervalEnd = interval.end || Date.now(); // Open intervals are still speaking

        // Check for overlap
        const overlapStart = Math.max(interval.start, targetStart);
        const overlapEnd = Math.min(intervalEnd, targetEnd);

        if (overlapStart < overlapEnd) {
          const overlap = overlapEnd - overlapStart;
          if (overlap > bestOverlap) {
            bestOverlap = overlap;
            bestSpeaker = interval.name;
          }
        }
      }
    }

    if (bestSpeaker) {
      return bestSpeaker;
    }

    // Fallback: return last known speaker if within tolerance
    if (this.lastSpeaker && this.speakerHistory.length > 0) {
      const lastEvent = this.speakerHistory[this.speakerHistory.length - 1];
      if (Math.abs(absoluteTime - lastEvent.timestamp) < tolerance * 2) {
        return this.lastSpeaker;
      }
    }

    return null;
  }

  /**
   * Stop speaker detection
   */
  async stop() {
    if (!this.isRunning) return;

    console.log('[Teams Speaker] Stopping detection...');
    this.isRunning = false;
    this.onSpeakerChange = null;
    this.speakerHistory = [];
    this.currentSpeakers.clear();

    try {
      await this.page.evaluate(() => {
        window.__teamsSpeakerDetectionActive = false;
      });
    } catch (e) {
      // Page might be closed
    }
  }

  /**
   * Get current participant count
   */
  async getParticipantCount() {
    try {
      return await this.page.evaluate(() => {
        if (typeof window.getTeamsActiveParticipantsCount === 'function') {
          return window.getTeamsActiveParticipantsCount();
        }
        return 0;
      });
    } catch {
      return 0;
    }
  }

  /**
   * Get current participant names
   */
  async getParticipants() {
    try {
      return await this.page.evaluate(() => {
        if (typeof window.getTeamsActiveParticipants === 'function') {
          return window.getTeamsActiveParticipants();
        }
        return [];
      });
    } catch {
      return [];
    }
  }
}

module.exports = { SpeakerDetector };
