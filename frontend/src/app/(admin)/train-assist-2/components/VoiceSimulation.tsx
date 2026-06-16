'use client';

// ─── Imports ───────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';

import { Box, Flex, Text } from '@radix-ui/themes';
import { X } from 'lucide-react';

import { IoMdMic, IoMdMicOff } from 'react-icons/io';
import { IoVolumeHighOutline, IoVolumeMuteOutline } from 'react-icons/io5';
import { PiPhoneDisconnectLight } from 'react-icons/pi';

import Lottie from 'lottie-react';


// ─── Assets ────────────────────────────────────────────────────────────────
import voiceAnimationData from './voiceAnimation.json';
import voiceLoading from './voiceLoading.json';
import { CONFIG } from '@/config';
import { aiAgentInstance } from '@/api/common/axiosInstance';

// ─── Audio Buffer Constants ─────────────────────────────────────────────────
// Simple buffering - collect a few chunks before starting playback
const MIN_BUFFER_CHUNKS = 2; // Wait for 2 chunks before starting playback
const MIN_BUFFER_DURATION = 0.2; // Or 200ms of audio buffered

// ─── Types ─────────────────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onClose: () => void;
  themeId: string; // Changed from simulationId to themeId to match the API
  themeTitle?: string;
  useDirectConnection?: boolean; // If true, connects directly to Azure (bypasses backend for audio)
}

interface StartSimulationResponse {
  simulation_session_id: string;
  theme_id: string;
  websocket_url: string;
}

interface WebRTCEphemeralToken {
  token: string;
  expires_at: number;
}

interface WebRTCConnectionConfig {
  ephemeral_token: WebRTCEphemeralToken;
  webrtc_url: string;
  session_config: {
    session_update: any;
    initial_response: any;
  };
  simulation_session_id: string;
  theme_id: string;
}

interface StartWebRTCSimulationResponse {
  simulation_session_id: string;
  theme_id: string;
  connection_config: WebRTCConnectionConfig;
}

interface TranscriptEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ConcludeSimulationResponse {
  simulation_session_id: string;
  status: string;
  score?: number;
  feedback?: string;
  agent_feedback?: string;
  evaluation_details?: any;
  error?: string;
}

// ─── Component ─────────────────────────────────────────────────────────────
const VoiceSimulatorModal = ({
  open,
  onClose,
  themeId,
  themeTitle = 'Voice Simulation',
  useDirectConnection = true, // Default to direct Azure connection (bypasses backend for audio)
}: Props) => {
  // ─── Refs ───────────────────────────────────────────────────────────────
  const lottieRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const wsRef = useRef<WebSocket | null>(null); // For proxied mode (legacy)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null); // For WebRTC direct mode
  const dataChannelRef = useRef<RTCDataChannel | null>(null); // For WebRTC events
  const talkingRef = useRef(false);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const nextPlayTimeRef = useRef(0);
  const isMutedRef = useRef(false);
  const isComponentMounted = useRef(true);
  const activeSourceNodesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const isClosingRef = useRef(false);
  const isPlayingAudioRef = useRef(false); // Ref to avoid stale closure in WebSocket callback

  // Store session id safely even after ws cleanup
  const sessionIdRef = useRef<string | null>(null);

  // Direct connection refs - for tracking transcript when connected directly to Azure
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const sessionStartTimeRef = useRef<number>(0);
  const webrtcConfigRef = useRef<WebRTCConnectionConfig | null>(null);
  const sessionConfigSentRef = useRef(false);
  const initialResponseSentRef = useRef(false);

  // ─── State ──────────────────────────────────────────────────────────────
  const [isMuted, setIsMuted] = useState(false);
  const [callStarted, setCallStarted] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isAssistantMuted, setIsAssistantMuted] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Post-call summary state
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState<ConcludeSimulationResponse | null>(null);
  const [isConcluding, setIsConcluding] = useState(false);

  const appendTranscript = useCallback((role: 'user' | 'assistant', content: string) => {
    if (!content) return;
    transcriptRef.current.push({
      role,
      content,
      timestamp: Date.now() / 1000,
    });
  }, []);

  // ─── API Functions ──────────────────────────────────────────────────────
  const startSimulation = useCallback(async () => {
    if (!themeId) {
      setError('Theme ID is required');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await aiAgentInstance.post('/api/v2/voice-simulation/start', {
        theme_id: themeId,
      });

      const data: StartSimulationResponse = response.data;
      console.log('Simulation started:', data);
      // Keep a stable reference to session id for later conclude
      sessionIdRef.current = data.simulation_session_id;
      return data;
    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail || err?.message || 'Failed to start simulation';
      setError(errorMessage);
      console.error('Error starting simulation:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [themeId]);

  // Start simulation with WebRTC connection (browser connects directly to Azure with ephemeral token)
  const startWebRTCSimulation = useCallback(async (): Promise<StartWebRTCSimulationResponse | null> => {
    if (!themeId) {
      setError('Theme ID is required');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await aiAgentInstance.post('/api/v2/voice-simulation/start-webrtc', {
        theme_id: themeId,
      });

      const data: StartWebRTCSimulationResponse = response.data;
      console.log('WebRTC simulation started:', data);
      sessionIdRef.current = data.simulation_session_id;
      webrtcConfigRef.current = data.connection_config;
      sessionStartTimeRef.current = Date.now();
      transcriptRef.current = []; // Reset transcript
      return data;
    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail || err?.message || 'Failed to start WebRTC simulation';
      setError(errorMessage);
      console.error('Error starting WebRTC simulation:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [themeId]);

  // Submit transcript from direct connection before concluding
  const submitTranscript = useCallback(async (sessionId: string) => {
    if (!sessionId || transcriptRef.current.length === 0) {
      console.log('No transcript to submit');
      return;
    }

    const durationSeconds = (Date.now() - sessionStartTimeRef.current) / 1000;

    try {
      await aiAgentInstance.post(`/api/v2/voice-simulation/${sessionId}/submit-transcript`, {
        transcript: transcriptRef.current,
        duration_seconds: durationSeconds,
      });
      console.log('Transcript submitted successfully');
    } catch (err: any) {
      console.error('Error submitting transcript:', err);
    }
  }, []);

  const concludeSimulation = useCallback(async (sessionId: string) => {
    if (!sessionId) {
      console.warn('No simulation session to conclude');
      return null;
    }

    // If using direct connection, submit transcript first
    if (useDirectConnection) {
      await submitTranscript(sessionId);
    }

    try {
      const response = await aiAgentInstance.post(`/api/v2/voice-simulation/${sessionId}/conclude`);
      const data: ConcludeSimulationResponse = response.data;
      console.log('Simulation concluded:', data);
      return data;
    } catch (err: any) {
      console.error('Error concluding simulation:', err);
      return null;
    }
  }, [useDirectConnection, submitTranscript]);

  // ─── Timer Effect ───────────────────────────────────────────────────────
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callStarted && open) {
      interval = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callStarted, open]);

  // ─── Effects ─────────────────────────────────────────────────────────────
  useEffect(() => {
    isComponentMounted.current = true;
    isClosingRef.current = false;
    return () => {
      isComponentMounted.current = false;
      isClosingRef.current = true;
    };
  }, []);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Sync isPlayingAudioRef with state to avoid stale closure in WebSocket callback
  useEffect(() => {
    isPlayingAudioRef.current = isPlayingAudio;
  }, [isPlayingAudio]);

  useEffect(() => {
    if (open) {
      // reset summary display if reopening
      setShowSummary(false);
      setSummaryData(null);

      isClosingRef.current = false;
      setTimer(0);
      setError(null);
      // Start the complete flow when modal opens
      startCompleteFlow();
    } else {
      isClosingRef.current = true;
      stopListening();
    }
    return () => {
      isClosingRef.current = true;
      stopListening();
    };
  }, [open]);

  // ─── Sequential Flow Function ───────────────────────────────────────────
  const startCompleteFlow = useCallback(async () => {
    try {
      // Reset per-call WebRTC state
      sessionConfigSentRef.current = false;
      initialResponseSentRef.current = false;

      if (useDirectConnection) {
        // WEBRTC CONNECTION MODE - Browser connects directly to Azure with ephemeral token
        console.log('Starting WebRTC connection to Azure OpenAI...');

        // Step 1: Start WebRTC simulation and get ephemeral token
        const webrtcResult = await startWebRTCSimulation();
        if (!webrtcResult) {
          return;
        }

        console.log('Got WebRTC connection config with ephemeral token');

        // Step 2: Connect via WebRTC (audio setup handled by WebRTC)
        await connectWebRTC(webrtcResult.connection_config);

        // Step 3: Start the call
        setCallStarted(true);
      } else {
        // PROXIED CONNECTION MODE - Audio goes through backend
        console.log('Starting PROXIED connection through backend...');

        // Step 1: Start simulation and get session ID
        const simulationResult = await startSimulation();
        if (!simulationResult) {
          return;
        }

        const sessionId = simulationResult.simulation_session_id;
        console.log('Got simulation session ID:', sessionId);

        // Step 2: Setup audio
        const audioSetupSuccess = await setupAudio();
        if (!audioSetupSuccess) {
          return;
        }

        // Step 3: Connect WebSocket with the session ID
        connectWebSocket(sessionId);

        // Step 4: Start the call
        setCallStarted(true);
        detectSpeech();
      }
    } catch (error) {
      console.error('Error in complete flow:', error);
      setError('Failed to start voice simulation');
    }
  }, [startSimulation, startWebRTCSimulation, useDirectConnection]);

  // ─── Audio Processing ────────────────────────────────────────────────────
  const detectSpeech = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser || isClosingRef.current) return;

    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);

    const rms = Math.sqrt(buffer.reduce((sum, sample) => sum + sample * sample, 0) / buffer.length);
    const threshold = 0.03;

    if (rms > threshold && !talkingRef.current) {
      talkingRef.current = true;
      stopPlayback();
    }

    if (rms <= threshold && talkingRef.current) {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        talkingRef.current = false;
      }, 300);
    }

    if (!isClosingRef.current) {
      requestAnimationFrame(detectSpeech);
    }
  }, []);

  const downsampleAndConvert = (
    buffer: Float32Array,
    inputSampleRate: number,
    targetRate = 16000,
  ): Int16Array => {
    const ratio = inputSampleRate / targetRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Int16Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const idx = Math.floor(i * ratio);
      const clamped = Math.max(-1, Math.min(1, buffer[idx]));
      result[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    }
    return result;
  };

  // Note: This is only used for proxied WebSocket mode
  // For WebRTC direct mode, audio is sent automatically through the peer connection track
  const onAudioProcess = useCallback((e: AudioProcessingEvent) => {
    // Only process for proxied mode (WebSocket to backend)
    if (
      !talkingRef.current ||
      isMutedRef.current ||
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN ||
      isClosingRef.current
    )
      return;

    const input = e.inputBuffer.getChannelData(0);
    const floatBuffer = new Float32Array(input.length);
    floatBuffer.set(input);

    const sampleRate = audioContextRef.current?.sampleRate || 44100;
    const int16Pcm = downsampleAndConvert(floatBuffer, sampleRate);

    try {
      // Proxied mode: Send raw bytes to backend
      wsRef.current.send(int16Pcm.buffer);
    } catch (err) {
      console.error('WebSocket send error:', err);
    }
  }, []);

  // ─── Audio Setup Function ───────────────────────────────────────────────
  const setupAudio = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyserRef.current = analyser;

      const processor = audioContext.createScriptProcessor(2048, 1, 1);
      processorRef.current = processor;
      processor.onaudioprocess = onAudioProcess;

      source.connect(analyser);
      analyser.connect(processor);
      processor.connect(audioContext.destination);

      playbackContextRef.current = new AudioContext();
      nextPlayTimeRef.current = playbackContextRef.current.currentTime;

      return true;
    } catch (err) {
      console.error('Microphone access error:', err);
      setError('Failed to access microphone');
      return false;
    }
  }, [onAudioProcess]);

  // ─── Cleanup ─────────────────────────────────────────────────────────────
  const stopAllActiveAudio = useCallback(() => {
    // Stop all active audio source nodes
    activeSourceNodesRef.current.forEach((source) => {
      try {
        source.disconnect();
        source.stop(0);
      } catch (e) {
        // Source might already be stopped
      }
    });
    activeSourceNodesRef.current.clear();
  }, []);

  const cleanupAudio = useCallback(() => {
    // Stop all active audio playback immediately
    stopAllActiveAudio();

    // Clear audio queue
    audioQueueRef.current = [];
    nextPlayTimeRef.current = 0;

    // Clear silence timer
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    processorRef.current?.disconnect();
    processorRef.current = null;

    analyserRef.current?.disconnect();
    analyserRef.current = null;

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;

    audioContextRef.current?.close();
    audioContextRef.current = null;

    playbackContextRef.current?.close();
    playbackContextRef.current = null;

    setIsPlayingAudio(false);
    talkingRef.current = false;
  }, [stopAllActiveAudio]);

  // ─── Mute Toggle ─────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const audioTracks = mediaStreamRef.current?.getAudioTracks();
    if (!audioTracks?.length) return;

    const enabled = !audioTracks[0].enabled;
    audioTracks[0].enabled = enabled;
    setIsMuted(!enabled);
  }, []);

  // ─── Playback Management ─────────────────────────────────────────────────
  // Schedule all available chunks at once for gapless playback
  const scheduleBufferedChunks = useCallback(() => {
    const context = playbackContextRef.current;
    if (
      !isComponentMounted.current ||
      !context ||
      isClosingRef.current ||
      !audioQueueRef.current.length
    ) {
      return;
    }

    const now = context.currentTime;
    // Ensure we don't schedule in the past
    if (nextPlayTimeRef.current < now) {
      nextPlayTimeRef.current = now;
    }

    // Schedule ALL queued chunks at once
    while (audioQueueRef.current.length > 0) {
      const buffer = audioQueueRef.current.shift();
      if (!buffer) continue;

      const source = context.createBufferSource();
      source.buffer = buffer;

      // Create gain node for volume control
      const gainNode = context.createGain();
      const volumeLevel = isAssistantMuted ? 0 : 1;
      gainNode.gain.value = volumeLevel;

      // Connect source -> gain -> destination
      source.connect(gainNode);
      gainNode.connect(context.destination);

      // Track active source nodes
      activeSourceNodesRef.current.add(source);

      // Schedule this chunk at precise time (no gaps)
      const startTime = nextPlayTimeRef.current;
      nextPlayTimeRef.current = startTime + buffer.duration;

      source.onended = () => {
        activeSourceNodesRef.current.delete(source);
      };

      source.start(startTime);
    }

    setIsPlayingAudio(true);
  }, [isAssistantMuted]);

  // Main playback controller - schedules buffered chunks for playback
  const playNextAudioChunk = useCallback(() => {
    const context = playbackContextRef.current;
    if (
      !isComponentMounted.current ||
      !context ||
      isClosingRef.current
    ) {
      setIsPlayingAudio(false);
      return;
    }

    scheduleBufferedChunks();
  }, [scheduleBufferedChunks]);

  const stopPlayback = () => {
    stopAllActiveAudio();
    nextPlayTimeRef.current = playbackContextRef.current?.currentTime || 0;
    audioQueueRef.current = [];
    setIsPlayingAudio(false);
  };

  // Function to control volume of all currently playing audio
  const controlAssistantVolume = useCallback(() => {
    const context = playbackContextRef.current;
    if (!context) return;

    // Stop all current audio and restart with new volume
    stopAllActiveAudio();

    // If there are queued audio chunks, restart playback with new volume
    if (audioQueueRef.current.length > 0 && !isClosingRef.current) {
      playNextAudioChunk();
    }
  }, []);

  // Helper to play PCM16 audio directly from Azure (no WAV conversion needed)
  // Moved before connectDirectWebSocket to avoid "used before declaration" error
  const playPcmAudio = useCallback(async (pcmData: Uint8Array) => {
    const context = playbackContextRef.current;
    if (!context || isClosingRef.current || isAssistantMuted) return;

    try {
      // Azure sends 24kHz mono PCM16
      const sampleRate = 24000;
      const numSamples = pcmData.length / 2; // 2 bytes per sample

      // Create audio buffer
      const audioBuffer = context.createBuffer(1, numSamples, sampleRate);
      const channelData = audioBuffer.getChannelData(0);

      // Convert PCM16 to float32
      const dataView = new DataView(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength);
      for (let i = 0; i < numSamples; i++) {
        const int16 = dataView.getInt16(i * 2, true); // little-endian
        channelData[i] = int16 / 32768; // Normalize to [-1, 1]
      }

      // Queue the audio
      audioQueueRef.current.push(audioBuffer);

      // Schedule playback - if already playing, schedule immediately; otherwise check buffer
      if (isPlayingAudioRef.current) {
        scheduleBufferedChunks();
      } else {
        const bufferedDuration = audioQueueRef.current.reduce((sum, buf) => sum + buf.duration, 0);
        const hasEnoughBuffer =
          audioQueueRef.current.length >= MIN_BUFFER_CHUNKS ||
          bufferedDuration >= MIN_BUFFER_DURATION;

        if (hasEnoughBuffer) {
          playNextAudioChunk();
        }
      }
    } catch (err) {
      console.error('Error playing PCM audio:', err);
    }
  }, [isAssistantMuted, scheduleBufferedChunks, playNextAudioChunk]);

  // ─── WebRTC Connection Setup ────────────────────────────────────────────
  // Connects directly to Azure OpenAI Realtime API using WebRTC with ephemeral token
  const connectWebRTC = useCallback(async (config: WebRTCConnectionConfig) => {
    const { ephemeral_token, webrtc_url, session_config } = config;

    if (!ephemeral_token?.token) {
      console.error('Ephemeral token is required for WebRTC connection');
      setError('Failed to get ephemeral token');
      return;
    }

    // Reset send flags for a fresh connection
    sessionConfigSentRef.current = false;
    initialResponseSentRef.current = false;

    // Close any existing WebRTC connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    console.log('Connecting to Azure OpenAI via WebRTC...');

    try {
      // Step 1: Get user media (microphone)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      // Step 2: Create RTCPeerConnection
      const pc = new RTCPeerConnection({
        iceServers: [], // Azure handles ICE
      });
      peerConnectionRef.current = pc;

      // Step 3: Add audio track to peer connection (user's microphone -> Azure)
      stream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Step 4: Handle incoming audio track (Azure -> user's speakers)
      pc.ontrack = (event) => {
        console.log('WebRTC: Received audio track from Azure');
        const remoteStream = event.streams[0];

        // Create an audio element to play the remote audio
        const audioElement = new Audio();
        audioElement.srcObject = remoteStream;
        audioElement.autoplay = true;

        // Store for volume control
        playbackContextRef.current = new AudioContext();
      };

      // Step 5: Create data channel for events (transcripts, session config, etc.)
      const dc = pc.createDataChannel('oai-events');
      dataChannelRef.current = dc;

      const sendSessionConfig = (channel: RTCDataChannel) => {
        if (!session_config?.session_update) return;
        channel.send(JSON.stringify(session_config.session_update));
        sessionConfigSentRef.current = true;
        console.log('WebRTC: Sent session.update (transcription & VAD)');
      };

      const sendInitialResponse = (channel: RTCDataChannel) => {
        if (initialResponseSentRef.current) return;

        // Pattern to force AI to speak first:
        // 1. Create a dummy user message instruction
        const conversationItem = {
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: 'Start the simulation now by stating the problem you are facing.',
              },
            ],
          },
        };

        channel.send(JSON.stringify(conversationItem));
        console.log('WebRTC: Sent conversation.item.create (trigger greeting)');

        // 2. Trigger the response
        const responseCreate = {
          type: 'response.create',
          response: {
            // instructions: "...", // Optional: Override instructions if needed
          }
        };

        channel.send(JSON.stringify(responseCreate));

        initialResponseSentRef.current = true;
        console.log('WebRTC: Sent response.create - AI will speak first');
      };

      // Helper function to setup data channel event handlers
      const setupDataChannelHandlers = (channel: RTCDataChannel, isServerChannel = false) => {
        const channelType = isServerChannel ? 'Server' : 'Client';

        channel.onopen = () => {
          console.log(`WebRTC: ${channelType} data channel opened`);

          // Send session update to enable transcription
          // NOTE: We now wait for 'session.created' event before creating the response (see onmessage handler)
          sendSessionConfig(channel);

          // Safety fallback: If session.created event is filtered/missed, trigger response after 2s anyway
          setTimeout(() => {
            if (!initialResponseSentRef.current) {
              console.log('WebRTC: Fallback trigger - session.created not received in 2s');
              sendInitialResponse(channel);
            }
          }, 2000);
        };

        channel.onmessage = (event) => {
          if (isClosingRef.current) return;

          try {
            const message = JSON.parse(event.data);
            const eventType = message.type || '';

            // Log non-delta events for debugging
            if (!eventType.includes('delta')) {
              console.log('WebRTC event:', eventType);
            }

            // Log any event containing transcription for debugging
            if (eventType.includes('transcription') || eventType.includes('audio')) {
              console.log('WebRTC transcription event:', eventType, message);
            }

            // Handle transcript events
            // User transcription - GA event (with fallback to legacy names)
            if (
              eventType === 'conversation.item.input_audio_transcription.completed' ||
              eventType === 'input_audio_transcription.completed' ||
              eventType === 'conversation.item.audio_transcription.completed'
            ) {
              const transcript = message.transcript || '';
              if (transcript) {
                console.log('WebRTC: User said:', transcript);
                appendTranscript('user', transcript);
              }
            } else if (
              eventType === 'conversation.audio_transcript.done' ||
              eventType === 'conversation.audio_transcript.completed'
            ) {
              const transcript = message.transcript || '';
              if (transcript) {
                console.log('WebRTC: User said (audio transcript):', transcript);
                appendTranscript('user', transcript);
              }
            } else if (
              eventType === 'response.output_audio_transcript.done' ||
              eventType === 'response.audio_transcript.done' ||
              eventType === 'response.output_audio_transcript.completed'
            ) {
              // Assistant transcript (GA + legacy)
              const transcript = message.transcript || '';
              if (transcript) {
                console.log('WebRTC: AI said:', transcript);
                appendTranscript('assistant', transcript);
              }
            } else if (eventType === 'session.created') {
              console.log('WebRTC: Session created');

              // New Logic: Trigger AI speech only AFTER session is created
              if (!initialResponseSentRef.current) {
                console.log('WebRTC: Session created event received, triggering initial response/greeting pattern...');
                sendInitialResponse(channel);
              }

              if (!sessionConfigSentRef.current) {
                sendSessionConfig(channel);
              }
            } else if (eventType === 'session.updated') {
              console.log('WebRTC: Session updated - transcription enabled');
              sessionConfigSentRef.current = true;
              if (!initialResponseSentRef.current) {
                sendInitialResponse(channel);
              }
            } else if (eventType === 'error') {
              console.error('WebRTC: Azure error:', message);
            }
          } catch (err) {
            console.warn('WebRTC: Failed to parse message:', event.data);
          }
        };

        channel.onerror = (error) => {
          console.error(`WebRTC: ${channelType} data channel error:`, error);
        };

        channel.onclose = () => {
          console.log(`WebRTC: ${channelType} data channel closed`);
        };
      };

      // Setup handlers for client-created channel
      setupDataChannelHandlers(dc, false);

      // Also listen for server-created data channels (Azure might create its own)
      pc.ondatachannel = (event) => {
        console.log('WebRTC: Server created data channel:', event.channel.label);
        dataChannelRef.current = event.channel; // Use server channel as primary
        setupDataChannelHandlers(event.channel, true);
      };

      // Step 6: Create SDP offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering to complete
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
        } else {
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete') {
              resolve();
            }
          };
        }
      });

      // Step 7: Send SDP offer to Azure and get answer
      console.log('WebRTC: Sending SDP offer to:', webrtc_url);

      const sdpResponse = await fetch(webrtc_url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ephemeral_token.token}`,
          'Content-Type': 'application/sdp',
        },
        body: pc.localDescription?.sdp,
      });

      if (!sdpResponse.ok) {
        throw new Error(`Azure WebRTC endpoint returned ${sdpResponse.status}: ${await sdpResponse.text()}`);
      }

      const answerSdp = await sdpResponse.text();

      // Step 8: Set remote description (Azure's answer)
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      });

      console.log('WebRTC: Connected to Azure OpenAI Realtime API');

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log('WebRTC: Connection state:', pc.connectionState);
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          console.error('WebRTC: Connection failed/disconnected');
        }
      };

    } catch (err) {
      console.error('WebRTC: Failed to connect to Azure OpenAI:', err);
      setError('Failed to connect to Azure OpenAI via WebRTC');
    }
  }, [appendTranscript]);

  // ─── WebSocket Setup ─────────────────────────────────────────────────────
  const connectWebSocket = useCallback((sessionId: string) => {
    if (!sessionId) {
      console.error('Session ID is required for WebSocket connection');
      return;
    }

    // Close any existing connection first
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Convert HTTP URL to WebSocket URL
    const baseUrl = CONFIG.AI_AGENT_API_URL.replace(/^https?:\/\//, '');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${baseUrl}/api/v2/voice-simulation/ws/voice-simulation/${sessionId}`;

    console.log('Connecting to WebSocket:', url);
    wsRef.current = new WebSocket(url);

    wsRef.current.onopen = () => {
      console.log('WebSocket connected successfully');
    };

    wsRef.current.onmessage = async (event) => {
      if (isClosingRef.current) return;

      const context = playbackContextRef.current;
      if (!context) return;

      console.log('WebSocket message received:', typeof event.data, event.data instanceof Blob ? 'Blob' : 'Text');

      // Handle binary audio data (raw audio bytes)
      if (event.data instanceof Blob) {
        try {
          const arrayBuffer = await event.data.arrayBuffer();
          console.log('Received audio blob, size:', arrayBuffer.byteLength);

          const audioBuffer = await context.decodeAudioData(arrayBuffer);
          console.log('Audio decoded successfully, duration:', audioBuffer.duration);

          if (!isClosingRef.current) {
            audioQueueRef.current.push(audioBuffer);

            // If already playing, immediately schedule this new chunk
            if (isPlayingAudioRef.current && open) {
              scheduleBufferedChunks();
            }
            // Otherwise, check if we should start playback
            else if (open) {
              const bufferedDuration = audioQueueRef.current.reduce(
                (sum, buf) => sum + buf.duration, 0
              );
              const hasEnoughBuffer =
                audioQueueRef.current.length >= MIN_BUFFER_CHUNKS ||
                bufferedDuration >= MIN_BUFFER_DURATION;

              if (hasEnoughBuffer) {
                playNextAudioChunk();
              }
            }
          }
        } catch (error) {
          console.error('Error processing audio blob:', error);
        }
      } else {
        // Handle text messages (JSON)
        try {
          const message = JSON.parse(event.data);
          console.log('Received JSON message:', message);

          // Handle different message types
          if (message.type === 'audio' && message.data) {
            // Base64 encoded audio data
            try {
              const audioData = atob(message.data);
              const audioArray = new Uint8Array(audioData.length);
              for (let i = 0; i < audioData.length; i++) {
                audioArray[i] = audioData.charCodeAt(i);
              }

              const audioBuffer = await context.decodeAudioData(audioArray.buffer);
              console.log('Audio decoded from base64, duration:', audioBuffer.duration);

              if (!isClosingRef.current) {
                audioQueueRef.current.push(audioBuffer);

                // If already playing, immediately schedule this new chunk
                if (isPlayingAudioRef.current && open) {
                  scheduleBufferedChunks();
                }
                // Otherwise, check if we should start playback
                else if (open) {
                  const bufferedDuration = audioQueueRef.current.reduce(
                    (sum, buf) => sum + buf.duration, 0
                  );
                  const hasEnoughBuffer =
                    audioQueueRef.current.length >= MIN_BUFFER_CHUNKS ||
                    bufferedDuration >= MIN_BUFFER_DURATION;

                  if (hasEnoughBuffer) {
                    playNextAudioChunk();
                  }
                }
              }
            } catch (error) {
              console.error('Error processing base64 audio:', error);
            }
          } else if (message.type === 'text') {
            console.log('Text response:', message.data);
          } else if (message.type === 'status') {
            console.log('Status update:', message.data);
          }
        } catch (error) {
          console.warn('Invalid JSON message:', event.data, error);
        }
      }
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    wsRef.current.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
    };
  }, [open, playNextAudioChunk, scheduleBufferedChunks]);

  const stopListening = useCallback(() => {
    cleanupAudio();
    // Close WebRTC connection if using direct mode
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    // Close raw WebSocket if using proxied mode
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    sessionConfigSentRef.current = false;
    initialResponseSentRef.current = false;
    setCallStarted(false);
  }, [cleanupAudio]);

  // ─── Hangup & Summary flow ───────────────────────────────────────────────
  const handleHangup = useCallback(async () => {
    // Mark closing, stop streams and audio
    isClosingRef.current = true;
    stopListening();

    // Freeze timer at current value for summary
    setCallStarted(false);

    // Conclude the simulation and display summary
    try {
      setIsConcluding(true);
      const sid = sessionIdRef.current || '';
      const result = await concludeSimulation(sid);
      setSummaryData(result || null);
      setShowSummary(true);
    } finally {
      setIsConcluding(false);
    }
  }, [concludeSimulation, stopListening]);

  // Final close after reading summary
  const handleFinalClose = useCallback(() => {
    // Small delay to ensure any pending cleanup completes
    setTimeout(() => {
      setShowSummary(false);
      setSummaryData(null);
      onClose();
    }, 100);
  }, [onClose]);

  // Keep onOpenChange wired to hangup so ESC / overlay click also concludes
  const handleControlledOpenChange = useCallback(
    (nextOpen: boolean) => {
      // If user is trying to close while in-call, hang up first and keep dialog until summary is shown
      if (!nextOpen && !showSummary && callStarted && !isConcluding) {
        handleHangup();
        // Do not call onClose yet; we will close after summary
        return;
      }
      // If summary is on screen and user tries to close (ESC/overlay), finish
      if (!nextOpen && showSummary) {
        handleFinalClose();
        return;
      }
      // If opening, just allow (parent controls open)
      if (nextOpen) return;
    },
    [showSummary, callStarted, isConcluding, handleHangup, handleFinalClose]
  );

  // ─── Format Timer ────────────────────────────────────────────────────────
  const formatTimer = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  const lottieAnimationData = useMemo(
    () => (callStarted ? voiceAnimationData : voiceLoading),
    [callStarted],
  );

  // Show loading state while starting simulation
  if (isLoading) {
    return (
      <Dialog.Root open={open} onOpenChange={handleControlledOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="bg-black/70 fixed inset-0 z-40 backdrop-blur-sm backdrop-brightness-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 transform rounded-lg bg-white shadow-2xl">
            <Flex justify="center" align="center" className="p-8">
              <Text size="4" weight="medium">Starting voice simulation...</Text>
            </Flex>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  // Show error state if simulation failed to start
  if (error && !showSummary) {
    return (
      <Dialog.Root open={open} onOpenChange={handleControlledOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="bg-black/70 fixed inset-0 z-40 backdrop-blur-sm backdrop-brightness-50" />
        </Dialog.Portal>
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 transform rounded-lg bg-white shadow-2xl">
          <Flex direction="column" gap="4" className="p-6">
            <Text size="4" weight="medium" className="text-red-600">Failed to start simulation</Text>
            <Text size="2" className="text-gray-600">{error}</Text>
            <button
              onClick={handleFinalClose}
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              Close
            </button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    );
  }

  // ─── Summary UI (post-call) ──────────────────────────────────────────────
  if (showSummary) {
    const feedbackText =
      summaryData?.agent_feedback ||
      summaryData?.feedback ||
      'No feedback available for this simulation.';

    return (
      <Dialog.Root open={open} onOpenChange={handleControlledOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="bg-black/70 fixed inset-0 z-40 backdrop-blur-sm backdrop-brightness-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 transform rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <Flex justify="between" align="center" className="mb-4 border-b-1 p-4">
              <Flex direction={'column'} gap={'0'}>
                <Text size="6" weight={'medium'} className="max-w-sm truncate text-gray-900">
                  {themeTitle}
                </Text>
                <Text size="2" weight="light" className="text-navy-400">
                  Voice Simulation
                </Text>
              </Flex>
              <button
                onClick={handleFinalClose}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </Flex>

            {/* Time Taken */}
            <Flex align="center" gap="3" className="px-6">
              <span role="img" aria-label="stopwatch">⏱️</span>
              <Text size="3" weight="medium" className="text-gray-800">
                Time Taken :
              </Text>
              <Text size="3" weight="medium" className="rounded-md bg-gray-100 px-2 py-1 tracking-wide">
                {formatTimer(timer)}
              </Text>
            </Flex>

            {/* Feedback Card */}
            <Box className="m-6 rounded-xl border-2 border-iris-5/50">
              <Flex justify="between" align="center" className="border-b-1 px-4 py-3">
                <Flex align="center" gap="2">
                  <span className="rounded-sm  px-2 py-0.5 text-[12px] font-semibold tracking-wide">🗣️ Feedback</span>
                </Flex>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(feedbackText).catch(() => { });
                  }}
                  className="rounded-md p-1 hover:bg-gray-100"
                  title="Copy feedback"
                >
                  {/* simple copy glyph */}
                  <svg width="18" height="18" viewBox="0 0 24 24" className="text-gray-600">
                    <path fill="currentColor" d="M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z" />
                  </svg>
                </button>
              </Flex>
              <Box className="px-4 py-4">
                <Text size="3" className="text-gray-800 leading-7 whitespace-pre-wrap">
                  {feedbackText}
                </Text>
              </Box>
            </Box>

            {/* Footer Actions */}
            <Flex justify="end" gap="3" className="px-6 pb-6">
              <button
                onClick={handleFinalClose}
                className="rounded-lg bg-gray-900 px-4 py-2 text-white hover:opacity-90"
              >
                Close
              </button>
            </Flex>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  // ─── In-Call UI ──────────────────────────────────────────────────────────
  return (
    <Dialog.Root open={open} onOpenChange={handleControlledOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/70 fixed inset-0 z-40 backdrop-blur-sm backdrop-brightness-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 transform rounded-lg bg-white  shadow-2xl">
          {/* Header */}
          <Flex justify="between" align="center" className="mb-6 border-b-1 p-2">
            <Flex direction={'column'} gap={'0'}>
              <Text size="6" weight={'medium'} className="max-w-sm truncate text-gray-900">
                {themeTitle}
              </Text>
              <Text size="2" weight="light" className="text-navy-400">
                Voice Simulation
              </Text>
            </Flex>
            <button
              onClick={handleHangup}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </Flex>

          {/* Voice Visualizer */}
          <Flex justify="center" className="mb-8">
            <Box className="relative">
              <Lottie
                animationData={lottieAnimationData}
                loop
                lottieRef={lottieRef}
                className="h-48 w-48"
              />
            </Box>
          </Flex>

          {/* Control Bar */}
          <Flex
            justify="between"
            align="center"
            className="relative h-24 space-x-4 border-t-1 px-3"
          >
            {/* Volume Control */}
            <Flex direction="column" align="center" className="space-y-2">
              <button
                className={`flex h-12 w-12 items-center justify-center rounded-lg border-1 ${isAssistantMuted ? `border-red-300` : `border-iris-8`} ${isAssistantMuted ? `bg-red-100` : `bg-iris-2`}  `}
                onClick={() => {
                  // toggle assistant output audio
                  setIsAssistantMuted(!isAssistantMuted);
                  // Add a small delay to ensure state is updated before controlling volume
                  setTimeout(() => {
                    controlAssistantVolume();
                  }, 10);
                }}
              >
                {!isAssistantMuted ? (
                  <IoVolumeHighOutline className="h-4 w-4 text-iris-8" />
                ) : (
                  <IoVolumeMuteOutline className="h-4 w-4 text-red-400" />
                )}
              </button>
            </Flex>
            <Box
              className="absolute left-[50%] top-[-1.5rem] ml-0 translate-x-[-50%]"
              style={{
                marginLeft: '0',
              }}
            >
              <button
                onClick={toggleMute}
                className={`flex h-12 w-12 items-center justify-center rounded-lg ${isMuted ? 'bg-red-100' : ''
                  }`}
                style={{
                  background: `linear-gradient(0deg, #3E63DD, #3E63DD),
                     linear-gradient(180deg, rgba(255, 255, 255, 0) 50%, rgba(0, 0, 0, 0.09) 100%),
                     linear-gradient(180deg, rgba(255, 255, 255, 0) 50%, rgba(62, 99, 221, 0.2) 80%)`,
                  boxShadow: `0px 0px 0px 1px rgba(0, 0, 0, 0.1) inset,
                     0px -2px 1px 0px rgba(0, 0, 0, 0.1) inset,
                     0px 0px 0px 1px #3E63DD inset,
                     0px 4px 2px -2px rgba(255, 255, 255, 0.9) inset,
                     0px 2px 1px -1px rgba(255, 255, 255, 0.9) inset`,
                }}
              >
                {isMuted ? (
                  <IoMdMicOff className="h-5 w-5 text-white" />
                ) : (
                  <IoMdMic className="h-5 w-5 text-white" />
                )}
              </button>
            </Box>
            {/* Timer */}
            <Box
              className="absolute left-[50%] top-[60%] translate-x-[-50%] text-center"
              style={{
                marginLeft: '0',
              }}
            >
              <Text size="2" weight={'regular'} className="text-neutral-11">
                {formatTimer(timer)}
              </Text>
            </Box>

            {/* Hang-up Button */}
            <button
              onClick={handleHangup}
              className={`flex h-12 w-12 items-center justify-center rounded-lg border-1 border-red-200`}
              disabled={isConcluding}
              title={isConcluding ? 'Finishing up...' : 'Hang up'}
            >
              <PiPhoneDisconnectLight className="h-5 w-5 text-red-500" />
            </button>
          </Flex>
          {/* Microphone Button */}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default VoiceSimulatorModal;
