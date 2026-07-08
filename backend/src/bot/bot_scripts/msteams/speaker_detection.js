/**
 * Speaker detection for MS Teams meetings.
 *
 * Teams does not expose a public "who is speaking" API, so this module
 * infers it from the meeting DOM using several independent, redundant
 * signals — MutationObserver callbacks, timed polling, and a
 * requestAnimationFrame loop — so that a signal missed by one mechanism
 * (e.g. a mutation that lands between two poll ticks) is still caught by
 * another. The redundancy matters because Teams applies these DOM changes
 * outside of any event we can `await`.
 *
 * Core observation from testing against the live Teams web client: each
 * participant tile that has an active audio route renders a
 * `[data-tid="voice-level-stream-outline"]` element. While that
 * participant is actively producing audio energy above Teams' internal
 * threshold, the element (or one of its ancestors, depending on layout)
 * additionally carries the `.vdi-frame-occlusion` class — an overlay
 * Teams paints over the voice-level ring while it's animating. In other
 * words: voice-level element present + `.vdi-frame-occlusion` class
 * present = the participant is currently speaking. This is a factual
 * property of Teams' rendering, confirmed by watching the class toggle in
 * real time against known-speaking participants; it is not tied to any
 * particular implementation of the observer that watches for it.
 */

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

// The occlusion overlay class Teams applies to a voice-level indicator
// while the corresponding participant is silent (see module docstring).
const OCCLUSION_CLASS = 'vdi-frame-occlusion';

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
   * Start speaker detection: scan for participant tiles, then keep them
   * (and any that appear later) under watch using a combination of
   * change-driven and time-driven checks.
   * @param {Function} onSpeakerChange - Callback for speaker changes: (eventType, participantName, participantId) => void
   */
  async start(onSpeakerChange) {
    if (this.isRunning) {
      console.log('[Teams Speaker] Already running');
      return;
    }

    this.isRunning = true;
    this.onSpeakerChange = onSpeakerChange;

    console.log('[Teams Speaker] Starting speaker detection...');

    try {
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
          occlusionClass
        } = config;

        const classBasedSpeakingState = new Map();
        const containerPollState = new Map();
        const indicatorState = new Map();
        const indicatorEventTimestamps = new Map();
        const trackedIndicators = new WeakSet();
        const trackedIndicatorList = new Set();
        const DEBOUNCE_MS = 300;
        const CONTAINER_POLL_MS = 500;
        const INDICATOR_POLL_MS = 150;

        function resolveParticipantId(element) {
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
            if (!element.dataset.synthesizedParticipantId) {
              element.dataset.synthesizedParticipantId = 'teams-id-' + Math.random().toString(36).substr(2, 9);
            }
            id = element.dataset.synthesizedParticipantId;
          }

          return id;
        }

        function resolveParticipantName(participantElement) {
          for (const selector of nameSelectors) {
            const nameElement = participantElement.querySelector(selector);
            if (nameElement) {
              let nameText = nameElement.textContent ||
                            nameElement.innerText ||
                            nameElement.getAttribute('title') ||
                            nameElement.getAttribute('aria-label');

              if (nameText && nameText.trim()) {
                nameText = nameText.trim();

                const controlLabelSubstrings = [
                  "more_vert", "mic_off", "mic", "videocam", "videocam_off",
                  "present_to_all", "devices", "speaker", "speakers", "microphone",
                  "camera", "camera_off", "share", "chat", "participant", "user"
                ];

                if (!controlLabelSubstrings.some(sub => nameText.toLowerCase().includes(sub.toLowerCase()))) {
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

          const idToDisplay = resolveParticipantId(participantElement);
          return `Teams Participant (${idToDisplay})`;
        }

        function isRendered(el) {
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

        // See module docstring: this class, present on the voice-level
        // element or an ancestor, marks the participant as SPEAKING (it
        // is an overlay Teams paints over the voice-level ring while the
        // ring is actively animating).
        function hasOcclusionOverlay(el) {
          let current = el;
          while (current) {
            if (current.classList && current.classList.contains(occlusionClass)) {
              return true;
            }
            current = current.parentElement;
          }
          return false;
        }

        function emitSpeakerEvent(eventType, participantName, participantId) {
          const event = new CustomEvent('teamsSpeakerEvent', {
            detail: { eventType, participantName, participantId, timestamp: Date.now() }
          });
          window.dispatchEvent(event);
        }

        function isContainerSpeaking(containerEl) {
          const vSel = voiceLevelSelectors[0];
          const voiceLevel = vSel ? containerEl.querySelector(vSel) : null;

          if (!voiceLevel) {
            return false;
          }

          if (hasOcclusionOverlay(voiceLevel)) {
            return true;
          }

          if (!isRendered(voiceLevel)) {
            return true;
          }

          if (audioActivitySelectors.length > 0) {
            const anyInd = containerEl.querySelector(audioActivitySelectors.join(', '));
            if (anyInd && isRendered(anyInd)) {
              return true;
            }
          }

          return false;
        }

        function resolveIndicatorContainer(indicator) {
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

        function collectSameOriginDocuments() {
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

        // Change-driven check #1: watch class attribute mutations on a
        // participant tile directly. Cheap once attached, and catches
        // speaking-class toggles the instant they happen.
        function watchParticipantClassChanges(participantElement) {
          const participantId = resolveParticipantId(participantElement);
          const participantName = resolveParticipantName(participantElement);

          classBasedSpeakingState.set(participantId, 'silent');

          console.log(`[Teams Speaker] Observing: ${participantName} (ID: ${participantId})`);

          const callback = function(mutationsList) {
            for (const mutation of mutationsList) {
              if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const targetElement = mutation.target;
                if (participantElement.contains(targetElement)) {
                  const voiceLevelElement = participantElement.querySelector(voiceLevelSelectors[0]);
                  const hasVoiceLevelElement = !!voiceLevelElement;
                  const isVoiceLevelVisible = hasVoiceLevelElement && isRendered(voiceLevelElement);

                  const matchesSpeakingClass = speakingClasses.some(cls => targetElement.classList.contains(cls));
                  const matchesSilenceClass = silenceClasses.some(cls => targetElement.classList.contains(cls));

                  let isCurrentlySpeaking = false;
                  if (hasVoiceLevelElement) {
                    isCurrentlySpeaking = !isVoiceLevelVisible || matchesSpeakingClass;
                  } else {
                    isCurrentlySpeaking = matchesSpeakingClass && !matchesSilenceClass;
                  }

                  const previousState = classBasedSpeakingState.get(participantId) || 'silent';

                  if (isCurrentlySpeaking && previousState !== 'speaking') {
                    console.log(`[Teams Speaker] SPEAKER_START: ${participantName}`);
                    emitSpeakerEvent('SPEAKER_START', participantName, participantId);
                    classBasedSpeakingState.set(participantId, 'speaking');
                  } else if (!isCurrentlySpeaking && previousState === 'speaking') {
                    console.log(`[Teams Speaker] SPEAKER_END: ${participantName}`);
                    emitSpeakerEvent('SPEAKER_END', participantName, participantId);
                    classBasedSpeakingState.set(participantId, 'silent');
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

          participantElement.dataset.twinSpeakerObserverBound = 'true';
        }

        // Time-driven check #1: sweep known participant containers every
        // CONTAINER_POLL_MS and diff the speaking state. Backstops the
        // mutation observer for any container whose relevant class change
        // doesn't bubble through the watched subtree.
        function pollContainers() {
          try {
            const containers = [];
            for (const sel of containerSelectors) {
              document.querySelectorAll(sel).forEach((el) => containers.push(el));
            }

            containers.forEach((container) => {
              const participantId = String(resolveParticipantId(container) || 'unknown');
              const participantName = String(resolveParticipantName(container) || participantId);
              const speaking = isContainerSpeaking(container);
              const prev = containerPollState.get(participantId) || 'silent';

              if (speaking && prev !== 'speaking') {
                console.log(`[Teams Speaker Poll] SPEAKER_START: ${participantName}`);
                emitSpeakerEvent('SPEAKER_START', participantName, participantId);
                containerPollState.set(participantId, 'speaking');
              } else if (!speaking && prev === 'speaking') {
                console.log(`[Teams Speaker Poll] SPEAKER_END: ${participantName}`);
                emitSpeakerEvent('SPEAKER_END', participantName, participantId);
                containerPollState.set(participantId, 'silent');
              } else if (!containerPollState.has(participantId)) {
                containerPollState.set(participantId, speaking ? 'speaking' : 'silent');
              }
            });
          } catch (e) {
            console.error('[Teams Speaker] Container poll error:', e);
          }
        }

        function reportIndicatorTransition(participantId, participantName, hasOcclusion, source) {
          const wasSpeaking = indicatorState.get(participantId) === true;
          const now = Date.now();
          const lastTs = indicatorEventTimestamps.get(participantId) || 0;
          if ((now - lastTs) < DEBOUNCE_MS) return;

          const speaking = hasOcclusion;
          if (speaking && !wasSpeaking) {
            console.log(`[Teams Speaker ${source}] SPEAKER_START: ${participantName}`);
            emitSpeakerEvent('SPEAKER_START', participantName, participantId);
            indicatorState.set(participantId, true);
            indicatorEventTimestamps.set(participantId, now);
          } else if (!speaking && wasSpeaking) {
            console.log(`[Teams Speaker ${source}] SPEAKER_END: ${participantName}`);
            emitSpeakerEvent('SPEAKER_END', participantName, participantId);
            indicatorState.set(participantId, false);
            indicatorEventTimestamps.set(participantId, now);
          }
        }

        // Time-driven check #2 + change-driven check #2: find every
        // voice-level indicator (including inside same-origin iframes),
        // attach a targeted mutation observer to each one the first time
        // it's seen, and also evaluate its current state every
        // INDICATOR_POLL_MS in case the observer's attribute filter
        // misses a compound style/class change.
        function pollAndObserveIndicators() {
          try {
            const vSel = voiceLevelSelectors[0];
            if (!vSel) return;
            const allDocs = collectSameOriginDocuments();
            const indicators = [];
            for (const d of allDocs) {
              d.querySelectorAll(vSel).forEach(el => indicators.push(el));
            }

            indicators.forEach((indicator) => {
              const container = resolveIndicatorContainer(indicator);
              if (!container) return;
              const participantId = String(resolveParticipantId(container) || 'unknown');
              const participantName = String(resolveParticipantName(container) || participantId);

              if (!trackedIndicators.has(indicator)) {
                try {
                  const observer = new MutationObserver(() => {
                    reportIndicatorTransition(
                      participantId,
                      participantName,
                      hasOcclusionOverlay(indicator),
                      'Indicator'
                    );
                  });
                  observer.observe(indicator, { attributes: true, attributeFilter: ['class', 'style', 'aria-hidden'] });
                  if (indicator.parentElement) {
                    observer.observe(indicator.parentElement, { attributes: true, attributeFilter: ['class'] });
                  }
                  trackedIndicators.add(indicator);
                  trackedIndicatorList.add(indicator);
                } catch {}
              }

              reportIndicatorTransition(
                participantId,
                participantName,
                hasOcclusionOverlay(indicator),
                'Indicator Poll'
              );
            });
          } catch (e) {
            console.error('[Teams Speaker] Voice indicator poll error:', e);
          }
        }

        // Time-driven check #3: a requestAnimationFrame loop over already
        // tracked indicators for near-real-time sampling between the two
        // slower polls above.
        function tickTrackedIndicators() {
          try {
            trackedIndicatorList.forEach((indicator) => {
              if (!indicator.isConnected) {
                trackedIndicatorList.delete(indicator);
                return;
              }
              const container = resolveIndicatorContainer(indicator);
              if (!container) return;
              const participantId = String(resolveParticipantId(container) || 'unknown');
              const participantName = String(resolveParticipantName(container) || participantId);

              reportIndicatorTransition(
                participantId,
                participantName,
                hasOcclusionOverlay(indicator),
                'RAF'
              );
            });
          } catch {}
          requestAnimationFrame(tickTrackedIndicators);
        }

        function scanForParticipants() {
          for (const selector of participantSelectors) {
            const participantElements = document.querySelectorAll(selector);
            for (let i = 0; i < participantElements.length; i++) {
              const el = participantElements[i];
              if (!el.dataset.twinSpeakerObserverBound) {
                watchParticipantClassChanges(el);
              }
            }
          }
        }

        // Change-driven check #3: watch the meeting container for newly
        // added participant tiles (gallery reflow, late joiners, view
        // switches) and attach the same per-tile observer to each.
        const containerObserver = new MutationObserver((mutationsList) => {
          for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
              mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                  const elementNode = node;
                  for (const selector of participantSelectors) {
                    if (elementNode.matches && elementNode.matches(selector) && !elementNode.dataset.twinSpeakerObserverBound) {
                      watchParticipantClassChanges(elementNode);
                    }
                    const childElements = elementNode.querySelectorAll ? elementNode.querySelectorAll(selector) : [];
                    for (let i = 0; i < childElements.length; i++) {
                      const childEl = childElements[i];
                      if (!childEl.dataset.twinSpeakerObserverBound) {
                        watchParticipantClassChanges(childEl);
                      }
                    }
                  }
                }
              });
            }
          }
        });

        console.log('[Teams Speaker] Starting detection (class-mutation + container poll + indicator poll/observer + RAF)...');

        scanForParticipants();

        const meetingContainer = document.querySelector(meetingContainerSelectors[0]) || document.body;
        containerObserver.observe(meetingContainer, { childList: true, subtree: true });

        setInterval(pollContainers, CONTAINER_POLL_MS);
        setInterval(pollAndObserveIndicators, INDICATOR_POLL_MS);
        requestAnimationFrame(tickTrackedIndicators);

        console.log('[Teams Speaker] All detection mechanisms started');

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
              names.push(resolveParticipantName(el));
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
        occlusionClass: OCCLUSION_CLASS
      });

      await this.page.exposeFunction('__teamsSpeakerCallback', (eventType, participantName, participantId) => {
        if (this.onSpeakerChange) {
          this.onSpeakerChange(eventType, participantName, participantId);
        }
      });

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

      this.speakerHistory.push({
        type: eventType,
        name: participantName,
        id: participantId,
        timestamp: timestamp
      });

      const cutoff = timestamp - 300000;
      while (this.speakerHistory.length > 0 && this.speakerHistory[0].timestamp < cutoff) {
        this.speakerHistory.shift();
      }

      if (eventType === 'SPEAKER_START') {
        this.currentSpeakers.set(participantId, {
          name: participantName,
          startTime: timestamp
        });
        this.lastSpeaker = participantName;
        console.log(`[Teams Speaker] Speaking: ${participantName} (tracking ${this.currentSpeakers.size} active speakers)`);
      } else if (eventType === 'SPEAKER_END') {
        this.currentSpeakers.delete(participantId);
        console.log(`[Teams Speaker] Stopped: ${participantName} (tracking ${this.currentSpeakers.size} active speakers)`);
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
    if (this.currentSpeakers.size > 0) {
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

    const speakerIntervals = new Map();

    for (const event of this.speakerHistory) {
      if (!speakerIntervals.has(event.id)) {
        speakerIntervals.set(event.id, []);
      }

      const intervals = speakerIntervals.get(event.id);

      if (event.type === 'SPEAKER_START') {
        intervals.push({ start: event.timestamp, end: null, name: event.name });
      } else if (event.type === 'SPEAKER_END') {
        for (let i = intervals.length - 1; i >= 0; i--) {
          if (intervals[i].end === null) {
            intervals[i].end = event.timestamp;
            break;
          }
        }
      }
    }

    const targetStart = absoluteTime - tolerance;
    const targetEnd = absoluteTime + tolerance;
    let bestSpeaker = null;
    let bestOverlap = 0;

    for (const [id, intervals] of speakerIntervals) {
      for (const interval of intervals) {
        const intervalEnd = interval.end || Date.now();

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
