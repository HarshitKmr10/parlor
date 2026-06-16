/**
 * Web Audio API-based audio capture for Teams meetings
 *
 * This module captures audio directly from the Teams <audio> element's MediaStream
 * using the Web Audio API (AudioContext, ScriptProcessorNode).
 *
 * This approach bypasses puppeteer-stream which requires chrome.tabCapture API
 * (only available in Chrome extensions).
 *
 * Based on Vexa's proven implementation pattern.
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

/**
 * Initialize Web Audio capture in the browser context
 * This injects the necessary JavaScript to capture audio from the <audio> element
 *
 * @param {Page} page - Puppeteer page object
 * @param {Object} options - Configuration options
 * @returns {Promise<boolean>} - Whether initialization was successful
 */
async function initializeWebAudioCapture(page, options = {}) {
  const {
    sampleRate = 16000,
    bufferSize = 4096,
    channels = 1
  } = options;

  console.log('🎤 Initializing Web Audio capture...');

  const result = await page.evaluate(async (config) => {
    try {
      // Find audio element with active MediaStream
      const findActiveAudioElement = () => {
        const audioElements = document.querySelectorAll('audio');
        for (const audio of audioElements) {
          if (audio.srcObject && audio.srcObject instanceof MediaStream) {
            const stream = audio.srcObject;
            if (stream.active && stream.getAudioTracks().length > 0) {
              return audio;
            }
          }
        }
        return null;
      };

      const audioElement = findActiveAudioElement();
      if (!audioElement) {
        return { success: false, error: 'No active audio element found' };
      }

      const stream = audioElement.srcObject;
      const audioTracks = stream.getAudioTracks();

      console.log('[WebAudio] Found audio stream:', stream.id);
      console.log('[WebAudio] Audio tracks:', audioTracks.length);

      // Log track settings for debugging
      audioTracks.forEach((track, i) => {
        const settings = track.getSettings ? track.getSettings() : {};
        console.log(`[WebAudio] Track ${i} settings:`, JSON.stringify(settings));
        console.log(`[WebAudio] Track ${i} enabled:`, track.enabled, 'readyState:', track.readyState);
      });

      // Create AudioContext - use native sample rate to avoid resampling issues
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      // First create with default to get native sample rate
      const tempContext = new AudioContextClass();
      const nativeSampleRate = tempContext.sampleRate;
      tempContext.close();

      // Use config sample rate but log if different from native
      const targetSampleRate = config.sampleRate;
      console.log(`[WebAudio] Native sample rate: ${nativeSampleRate}, Target: ${targetSampleRate}`);

      window.__teamsAudioContext = new AudioContextClass({ sampleRate: targetSampleRate });
      console.log(`[WebAudio] AudioContext created with sample rate: ${window.__teamsAudioContext.sampleRate}`);

      // Resume if suspended
      if (window.__teamsAudioContext.state === 'suspended') {
        await window.__teamsAudioContext.resume();
        console.log('[WebAudio] AudioContext resumed from suspended state');
      }

      // Create MediaStreamSource from the audio element's stream
      window.__teamsAudioSource = window.__teamsAudioContext.createMediaStreamSource(stream);

      // Create ScriptProcessorNode for audio processing
      // Note: ScriptProcessorNode is deprecated but still widely supported
      // and works better than AudioWorklet for this use case
      window.__teamsAudioProcessor = window.__teamsAudioContext.createScriptProcessor(
        config.bufferSize,
        config.channels,
        config.channels
      );

      // Audio buffer to store captured data
      window.__teamsAudioBuffer = [];
      window.__teamsAudioBufferSize = 0;
      window.__teamsAudioMaxBufferSize = config.sampleRate * 10; // 10 seconds of audio
      window.__teamsAudioCapturing = true;
      window.__teamsAudioStats = {
        totalSamples: 0,
        nonZeroSamples: 0,
        maxAmplitude: 0,
        processCount: 0
      };

      // Process audio data
      window.__teamsAudioProcessor.onaudioprocess = (event) => {
        if (!window.__teamsAudioCapturing) return;

        const inputData = event.inputBuffer.getChannelData(0);

        // Track audio statistics for debugging
        window.__teamsAudioStats.processCount++;
        let chunkNonZero = 0;
        let chunkMax = 0;

        // Convert Float32Array to Int16Array for WAV format
        const int16Data = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;

          // Track non-zero samples and max amplitude
          if (Math.abs(inputData[i]) > 0.001) {
            chunkNonZero++;
          }
          if (Math.abs(inputData[i]) > chunkMax) {
            chunkMax = Math.abs(inputData[i]);
          }
        }

        window.__teamsAudioStats.totalSamples += inputData.length;
        window.__teamsAudioStats.nonZeroSamples += chunkNonZero;
        if (chunkMax > window.__teamsAudioStats.maxAmplitude) {
          window.__teamsAudioStats.maxAmplitude = chunkMax;
        }

        // Log periodically (every 100 process events)
        if (window.__teamsAudioStats.processCount % 100 === 0) {
          const nonZeroPercent = ((window.__teamsAudioStats.nonZeroSamples / window.__teamsAudioStats.totalSamples) * 100).toFixed(1);
          console.log(`[WebAudio Stats] Processed: ${window.__teamsAudioStats.processCount}, Non-zero: ${nonZeroPercent}%, Max amplitude: ${window.__teamsAudioStats.maxAmplitude.toFixed(4)}`);
        }

        window.__teamsAudioBuffer.push(int16Data);
        window.__teamsAudioBufferSize += int16Data.length;

        // Trim buffer if too large (keep last 10 seconds)
        while (window.__teamsAudioBufferSize > window.__teamsAudioMaxBufferSize && window.__teamsAudioBuffer.length > 0) {
          const removed = window.__teamsAudioBuffer.shift();
          window.__teamsAudioBufferSize -= removed.length;
        }
      };

      // Connect the nodes
      window.__teamsAudioSource.connect(window.__teamsAudioProcessor);
      window.__teamsAudioProcessor.connect(window.__teamsAudioContext.destination);

      return {
        success: true,
        streamId: stream.id,
        sampleRate: window.__teamsAudioContext.sampleRate,
        audioTracks: audioTracks.map(t => ({
          id: t.id,
          label: t.label,
          enabled: t.enabled,
          readyState: t.readyState
        }))
      };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }, { sampleRate, bufferSize, channels });

  if (result.success) {
    console.log('✅ Web Audio capture initialized successfully');
    console.log(`   Sample rate: ${result.sampleRate} Hz`);
    console.log(`   Stream ID: ${result.streamId}`);
    console.log(`   Audio tracks: ${result.audioTracks.length}`);
  } else {
    console.error('❌ Web Audio capture initialization failed:', result.error);
  }

  return result.success;
}

/**
 * Get captured audio data and clear the buffer
 *
 * @param {Page} page - Puppeteer page object
 * @returns {Promise<{samples: number[], sampleRate: number} | null>}
 */
async function getAudioBuffer(page) {
  const result = await page.evaluate(() => {
    if (!window.__teamsAudioBuffer || window.__teamsAudioBuffer.length === 0) {
      return null;
    }

    // Combine all buffers into one
    const totalLength = window.__teamsAudioBuffer.reduce((sum, buf) => sum + buf.length, 0);
    const combined = new Int16Array(totalLength);

    let offset = 0;
    for (const buffer of window.__teamsAudioBuffer) {
      combined.set(buffer, offset);
      offset += buffer.length;
    }

    // Clear the buffer
    window.__teamsAudioBuffer = [];
    window.__teamsAudioBufferSize = 0;

    // Convert Int16Array to regular array for transfer
    return {
      samples: Array.from(combined),
      sampleRate: window.__teamsAudioContext?.sampleRate || 16000
    };
  });

  return result;
}

/**
 * Write audio samples to a WAV file
 *
 * @param {number[]} samples - Int16 audio samples
 * @param {number} sampleRate - Sample rate in Hz
 * @param {string} outputPath - Output file path
 */
function writeWavFile(samples, sampleRate, outputPath) {
  const buffer = Buffer.alloc(44 + samples.length * 2);

  // WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size
  buffer.writeUInt16LE(1, 20); // AudioFormat (PCM)
  buffer.writeUInt16LE(1, 22); // NumChannels
  buffer.writeUInt32LE(sampleRate, 24); // SampleRate
  buffer.writeUInt32LE(sampleRate * 2, 28); // ByteRate
  buffer.writeUInt16LE(2, 32); // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples.length * 2, 40);

  // Audio data
  for (let i = 0; i < samples.length; i++) {
    buffer.writeInt16LE(samples[i], 44 + i * 2);
  }

  fs.writeFileSync(outputPath, buffer);
}

/**
 * Start continuous audio capture with chunk generation
 * This captures audio and periodically saves it to WAV files for transcription
 *
 * @param {Page} page - Puppeteer page object
 * @param {Object} options - Configuration options
 * @returns {Object} - Controller object with stop() method
 */
function startContinuousCapture(page, options = {}) {
  const {
    outputDir,
    chunkDuration = 10, // seconds
    sampleRate = 16000,
    onChunkReady = null,
    healthMonitor = null
  } = options;

  let chunkNumber = 0;
  let isRunning = true;
  let captureInterval = null;

  console.log(`🎧 Starting continuous Web Audio capture (${chunkDuration}s chunks)`);
  console.log(`   Output directory: ${outputDir}`);

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Capture and save audio periodically
  captureInterval = setInterval(async () => {
    if (!isRunning) return;

    try {
      const audioData = await getAudioBuffer(page);

      if (!audioData || audioData.samples.length === 0) {
        console.log('⏸️ No audio data in buffer');
        return;
      }

      const chunkFileName = `chunk_${String(chunkNumber).padStart(3, '0')}.wav`;
      const chunkPath = path.join(outputDir, chunkFileName);

      // Analyze audio levels before writing
      let nonZeroCount = 0;
      let maxAmplitude = 0;
      for (let i = 0; i < audioData.samples.length; i++) {
        const absVal = Math.abs(audioData.samples[i]);
        if (absVal > 100) { // Int16 threshold for "non-silent"
          nonZeroCount++;
        }
        if (absVal > maxAmplitude) {
          maxAmplitude = absVal;
        }
      }
      const nonZeroPercent = ((nonZeroCount / audioData.samples.length) * 100).toFixed(1);
      const isSilent = nonZeroPercent < 1; // Less than 1% non-silent samples = silent

      console.log(`📝 Writing audio chunk ${chunkNumber}: ${audioData.samples.length} samples`);
      console.log(`   🔊 Audio levels - Non-silent: ${nonZeroPercent}%, Max amplitude: ${maxAmplitude}, Silent: ${isSilent ? 'YES ⚠️' : 'NO ✅'}`);

      if (isSilent) {
        console.warn(`⚠️ Chunk ${chunkNumber} appears to be SILENT - audio capture may not be working correctly`);
      }

      writeWavFile(audioData.samples, audioData.sampleRate, chunkPath);

      if (healthMonitor) {
        healthMonitor.recordStreamData();
      }

      // Notify callback
      if (onChunkReady) {
        const chunkData = {
          chunkNumber,
          chunkPath,
          startTime: chunkNumber * chunkDuration,
          duration: audioData.samples.length / audioData.sampleRate,
          sampleRate: audioData.sampleRate
        };

        // Call async callback without blocking
        onChunkReady(chunkData).catch(err => {
          console.error(`❌ Error in chunk callback:`, err);
          if (healthMonitor) {
            healthMonitor.recordError(err);
          }
        });
      }

      chunkNumber++;

    } catch (error) {
      console.error('❌ Error capturing audio chunk:', error);
      if (healthMonitor) {
        healthMonitor.recordError(error);
      }
    }
  }, chunkDuration * 1000);

  return {
    stop: async () => {
      console.log('🛑 Stopping continuous audio capture...');
      isRunning = false;

      if (captureInterval) {
        clearInterval(captureInterval);
        captureInterval = null;
      }

      // Stop capturing in browser context
      await page.evaluate(() => {
        window.__teamsAudioCapturing = false;

        if (window.__teamsAudioProcessor) {
          window.__teamsAudioProcessor.disconnect();
        }
        if (window.__teamsAudioSource) {
          window.__teamsAudioSource.disconnect();
        }
        if (window.__teamsAudioContext) {
          window.__teamsAudioContext.close();
        }

        window.__teamsAudioBuffer = [];
        window.__teamsAudioBufferSize = 0;
      }).catch(err => {
        console.log('Note: Could not clean up browser audio context:', err.message);
      });

      console.log(`✅ Audio capture stopped. Total chunks: ${chunkNumber}`);
      return chunkNumber;
    },

    getChunkCount: () => chunkNumber,
    isRunning: () => isRunning
  };
}

/**
 * Wait for Teams audio element to be available and active
 *
 * @param {Page} page - Puppeteer page
 * @param {number} timeout - Timeout in ms
 * @param {number} checkInterval - Check interval in ms
 * @returns {Promise<boolean>}
 */
async function waitForTeamsAudioElement(page, timeout = 30000, checkInterval = 500) {
  console.log('⏳ Waiting for Teams audio element...');

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const hasAudio = await page.evaluate(() => {
      const audioElements = document.querySelectorAll('audio');
      for (const audio of audioElements) {
        if (audio.srcObject && audio.srcObject instanceof MediaStream) {
          const stream = audio.srcObject;
          if (stream.active && stream.getAudioTracks().length > 0) {
            const tracks = stream.getAudioTracks();
            // Check if at least one track is live
            if (tracks.some(t => t.readyState === 'live' && t.enabled)) {
              return true;
            }
          }
        }
      }
      return false;
    });

    if (hasAudio) {
      console.log('✅ Teams audio element is ready and active');
      return true;
    }

    await new Promise(r => setTimeout(r, checkInterval));
  }

  console.warn('⚠️ Timeout waiting for Teams audio element');
  return false;
}

/**
 * Get info about the current audio state in the page
 *
 * @param {Page} page - Puppeteer page
 * @returns {Promise<Object>}
 */
async function getAudioElementInfo(page) {
  return await page.evaluate(() => {
    const audioElements = document.querySelectorAll('audio');
    const results = [];

    for (let i = 0; i < audioElements.length; i++) {
      const audio = audioElements[i];
      const info = {
        index: i,
        hasSrcObject: !!audio.srcObject,
        paused: audio.paused,
        muted: audio.muted,
        volume: audio.volume
      };

      if (audio.srcObject && audio.srcObject instanceof MediaStream) {
        const stream = audio.srcObject;
        info.streamId = stream.id;
        info.streamActive = stream.active;
        info.audioTracks = stream.getAudioTracks().map(t => ({
          id: t.id,
          label: t.label,
          enabled: t.enabled,
          readyState: t.readyState,
          muted: t.muted
        }));
        info.videoTracks = stream.getVideoTracks().length;
      }

      results.push(info);
    }

    return {
      totalAudioElements: audioElements.length,
      elements: results,
      captureActive: !!window.__teamsAudioCapturing,
      bufferSize: window.__teamsAudioBufferSize || 0,
      audioStats: window.__teamsAudioStats || null
    };
  });
}

/**
 * Get current audio capture statistics for debugging
 *
 * @param {Page} page - Puppeteer page
 * @returns {Promise<Object>}
 */
async function getAudioCaptureStats(page) {
  return await page.evaluate(() => {
    const stats = window.__teamsAudioStats || {
      totalSamples: 0,
      nonZeroSamples: 0,
      maxAmplitude: 0,
      processCount: 0
    };

    const nonZeroPercent = stats.totalSamples > 0
      ? ((stats.nonZeroSamples / stats.totalSamples) * 100).toFixed(2)
      : '0.00';

    return {
      ...stats,
      nonZeroPercent: parseFloat(nonZeroPercent),
      isSilent: parseFloat(nonZeroPercent) < 1,
      isCapturing: !!window.__teamsAudioCapturing,
      bufferSize: window.__teamsAudioBufferSize || 0,
      contextState: window.__teamsAudioContext?.state || 'unknown'
    };
  });
}

module.exports = {
  initializeWebAudioCapture,
  getAudioBuffer,
  writeWavFile,
  startContinuousCapture,
  waitForTeamsAudioElement,
  getAudioElementInfo,
  getAudioCaptureStats
};
