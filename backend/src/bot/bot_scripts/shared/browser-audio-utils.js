/**
 * Browser Audio Utils - Injected into browser context
 * Based on vexa's browser-utils.global.js pattern
 *
 * This file is injected into the browser via addScriptTag
 * and provides audio capture utilities on window.BrowserAudioUtils
 */

(function() {
  'use strict';

  // Prevent double initialization
  if (window.BrowserAudioUtils) {
    console.log('[BrowserAudioUtils] Already loaded, skipping');
    return;
  }

  // Logging helper
  window.logBot = window.logBot || function(msg) {
    console.log('[BrowserAudio] ' + msg);
  };

  /**
   * BrowserAudioService - Captures audio from media elements
   * Same pattern as vexa's implementation
   */
  class BrowserAudioService {
    constructor(config) {
      this.processor = null;
      this.audioContext = null;
      this.destinationNode = null;
      this.config = config || {
        targetSampleRate: 16000,
        bufferSize: 4096,
        inputChannels: 1,
        outputChannels: 1
      };
      this.sessionStartTime = null;
    }

    async findMediaElements(retries, delay) {
      retries = retries || 10;
      delay = delay || 2000;

      for (var i = 0; i < retries; i++) {
        // Find all audio and video elements with MediaStream srcObject
        var mediaElements = Array.from(document.querySelectorAll('audio, video')).filter(function(el) {
          return el.srcObject instanceof MediaStream && el.srcObject.getAudioTracks().length > 0;
        });

        if (mediaElements.length > 0) {
          window.logBot('Found ' + mediaElements.length + ' active media elements with audio tracks after ' + (i + 1) + ' attempt(s).');
          return mediaElements;
        }

        window.logBot('No active media elements found. Retrying in ' + delay + 'ms... (Attempt ' + (i + 1) + '/' + retries + ')');
        await new Promise(function(resolve) { setTimeout(resolve, delay); });
      }

      window.logBot('WARNING: No media elements found after all retries');
      return [];
    }

    async createCombinedAudioStream(mediaElements) {
      if (mediaElements.length === 0) {
        throw new Error('No media elements provided for audio stream creation');
      }

      window.logBot('Found ' + mediaElements.length + ' active media elements.');

      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      if (!this.destinationNode) {
        this.destinationNode = this.audioContext.createMediaStreamDestination();
      }

      var sourcesConnected = 0;
      var self = this;

      // Connect all media elements to the destination node
      mediaElements.forEach(function(element, index) {
        try {
          // Ensure element is actually audible
          if (typeof element.muted === 'boolean') element.muted = false;
          if (typeof element.volume === 'number') element.volume = 1.0;
          if (typeof element.play === 'function') {
            element.play().catch(function() {});
          }

          var elementStream = element.srcObject ||
            (element.captureStream && element.captureStream()) ||
            (element.mozCaptureStream && element.mozCaptureStream());

          // Debug audio tracks and unmute them
          if (elementStream instanceof MediaStream) {
            var audioTracks = elementStream.getAudioTracks();
            window.logBot('Element ' + (index + 1) + ': Found ' + audioTracks.length + ' audio tracks');

            audioTracks.forEach(function(track, trackIndex) {
              window.logBot('  Track ' + trackIndex + ': enabled=' + track.enabled + ', muted=' + track.muted + ', label=' + track.label);
              // Unmute muted audio tracks
              if (track.muted) {
                track.enabled = true;
                try {
                  track.muted = false;
                  window.logBot('  Unmuted track ' + trackIndex);
                } catch (e) {
                  window.logBot('  Could not unmute track ' + trackIndex + ': ' + e.message);
                }
              }
            });
          }

          if (elementStream instanceof MediaStream && elementStream.getAudioTracks().length > 0) {
            // Connect regardless of the read-only muted flag; WebAudio can still pull samples
            var sourceNode = self.audioContext.createMediaStreamSource(elementStream);
            sourceNode.connect(self.destinationNode);
            sourcesConnected++;
            window.logBot('Connected audio stream from element ' + (index + 1) + '/' + mediaElements.length);
          } else {
            window.logBot('Skipping element ' + (index + 1) + ': No audio tracks found');
          }
        } catch (error) {
          window.logBot('Could not connect element ' + (index + 1) + ': ' + error.message);
        }
      });

      if (sourcesConnected === 0) {
        throw new Error('Could not connect any audio streams. Check media permissions.');
      }

      window.logBot('Successfully combined ' + sourcesConnected + ' audio streams.');
      return this.destinationNode.stream;
    }

    async initializeAudioProcessor(combinedStream) {
      // Reuse existing context if available
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      if (!this.destinationNode) {
        this.destinationNode = this.audioContext.createMediaStreamDestination();
      }

      var mediaStream = this.audioContext.createMediaStreamSource(combinedStream);
      var recorder = this.audioContext.createScriptProcessor(
        this.config.bufferSize,
        this.config.inputChannels,
        this.config.outputChannels
      );
      var gainNode = this.audioContext.createGain();
      gainNode.gain.value = 0; // Silent playback

      // Connect the audio processing pipeline
      mediaStream.connect(recorder);
      recorder.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      this.processor = {
        audioContext: this.audioContext,
        destinationNode: this.destinationNode,
        recorder: recorder,
        mediaStream: mediaStream,
        gainNode: gainNode,
        sessionAudioStartTimeMs: null
      };

      try {
        await this.audioContext.resume();
      } catch (e) {
        // Ignore
      }

      window.logBot('Audio processing pipeline connected and ready.');
      return this.processor;
    }

    setupAudioDataProcessor(onAudioData) {
      if (!this.processor) {
        throw new Error('Audio processor not initialized');
      }

      var self = this;
      this.processor.recorder.onaudioprocess = function(event) {
        // Set session start time on first audio chunk
        if (self.processor.sessionAudioStartTimeMs === null) {
          self.processor.sessionAudioStartTimeMs = Date.now();
          window.logBot('Session audio start time set: ' + self.processor.sessionAudioStartTimeMs);
        }

        var inputData = event.inputBuffer.getChannelData(0);
        var resampledData = self.resampleAudioData(inputData, self.processor.audioContext.sampleRate);
        onAudioData(resampledData, self.processor.sessionAudioStartTimeMs);
      };
    }

    resampleAudioData(inputData, sourceSampleRate) {
      var targetSampleRate = this.config.targetSampleRate;
      if (sourceSampleRate === targetSampleRate) {
        return inputData;
      }

      var targetLength = Math.round(inputData.length * (targetSampleRate / sourceSampleRate));
      var resampledData = new Float32Array(targetLength);
      var springFactor = (inputData.length - 1) / (targetLength - 1);

      resampledData[0] = inputData[0];
      resampledData[targetLength - 1] = inputData[inputData.length - 1];

      for (var i = 1; i < targetLength - 1; i++) {
        var index = i * springFactor;
        var leftIndex = Math.floor(index);
        var rightIndex = Math.ceil(index);
        var fraction = index - leftIndex;
        resampledData[i] = inputData[leftIndex] + (inputData[rightIndex] - inputData[leftIndex]) * fraction;
      }

      return resampledData;
    }

    getSessionAudioStartTime() {
      return this.processor ? this.processor.sessionAudioStartTimeMs : null;
    }

    disconnect() {
      if (this.processor) {
        try {
          this.processor.recorder.disconnect();
          this.processor.mediaStream.disconnect();
          this.processor.gainNode.disconnect();
          this.processor.audioContext.close();
          window.logBot('Audio processing pipeline disconnected.');
        } catch (error) {
          window.logBot('Error disconnecting audio pipeline: ' + error.message);
        }
        this.processor = null;
      }
    }
  }

  // Expose utilities on window object
  window.BrowserAudioUtils = {
    BrowserAudioService: BrowserAudioService
  };

  console.log('[BrowserAudioUtils] Loaded successfully');
})();
