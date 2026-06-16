'use client';

import { create } from 'zustand';

// Service type for WebSocket routing
export type ServiceType = 'cisco' | 'genesis' | null;

// Voice integration type for notification WebSocket
export type VoiceIntegrationType = 'cisco' | 'genesys' | null;

interface IncomingCallData {
  conversation_id: string;
  meeting_id: string;
  session_id?: string;
  timestamp: string;
  type: string;
  caller_number?: string;
  called_number?: string;
}

// Pending navigation for Cisco's navigate_to_meeting
interface PendingNavigation {
  meeting_id: string;
  service: ServiceType;
}

interface TranscriptMessage {
  id: string;
  content: string;
  text: string;
  timestamp: string;
  isPartial: boolean;
  userName: string;
  role?: string;
}

interface WebSocketMessage {
  type: 'incoming_call' | 'call_started' | 'transcript' | 'call_ended' | 'navigate_to_meeting' | 'identify_ack' | 'pong' | 'keep_alive';
  data: any;
  timestamp: string;
}

interface UnifiedWebSocketStore {
  // WebSocket connection
  ws: WebSocket | null;
  isConnected: boolean;
  isConnecting: boolean;
  currentMeetingId: string | null;
  currentService: ServiceType;
  error: Error | null;

  // Transcript data
  websocketText: TranscriptMessage[];
  unformattedWebsocketText: string;

  // Call state
  incomingCall: IncomingCallData | null;
  callStarted: boolean;
  isPostCallLoading: boolean;

  // Cisco-specific: pending navigation from navigate_to_meeting
  pendingNavigation: PendingNavigation | null;

  // Internal state
  processedMessageIds: Record<string, boolean>;
  firstItemTimestamp: number | null;
  reconnectTimeout: NodeJS.Timeout | null;
  pingInterval: NodeJS.Timeout | null;

  // Actions
  connect: (meetingId?: string, userId?: string, service?: ServiceType, voiceIntegration?: VoiceIntegrationType, userEmail?: string) => void;
  disconnect: () => void;
  clearIncomingCall: () => void;
  clearPendingNavigation: () => void;
  sendMessage: (message: any) => void;
  clearTranscript: () => void;
}

export const useUnifiedWebSocketStore = create<UnifiedWebSocketStore>((set, get) => ({
  // Initial state
  ws: null,
  isConnected: false,
  isConnecting: false,
  currentMeetingId: null,
  currentService: null,
  error: null,
  websocketText: [],
  unformattedWebsocketText: '',
  incomingCall: null,
  callStarted: false,
  isPostCallLoading: false,
  pendingNavigation: null,
  processedMessageIds: {},
  firstItemTimestamp: null,
  reconnectTimeout: null,
  pingInterval: null,

  // Clear incoming call notification (Genesys)
  clearIncomingCall: () => set({ incomingCall: null }),

  // Clear pending navigation (Cisco)
  clearPendingNavigation: () => set({ pendingNavigation: null }),

  // Clear transcript
  clearTranscript: () => set({ 
    websocketText: [], 
    unformattedWebsocketText: '',
    processedMessageIds: {},
    firstItemTimestamp: null,
  }),

  // Send message through WebSocket
  sendMessage: (message: any) => {
    const { ws } = get();
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  },

  // Disconnect WebSocket
  disconnect: () => {
    const { ws, reconnectTimeout, pingInterval, isConnecting } = get();

    // Don't disconnect if currently connecting (prevent race condition)
    if (isConnecting) {
      return;
    }

    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
    }

    if (pingInterval) {
      clearInterval(pingInterval);
    }

    if (ws) {
      ws.close();
    }

    set({
      ws: null,
      isConnected: false,
      isConnecting: false,
      currentMeetingId: null,
      currentService: null,
      reconnectTimeout: null,
      pingInterval: null,
    });
  },

  // Connect to WebSocket
  connect: (meetingId?: string, userId?: string, service?: ServiceType, voiceIntegration?: VoiceIntegrationType, userEmail?: string) => {
    const { disconnect, currentMeetingId, currentService, isConnected, isConnecting, ws } = get();

    // Normalize meetingId (treat null, undefined, "null", "undefined" as no meetingId)
    const normalizedMeetingId = (meetingId && meetingId !== "null" && meetingId !== "undefined")
      ? meetingId
      : null;

    // Normalize service
    const normalizedService = service || null;

    // If already connected to the same meeting and service, do nothing
    if (isConnected && currentMeetingId === normalizedMeetingId && currentService === normalizedService && ws?.readyState === WebSocket.OPEN) {
      return;
    }

    // If currently connecting, don't start a new connection
    if (isConnecting) {
      return;
    }

    // If connecting to a different meeting/service or reconnecting, disconnect first
    if (ws && (currentMeetingId !== normalizedMeetingId || currentService !== normalizedService || ws.readyState !== WebSocket.OPEN)) {
      disconnect();
    }

    // Set connecting state
    set({ isConnecting: true, currentMeetingId: normalizedMeetingId, currentService: normalizedService });

    try {
      const baseWsUrl = process.env.NEXT_PUBLIC_COPILOT_SERVER_WS_URL;
      let wsUrl;

      if (normalizedMeetingId) {
        // Meeting-specific connection for copilot page
        if (normalizedService === 'cisco') {
          wsUrl = `${baseWsUrl}/cisco/ws/${normalizedMeetingId}`;
        } else {
          // Default to Genesys
          wsUrl = `${baseWsUrl}/copilot/ws/${normalizedMeetingId}`;
        }
      } else {
        // Global notification connection for incoming calls (based on voice integration type)
        if (voiceIntegration === 'genesys') {
          wsUrl = `${baseWsUrl}/copilot/notifications/ws`;
        } else {
          // Default to Cisco for notifications
          wsUrl = `${baseWsUrl}/cisco/notifications/ws`;
        }
      }

      const websocket = new WebSocket(wsUrl);
      
      websocket.onopen = () => {
        set({ isConnected: true, isConnecting: false, error: null });

        // Send identity message for notifications/ws endpoint
        if (!normalizedMeetingId && userId) {
          const identityMessage = {
            type: "identify",
            user_id: voiceIntegration === 'genesys' && userEmail ? userEmail : userId
          };
          websocket.send(JSON.stringify(identityMessage));
        }

        // Set up ping interval for keep-alive (every 30 seconds)
        const interval = setInterval(() => {
          if (websocket.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000);
        set({ pingInterval: interval });
      };
      
      websocket.onmessage = (event: MessageEvent) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          switch (message.type) {
            case 'incoming_call':
              // Genesys incoming call notification
              set({ incomingCall: message.data });
              break;

            case 'navigate_to_meeting':
              // Cisco navigation message - agent answered call in Finesse
              if (message.data?.meeting_id) {
                set({
                  pendingNavigation: {
                    meeting_id: message.data.meeting_id,
                    service: message.data.service || 'cisco',
                  },
                });
              }
              break;

            case 'identify_ack':
              // Acknowledgment of identity message - no action needed
              break;

            case 'pong':
            case 'keep_alive':
              // Response to ping / keep-alive - no action needed
              break;

            case 'call_started':
              set({ callStarted: true });
              break;
              
            case 'transcript': {
              const { websocketText, processedMessageIds, firstItemTimestamp } = get();
              const transcriptData = Array.isArray(message.data) ? message.data : [message.data];
              
              let newMessages = [...websocketText];
              const newProcessedIds = { ...processedMessageIds };
              let newFirstTimestamp = firstItemTimestamp;
              let newUnformattedText = get().unformattedWebsocketText;
              
              transcriptData.forEach((item) => {
                const messageId = item.id;
                if (newProcessedIds[messageId]) {
                  return; // Skip if already processed
                }
                newProcessedIds[messageId] = true;

                const content = item.content || {};
                const text = content.text || "";
                const messageType = content.message_type || "";
                const currentItemTimestamp = new Date(item.created_at).getTime();

                if (newFirstTimestamp === null) {
                  newFirstTimestamp = currentItemTimestamp;
                }

                const timeDifference = (currentItemTimestamp - newFirstTimestamp) / 1000;
                const minutes = Math.floor(timeDifference / 60).toString().padStart(2, "0");
                const seconds = Math.floor(timeDifference % 60).toString().padStart(2, "0");
                const timestamp = `${minutes}:${seconds}`;

                const userName = item?.content?.speaker || item.userName || "Unknown";

                const newMessage: TranscriptMessage = {
                  id: messageId,
                  content: text,
                  text,
                  timestamp,
                  isPartial: messageType !== "FinalTranscript",
                  userName,
                  role: item.role || "user",
                };

                // Handle partial vs final transcripts
                if (messageType === "FinalTranscript") {
                  newMessages = newMessages.filter((m) => !m.isPartial);
                  newMessages.push(newMessage);
                } else {
                  newMessages = [
                    ...newMessages.filter((m) => !m.isPartial),
                    newMessage,
                  ];
                }

                // Update unformatted text
                if (!newUnformattedText.trim().endsWith(text.trim())) {
                  newUnformattedText = `${newUnformattedText} ${text}`;
                }
              });
              
              set({ 
                websocketText: newMessages,
                processedMessageIds: newProcessedIds,
                firstItemTimestamp: newFirstTimestamp,
                unformattedWebsocketText: newUnformattedText,
              });
              break;
            }
              
            case 'call_ended':
              set({ callStarted: false });
              break;
              
            default:
              break;
          }
        } catch (err) {
          set({ error: new Error('Failed to parse WebSocket message') });
        }
      };
      
      websocket.onerror = (error) => {
        set({ 
          error: new Error('WebSocket connection error'),
          isConnecting: false,
        });
      };
      
      websocket.onclose = (event) => {
        set({ 
          ws: null, 
          isConnected: false,
          isConnecting: false,
        });
        
        // Attempt to reconnect after 3 seconds if not a clean close
        if (!event.wasClean) {
          const timeout = setTimeout(() => {
            get().connect(normalizedMeetingId || undefined, userId, normalizedService || undefined, voiceIntegration, userEmail);
          }, 3000);
          set({ reconnectTimeout: timeout });
        }
      };
      
      set({ ws: websocket });
    } catch (err) {
      set({ 
        error: new Error('Failed to create WebSocket connection'),
        isConnecting: false,
      });
    }
  },
}));

