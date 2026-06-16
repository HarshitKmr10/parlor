import { useState, useEffect, useCallback, useRef } from "react";
import { useGlobalContext } from "contexts/store";
import { useWebSocketStore } from "store/WebSocket";
const COPILOT_SERVER_WS_URL = `${process.env.NEXT_PUBLIC_COPILOT_SERVER_WS_URL}`;
interface TranscriptContent {
  message_type: string;
  text: string;
  confidence?: number;
  is_final?: boolean;
  source?: string;
  speaker?: string;
}
interface TranscriptItem {
  id: string;
  created_at: string;
  content: TranscriptContent;
  content_type: string;
  meeting_id: string;
}
interface WebSocketMessage {
  type: "call_started" | "transcript" | "call_ended";
  data: TranscriptItem[] | { meeting_id: string; service?: string; status?: string };
  timestamp: string;
}
interface TranscriptMessage {
  content: string;
  timestamp: string;
  isPartial: boolean;
  userName: string;
}
/**
 * Hook to connect to Cisco meeting transcript WebSocket.
 *
 * Usage:
 * - Call this hook with a meetingId after navigating to /copilot?meetingId=${id}&service=cisco
 * - Returns real-time transcripts from the Cisco call
 *
 * @param meetingId - The meeting/call ID
 * @param userDetails - User details including fullName
 * @returns Object with transcripts and connection status
 */
export const useCiscoTranscripts = (
  meetingId: string | null,
  userDetails?: { fullName?: string } | null
) => {
  const [websocketText, setWebsocketText] = useState<TranscriptMessage[]>([]);
  const [unformattedWebsocketText, setUnformattedWebsocketText] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [callStatus, setCallStatus] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const firstItemTimestampRef = useRef<number | null>(null);
  const messagesRef = useRef<TranscriptMessage[]>([]);
  const processedMessageIdsRef = useRef<Record<string, boolean>>({});
  const userDetailsRef = useRef(userDetails);
  const isIntentionalCloseRef = useRef(false);
  const { user } = useGlobalContext();
  // Get store setters to sync transcripts for CallerInfoTab
  const setStoreWebsocketText = useWebSocketStore((state) => state.setWebsocketText);
  const setStoreUnformattedWebsocketText = useWebSocketStore((state) => state.setUnformattedWebsocketText);
  // Sync local transcripts to store for CallerInfoTab
  useEffect(() => {
    setStoreWebsocketText(websocketText);
  }, [websocketText, setStoreWebsocketText]);
  useEffect(() => {
    setStoreUnformattedWebsocketText(unformattedWebsocketText);
  }, [unformattedWebsocketText, setStoreUnformattedWebsocketText]);
  // Update userDetailsRef when userDetails changes
  useEffect(() => {
    userDetailsRef.current = userDetails;
    // Update existing messages if we now have a name
    if (userDetails?.fullName) {
      setWebsocketText((prevText) =>
        prevText.map((item) => ({
          ...item,
          userName: item.userName === "Unknown" ? userDetails.fullName! : item.userName,
        }))
      );
    }
  }, [userDetails]);
  const callStatusRef = useRef<string | null>(null);
  const handleWebsocketMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      console.log("Cisco transcript message:", message.type);
      switch (message.type) {
        case "call_started":
          console.log("Cisco call started:", message.data);
          callStatusRef.current = "started";
          setCallStatus("started");
          setIsConnected(true);
          break;
        case "transcript": {
          const transcripts = message.data as TranscriptItem[];
          transcripts.forEach((item) => {
            const messageId = item.id;
            if (processedMessageIdsRef.current[messageId]) {
              return; // Skip if already processed
            }
            processedMessageIdsRef.current[messageId] = true;
            const content: TranscriptContent = item.content || { message_type: "", text: "" };
            const text = content.text || "";
            const currentItemTimestamp = new Date(item.created_at).getTime();
            if (firstItemTimestampRef.current === null) {
              firstItemTimestampRef.current = currentItemTimestamp;
            }
            const timeDifference =
              (currentItemTimestamp - firstItemTimestampRef.current) / 1000;
            const minutes = Math.floor(timeDifference / 60)
              .toString()
              .padStart(2, "0");
            const seconds = Math.floor(timeDifference % 60)
              .toString()
              .padStart(2, "0");
            const timestamp = `${minutes}:${seconds}`;
            // For Cisco calls, use speaker from content or user's name
            const userName =
              content.speaker ||
              userDetailsRef.current?.fullName ||
              "User";
            const newMessage: TranscriptMessage = {
              content: text,
              timestamp,
              isPartial: content.message_type !== "FinalTranscript",
              userName,
            };
            if (content.message_type === "FinalTranscript") {
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
        case "call_ended":
          console.log("Cisco call ended:", message.data);
          callStatusRef.current = "ended";
          setCallStatus("ended");
          break;
        default:
          console.log("Unknown message type:", message.type);
      }
    } catch (e) {
      console.error("Error parsing Cisco transcript message:", e);
    }
  }, []);
  useEffect(() => {
    if (!meetingId || !user) {
      console.log("Cisco transcripts: Missing meetingId or user");
      return;
    }
    isIntentionalCloseRef.current = false;
    const setupWebSocket = () => {
      // Clean up existing connection
      if (websocketRef.current) {
        isIntentionalCloseRef.current = true;
        websocketRef.current.close();
        websocketRef.current = null;
        setUnformattedWebsocketText("");
        setWebsocketText([]);
      }
      const wsUrl = `${COPILOT_SERVER_WS_URL}/cisco/ws/${meetingId}`;
      console.log("Connecting to Cisco transcript WebSocket:", wsUrl);
      try {
        const ws = new WebSocket(wsUrl);
        websocketRef.current = ws;
        isIntentionalCloseRef.current = false;
        ws.onopen = () => {
          console.log("Cisco transcript WebSocket connected");
          setIsConnected(true);
          setError(null);
        };
        ws.onmessage = handleWebsocketMessage;
        ws.onerror = (e) => {
          console.error("Cisco transcript WebSocket error:", e);
          setError(new Error("WebSocket connection error"));
          setIsConnected(false);
        };
        ws.onclose = (e) => {
          console.log("Cisco transcript WebSocket closed:", e.reason);
          setIsConnected(false);
          // Reconnect if not intentional close and call not ended
          if (!isIntentionalCloseRef.current && callStatusRef.current !== "ended") {
            console.log("Reconnecting in 5 seconds...");
            setTimeout(() => {
              setupWebSocket();
            }, 5000);
          }
        };
      } catch (e) {
        console.error("Error creating Cisco transcript WebSocket:", e);
        setError(e as Error);
      }
    };
    setupWebSocket();
    return () => {
      isIntentionalCloseRef.current = true;
      if (websocketRef.current) {
        websocketRef.current.close();
        websocketRef.current = null;
      }
      setWebsocketText([]);
      setUnformattedWebsocketText("");
      messagesRef.current = [];
      processedMessageIdsRef.current = {};
      firstItemTimestampRef.current = null;
      callStatusRef.current = null;
    };
  }, [meetingId, user]);
  return {
    websocketText,
    unformattedWebsocketText,
    isConnected,
    callStatus,
    error,
  };
};
export default useCiscoTranscripts;