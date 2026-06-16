import { useState, useEffect, useCallback, useRef } from "react";
import { useWebSocketToken } from "./useWebSocketToken";
import { useGlobalContext } from "contexts/store";
import { useWebSocketStore } from "store/WebSocket/WebSocketStore";
import { useUnifiedWebSocketStore } from "store/UnifiedWebSocket";
import { useSuggestionsStore } from "store/Suggestions";
import { useOrganizationConfig } from "./useOrganizationConfig";
import { useSearchParams } from "next/navigation";

const COPILOT_SERVER_WS_URL = `${process.env.NEXT_PUBLIC_COPILOT_SERVER_WS_URL || ''}`;

const useWebSocketConnection = (meetingId: string, meeting: any, userDetails: any) => {
  const searchParams = useSearchParams();
  const meeting_id = searchParams.get('meetingId');
  const service = searchParams.get('service'); // Check for service=genesis or service=cisco
  // Use UnifiedWebSocketStore for both genesis and cisco services
  const useUnifiedService = service === 'genesis' || service === 'cisco';
  
  const firstItemTimestampRef = useRef(null);
  const userDetailsRef = useRef(userDetails);
  const messagesRef = useRef([]);
  const processedMessageIdsRef = useRef({});
  const { token } = useWebSocketToken(meetingId);
  const { user } = useGlobalContext();
  const { config } = useOrganizationConfig();


  // Get WebSocket store state and actions based on service type
  const legacyUnformattedText = useWebSocketStore((state) => state.unformattedWebsocketText);
  const legacyError = useWebSocketStore((state) => state.error);
  const legacyIsConnected = useWebSocketStore((state) => state.isConnected);
  
  const genesisUnformattedText = useUnifiedWebSocketStore((state) => state.unformattedWebsocketText);
  const genesisError = useUnifiedWebSocketStore((state) => state.error);
  const genesisIsConnected = useUnifiedWebSocketStore((state) => state.isConnected);
  const genesisConnect = useUnifiedWebSocketStore((state) => state.connect);
  const genesisDisconnect = useUnifiedWebSocketStore((state) => state.disconnect);
  const genesisClearTranscript = useUnifiedWebSocketStore((state) => state.clearTranscript);

  // Use UnifiedWebSocketStore for genesis/cisco, Legacy for others
  const unformattedWebsocketText = useUnifiedService ? genesisUnformattedText : legacyUnformattedText;
  const error = useUnifiedService ? genesisError : legacyError;
  const isConnected = useUnifiedService ? genesisIsConnected : legacyIsConnected;
  
  const setWebsocketText = useWebSocketStore((state) => state.setWebsocketText);
  const setUnformattedWebsocketText = useWebSocketStore((state) => state.setUnformattedWebsocketText);
  const setWebsocket = useWebSocketStore((state) => state.setWebsocket);
  const setError = useWebSocketStore((state) => state.setError);
  const setIsConnected = useWebSocketStore((state) => state.setIsConnected);
  const clearTranscript = useWebSocketStore((state) => state.clearTranscript);
  
  // Get Suggestions store actions
  const fetchSuggestions = useSuggestionsStore((state) => state.fetchSuggestions);
  const clearSuggestions = useSuggestionsStore((state) => state.clearSuggestions);
  
  const websocketRef = useRef<WebSocket | null>(null);

  const updateExistingMessages = useCallback((fullName) => {
    setWebsocketText(
      messagesRef.current.map((item) => ({
        ...item,
        userName: item.userName === "Unknown" ? fullName : item.userName,
      }))
    );
  }, [setWebsocketText]);

  // Update userDetailsRef whenever userDetails changes
  useEffect(() => {
    userDetailsRef.current = userDetails;
    // If userDetails has changed and now includes a name, update existing messages
    if (userDetails?.fullName) {
      updateExistingMessages(userDetails.fullName);
    }
  }, [userDetails, updateExistingMessages]);

  const unformattedTextRef = useRef("");

  const handleWebsocketMessage = useCallback(
    (event) => {
      const data = JSON.parse(event.data);

      data.forEach((item) => {
        const messageId = item.id;
        if (processedMessageIdsRef.current[messageId]) {
          return; // Skip if already processed
        }
        processedMessageIdsRef.current[messageId] = true;

        const content = item.content || {};
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

        const userName =
          meeting?.channel === "Phone"
            ? userDetailsRef.current?.fullName || "Unknown"
            : item?.content?.speaker || "Unknown";

        const newMessage = {
          content: text,
          timestamp,
          isPartial: item?.content?.message_type !== "FinalTranscript",
          userName,
        };

        if (item?.content?.message_type === "FinalTranscript") {
          messagesRef.current = messagesRef.current.filter((m) => !m.isPartial);
          messagesRef.current.push(newMessage);
        } else {
          messagesRef.current = [
            ...messagesRef.current.filter((m) => !m.isPartial),
            newMessage,
          ];
        }

        setWebsocketText([...messagesRef.current]);

        const prevText = unformattedTextRef.current;
        if (!prevText.trim().endsWith(text.trim())) {
          const newText = `${prevText} ${text}`;
          unformattedTextRef.current = newText;
          setUnformattedWebsocketText(newText);
        }
      });
    },
    [meeting, setWebsocketText, setUnformattedWebsocketText]
  );

  // Effect to fetch suggestions when transcript updates
  useEffect(() => {
    if (
      unformattedWebsocketText &&
      meeting_id &&
      user?.org_id &&
      config?.version_copilot
    ) {
      fetchSuggestions(
        unformattedWebsocketText,
        meeting_id,
        user.org_id,
        config.version_copilot,
        userDetails?.employeeId
      );
    }
  }, [unformattedWebsocketText, meeting_id, user?.org_id, config?.version_copilot, userDetails?.employeeId, fetchSuggestions]);

  // Effect for UnifiedWebSocketStore (service=genesis or service=cisco)
  useEffect(() => {
    if (!useUnifiedService || !meetingId) return;

    // Connect to UnifiedWebSocketStore with service type
    genesisConnect(meetingId, undefined, service as 'cisco' | 'genesis');

    // Clear suggestions when connecting
    clearSuggestions();

    return () => {
      genesisDisconnect();
      clearSuggestions();
    };
  }, [useUnifiedService, meetingId, service, genesisConnect, genesisDisconnect, clearSuggestions]);

  // Effect for Legacy WebSocket (default - Meet/Phone channels)
  useEffect(() => {
    let intentionalClose = false;

    // Skip if using UnifiedWebSocketStore (genesis or cisco service)
    if (useUnifiedService) {
      return;
    }
    
    if (!meetingId || !meeting || !token || !user) return;


    const setupWebSocket = () => {
      let wsUri = "";
      if (meeting.channel === "Meet") {
        wsUri = `${COPILOT_SERVER_WS_URL}/recallws/${meetingId}/real_time_transcript?token=${token}&user_id=${user.id}`;
      } else if (meeting.channel === "Phone") {
        wsUri = `${COPILOT_SERVER_WS_URL}/twiliows/${meetingId}/real_time_transcript?token=${token}&user_id=${user.id}`;
      } else {
        setError(new Error("Invalid meeting channel"));
        return;
      }

      if (websocketRef.current) {
        intentionalClose = true;
        websocketRef.current.close();
        websocketRef.current = null;
        setWebsocket(null);
        clearTranscript();
        genesisClearTranscript();
        clearSuggestions();
      }

      const newWebsocket = new WebSocket(wsUri);
      newWebsocket.onmessage = handleWebsocketMessage;
      newWebsocket.onopen = () => {
        setIsConnected(true);
      };
      newWebsocket.onerror = (e) => {
        setError(new Error(`WebSocket Error: ${e}`));
      };
      newWebsocket.onclose = function (e) {
        setIsConnected(false);
        setTimeout(function () {
          if (!intentionalClose) {
            setupWebSocket();
          }
        }, 5000);
      };
      websocketRef.current = newWebsocket;
      setWebsocket(newWebsocket);
    };

    setupWebSocket();

    return () => {
      if (websocketRef.current) {
        intentionalClose = true;
        clearTranscript();
        genesisClearTranscript();
        clearSuggestions();
        websocketRef.current.close();
        websocketRef.current = null;
        setWebsocket(null);
        setIsConnected(false);
      }
    };
  }, [useUnifiedService, meetingId, meeting, handleWebsocketMessage, token, user, setWebsocket, setError, setIsConnected, clearTranscript, clearSuggestions]);

  return { 
    unformattedWebsocketText, 
    error,
    isConnected
  };
};

export default useWebSocketConnection;
