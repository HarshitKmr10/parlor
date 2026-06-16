/**
 * Browser-Based Audio Capture Service
 * Captures audio directly from browser media elements using Web Audio API
 * Works for both Google Meet and MS Teams
 *
 * Uses the same pattern as vexa:
 * 1. Inject browser-audio-utils.js via addScriptTag (with CSP fallbacks)
 * 2. Find media elements with srcObject (WebRTC streams)
 * 3. Capture audio via Web Audio API (ScriptProcessorNode)
 * 4. Collect chunks and send to transcription provider (OpenAI, etc.)
 */

const fs = require('fs');
const path = require('path');

// Path to the browser utils script
const BROWSER_UTILS_PATH = path.join(__dirname, 'browser-audio-utils.js');

/**
 * Ensure browser utils are loaded in the page
 * Uses the same robust injection pattern as vexa
 * @param {Page} page - Playwright or Puppeteer page
 */
async function ensureBrowserUtils(page) {
  // Check if already loaded
  const alreadyLoaded = await page.evaluate(() => !!window.BrowserAudioUtils);
  if (alreadyLoaded) {
    console.log('[BrowserAudio] Browser utils already loaded');
    return true;
  }

  // Try simple addScriptTag first (works when bypassCSP is true)
  try {
    console.log('[BrowserAudio] Trying addScriptTag with path...');
    await page.addScriptTag({ path: BROWSER_UTILS_PATH });
    const ok = await page.evaluate(() => !!window.BrowserAudioUtils);
    if (ok) {
      console.log('[BrowserAudio] Browser utils loaded via addScriptTag');
      return true;
    }
  } catch (e) {
    console.log(`[BrowserAudio] addScriptTag failed: ${e.message}`);
  }

  // Fallback: Read file and inject via evaluate with Trusted Types / Blob URL
  try {
    console.log('[BrowserAudio] Trying fallback injection...');
    const scriptContent = fs.readFileSync(BROWSER_UTILS_PATH, 'utf8');

    await page.evaluate(async (script) => {
      // Try Trusted Types first
      const injectWithTrustedTypes = () => {
        const factory = window.trustedTypes;
        if (!factory || typeof factory.createPolicy !== 'function') {
          return Promise.reject(new Error('Trusted Types not available'));
        }
        const policy = factory.createPolicy('browserAudioPolicy', {
          createScript: (s) => s,
          createScriptURL: (s) => s
        });
        const scriptEl = document.createElement('script');
        scriptEl.text = policy.createScript(script);
        document.head.appendChild(scriptEl);
        return Promise.resolve();
      };

      // Fallback to Blob URL
      const injectWithBlobUrl = () => new Promise((resolve, reject) => {
        try {
          const blob = new Blob([script], { type: 'text/javascript' });
          const url = URL.createObjectURL(blob);
          let finalUrl = url;

          // Try to wrap with Trusted Types if available
          try {
            const factory = window.trustedTypes;
            if (factory && typeof factory.createPolicy === 'function') {
              const policy = factory.createPolicy('browserAudioPolicy', {
                createScriptURL: (u) => u
              });
              if (policy && typeof policy.createScriptURL === 'function') {
                finalUrl = policy.createScriptURL(url);
              }
            }
          } catch (_) {
            finalUrl = url; // fallback to plain blob URL
          }

          const scriptEl = document.createElement('script');
          scriptEl.src = finalUrl;
          scriptEl.onload = () => resolve();
          scriptEl.onerror = () => reject(new Error('Failed to load browser utils via blob URL'));
          document.head.appendChild(scriptEl);
        } catch (err) {
          reject(err);
        }
      });

      return injectWithTrustedTypes().catch(() => injectWithBlobUrl());
    }, scriptContent);

    const loaded = await page.evaluate(() => !!window.BrowserAudioUtils);
    if (loaded) {
      console.log('[BrowserAudio] Browser utils loaded via fallback injection');
      return true;
    }
  } catch (e) {
    console.error(`[BrowserAudio] Fallback injection failed: ${e.message}`);
  }

  // Final check
  const finalCheck = await page.evaluate(() => !!window.BrowserAudioUtils);
  if (!finalCheck) {
    console.error('[BrowserAudio] BrowserAudioUtils global is missing after all injection attempts');
    return false;
  }

  return true;
}

/**
 * Initialize browser audio capture
 * Sets up the audio service and starts collecting chunks
 * @param {Page} page - Playwright or Puppeteer page
 * @param {Object} options - Configuration options
 * @returns {Promise<boolean>} - Whether initialization succeeded
 */
async function injectBrowserAudioCapture(page, options = {}) {
  const {
    chunkDurationMs = 10000, // 10 seconds default
    targetSampleRate = 16000,
    bufferSize = 4096
  } = options;

  console.log('[BrowserAudio] Initializing browser audio capture...');
  console.log(`[BrowserAudio] Options: chunkDurationMs=${chunkDurationMs}, targetSampleRate=${targetSampleRate}, bufferSize=${bufferSize}`);

  // Set up console listener to capture browser logs
  try {
    if (page.on) {
      page.on('console', msg => {
        const text = typeof msg.text === 'function' ? msg.text() : String(msg);
        if (text.includes('[BrowserAudio]')) {
          console.log(`[BrowserAudio Browser] ${text}`);
        }
      });
    }
  } catch (e) {
    // Console listening not available
  }

  // Ensure browser utils are loaded
  const utilsLoaded = await ensureBrowserUtils(page);
  if (!utilsLoaded) {
    console.error('[BrowserAudio] Failed to load browser utils');
    return false;
  }

  // Initialize the audio capture in browser context
  try {
    const result = await page.evaluate(async (config) => {
      const { chunkDurationMs, targetSampleRate, bufferSize } = config;

      if (!window.BrowserAudioUtils) {
        window.logBot('ERROR: BrowserAudioUtils not available');
        return { success: false, error: 'BrowserAudioUtils not available' };
      }

      // Create audio service
      const audioService = new window.BrowserAudioUtils.BrowserAudioService({
        targetSampleRate: targetSampleRate,
        bufferSize: bufferSize,
        inputChannels: 1,
        outputChannels: 1
      });

      // Store for later access
      window.__browserAudioService = audioService;
      window.__browserAudioChunks = [];
      window.__browserChunkStartTime = Date.now();
      window.__browserReadyChunk = null;
      window.__browserChunkDurationMs = chunkDurationMs;

      try {
        // Find media elements
        window.logBot('Finding media elements...');
        const mediaElements = await audioService.findMediaElements(15, 2000);

        if (mediaElements.length === 0) {
          window.logBot('ERROR: No active media elements found');
          return { success: false, error: 'No active media elements found' };
        }

        // Create combined audio stream
        window.logBot('Creating combined audio stream...');
        const combinedStream = await audioService.createCombinedAudioStream(mediaElements);

        if (!combinedStream) {
          window.logBot('ERROR: Failed to create combined audio stream');
          return { success: false, error: 'Failed to create combined audio stream' };
        }

        // Initialize audio processor
        window.logBot('Initializing audio processor...');
        await audioService.initializeAudioProcessor(combinedStream);

        // Set up audio data collection
        audioService.setupAudioDataProcessor(function(audioData, sessionStartTime) {
          // Convert Float32Array to Int16Array for WAV
          var int16Data = new Int16Array(audioData.length);
          for (var i = 0; i < audioData.length; i++) {
            var s = Math.max(-1, Math.min(1, audioData[i]));
            int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }

          // Add to current chunk buffer
          window.__browserAudioChunks.push(int16Data);

          // Check if we should create a chunk
          var elapsed = Date.now() - window.__browserChunkStartTime;
          if (elapsed >= window.__browserChunkDurationMs) {
            // Combine all buffers into one
            var totalLength = window.__browserAudioChunks.reduce(function(sum, chunk) {
              return sum + chunk.length;
            }, 0);

            if (totalLength > 0) {
              var combinedBuffer = new Int16Array(totalLength);
              var offset = 0;
              for (var i = 0; i < window.__browserAudioChunks.length; i++) {
                combinedBuffer.set(window.__browserAudioChunks[i], offset);
                offset += window.__browserAudioChunks[i].length;
              }

              // Store for retrieval by Node.js
              window.__browserReadyChunk = {
                data: Array.from(combinedBuffer),
                timestamp: window.__browserChunkStartTime,
                duration: elapsed,
                sessionStartTime: sessionStartTime
              };

              window.logBot('Audio chunk ready: ' + totalLength + ' samples, ' + elapsed + 'ms');
            }

            // Reset for next chunk
            window.__browserAudioChunks = [];
            window.__browserChunkStartTime = Date.now();
          }
        });

        window.__browserAudioInitialized = true;
        window.logBot('Browser audio capture initialized successfully');
        return { success: true };

      } catch (err) {
        window.logBot('Audio capture error: ' + err.message);
        return { success: false, error: err.message };
      }
    }, { chunkDurationMs, targetSampleRate, bufferSize });

    if (result && result.success) {
      console.log('[BrowserAudio] Audio capture initialized successfully');
      return true;
    } else {
      console.error(`[BrowserAudio] Audio capture failed: ${result?.error || 'Unknown error'}`);
      return false;
    }
  } catch (e) {
    console.error(`[BrowserAudio] Failed to initialize audio capture: ${e.message}`);
    return false;
  }
}

/**
 * Retrieve ready audio chunk from browser
 * @param {Page} page - Playwright or Puppeteer page
 * @returns {Promise<Object|null>} - Audio chunk data or null
 */
async function getReadyChunk(page) {
  try {
    const chunk = await page.evaluate(() => {
      const readyChunk = window.__browserReadyChunk;
      if (readyChunk) {
        window.__browserReadyChunk = null; // Clear it
        return readyChunk;
      }
      return null;
    });
    return chunk;
  } catch (e) {
    return null;
  }
}

/**
 * Get any remaining audio data (for cleanup)
 * @param {Page} page - Playwright or Puppeteer page
 * @returns {Promise<Object|null>} - Audio chunk data or null
 */
async function getFinalChunk(page) {
  try {
    const chunk = await page.evaluate(() => {
      // Force save any remaining audio
      if (window.__browserAudioChunks && window.__browserAudioChunks.length > 0) {
        var totalLength = window.__browserAudioChunks.reduce(function(sum, chunk) {
          return sum + chunk.length;
        }, 0);

        if (totalLength > 0) {
          var combinedBuffer = new Int16Array(totalLength);
          var offset = 0;
          for (var i = 0; i < window.__browserAudioChunks.length; i++) {
            combinedBuffer.set(window.__browserAudioChunks[i], offset);
            offset += window.__browserAudioChunks[i].length;
          }
          window.__browserAudioChunks = [];

          return {
            data: Array.from(combinedBuffer),
            timestamp: window.__browserChunkStartTime || Date.now(),
            duration: Date.now() - (window.__browserChunkStartTime || Date.now()),
            sessionStartTime: window.__browserAudioService?.getSessionAudioStartTime() || Date.now()
          };
        }
      }
      return null;
    });
    return chunk;
  } catch (e) {
    return null;
  }
}

/**
 * Stop browser audio capture and cleanup
 * @param {Page} page - Playwright or Puppeteer page
 */
async function stopBrowserAudioCapture(page) {
  try {
    await page.evaluate(() => {
      if (window.__browserAudioService) {
        window.__browserAudioService.disconnect();
        window.__browserAudioService = null;
      }
      window.__browserAudioInitialized = false;
      window.__browserAudioChunks = [];
      window.__browserReadyChunk = null;
      window.logBot && window.logBot('Audio capture stopped');
    });
    console.log('[BrowserAudio] Browser audio capture stopped');
  } catch (e) {
    console.log(`[BrowserAudio] Could not stop browser audio: ${e.message}`);
  }
}

/**
 * Write Int16Array audio data to a WAV file
 * @param {string} filePath - Output file path
 * @param {Int16Array} int16Data - Audio data
 * @param {number} sampleRate - Sample rate (default 16000)
 */
function writeWavFile(filePath, int16Data, sampleRate = 16000) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = int16Data.length * 2; // 2 bytes per sample
  const fileSize = 44 + dataSize;

  const buffer = Buffer.alloc(fileSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(fileSize - 8, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // audio format (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write audio data
  for (let i = 0; i < int16Data.length; i++) {
    buffer.writeInt16LE(int16Data[i], 44 + i * 2);
  }

  fs.writeFileSync(filePath, buffer);
}

/**
 * Check if browser audio capture is initialized
 * @param {Page} page - Playwright or Puppeteer page
 * @returns {Promise<boolean>}
 */
async function isInitialized(page) {
  try {
    return await page.evaluate(() => window.__browserAudioInitialized === true);
  } catch (e) {
    return false;
  }
}

module.exports = {
  injectBrowserAudioCapture,
  getReadyChunk,
  getFinalChunk,
  stopBrowserAudioCapture,
  writeWavFile,
  isInitialized,
  ensureBrowserUtils
};
