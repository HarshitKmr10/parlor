import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

interface IncomingCallData {
  conversation_id: string;
  meeting_id: string;
  session_id?: string;
  timestamp: string;
  type: string;
  caller_number?: string; // Optional phone number of the caller
  called_number?: string; // Optional phone number of the caller
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
  type: 'incoming_call' | 'call_started' | 'transcript' | 'call_ended';
  data: any;
  timestamp: string;
}

export const useUnifiedWebSocket = (meetingId: string) => {
  const [websocketText, setWebsocketText] = useState<TranscriptMessage[]>([]);
  const [unformattedWebsocketText, setUnformattedWebsocketText] = useState<string>('');
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [callStarted, setCallStarted] = useState<boolean>(false);
  const [isPostCallLoading, setIsPostCallLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const processedMessageIdsRef = useRef<Record<string, boolean>>({});
  const firstItemTimestampRef = useRef<number | null>(null);
  const messagesRef = useRef<TranscriptMessage[]>([]);
  const router = useRouter();
  

  const clearIncomingCall = useCallback(() => {
    setIncomingCall(null);
  }, []);

  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      switch (message.type) {
        case 'incoming_call':
          setIncomingCall(message.data);
          break;
          
        case 'call_started':
          setCallStarted(true);
          break;
          
        case 'transcript': {
          // Handle transcript data exactly like original useWebSocket
          const transcriptData = Array.isArray(message.data) ? message.data : [message.data];
          
          transcriptData.forEach((item) => {
            const messageId = item.id;
            if (processedMessageIdsRef.current[messageId]) {
              return; // Skip if already processed
            }
            processedMessageIdsRef.current[messageId] = true;

            const content = item.content || {};
            const text = content.text || "";
            const messageType = content.message_type || "";
            const currentItemTimestamp = new Date(item.created_at).getTime();

            if (firstItemTimestampRef.current === null) {
              firstItemTimestampRef.current = currentItemTimestamp;
            }

            const timeDifference = (currentItemTimestamp - firstItemTimestampRef.current) / 1000;
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

            // Handle partial vs final transcripts like original useWebSocket
            if (messageType === "FinalTranscript") {
              messagesRef.current = messagesRef.current.filter((m) => !m.isPartial);
              messagesRef.current.push(newMessage);
            } else {
              messagesRef.current = [
                ...messagesRef.current.filter((m) => !m.isPartial),
                newMessage,
              ];
            }

            setWebsocketText([...messagesRef.current]);

            setUnformattedWebsocketText((prevText) => {
              if (!prevText.trim().endsWith(text.trim())) {
                return `${prevText} ${text}`;
              }
              return prevText;
            });
          });
          break;
        }
          
        case 'call_ended':
          // Just update the call status to false
          // The meeting status will be polled by useMeetingDetails
          // and the UI will update accordingly
          setCallStarted(false);
          break;
          
        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (err) {
      console.error('Error parsing WebSocket message:', err);
      setError(new Error('Failed to parse WebSocket message'));
    }
  }, [meetingId, router]);

  const connectWebSocket = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    try {
      let wsUrl;
      if (meetingId && meetingId !== "null" && meetingId !== "undefined") {
        // Meeting-specific connection for copilot_2 page
        wsUrl = `wss://overemphatic-leanna-slipperiest.ngrok-free.dev/genesys/copilot/ws/${meetingId}`;
      } else {
        // Global notification connection for calls_2 page
        wsUrl = `wss://overemphatic-leanna-slipperiest.ngrok-free.dev/genesys/copilot/notifications/ws`;
      }

      const websocket = new WebSocket(wsUrl);
      
      websocket.onopen = () => {
        setError(null);
      };
      
      websocket.onmessage = handleWebSocketMessage;
      
      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError(new Error('WebSocket connection error'));
      };
      
      websocket.onclose = (event) => {
        ws.current = null;
        
        // Attempt to reconnect after 3 seconds
        if (!event.wasClean) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, 3000);
        }
      };
      
      ws.current = websocket;
    } catch (err) {
      console.error('Error creating WebSocket connection:', err);
      setError(new Error('Failed to create WebSocket connection'));
    }
  }, [meetingId, handleWebSocketMessage]);

  const disconnectWebSocket = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connectWebSocket();
    
    return () => {
      disconnectWebSocket();
    };
  }, [connectWebSocket, disconnectWebSocket]);

  // Send message to WebSocket (for future use)
  const sendMessage = useCallback((message: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  }, []);

  return {
    // Notification states (for calls_2)
    incomingCall,
    clearIncomingCall,
    
    // Real-time data states (for copilot_2)
    websocketText,
    unformattedWebsocketText,
    callStarted,
    isPostCallLoading,
    
    // Connection state
    error,
    sendMessage,
    
    // Connection management
    connectWebSocket,
    disconnectWebSocket,
  };
};

