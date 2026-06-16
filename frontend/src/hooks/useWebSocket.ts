import { useState, useEffect, useCallback, useRef } from "react";
import { useWebSocketToken } from "./useWebSocketToken";
import { useGlobalContext } from "contexts/store";

const COPILOT_SERVER_WS_URL = `${process.env.NEXT_PUBLIC_COPILOT_SERVER_WS_URL}`;

const useWebSocket = (meetingId, meeting, userDetails) => {
  const [websocketText, setWebsocketText] = useState([]);
  const [unformattedWebsocketText, setUnformattedWebsocketText] = useState("");
  const [websocket, setWebsocket] = useState(null);
  const [error, setError] = useState(null);
  const firstItemTimestampRef = useRef(null);
  const userDetailsRef = useRef(userDetails);
  const messagesRef = useRef([]);
  const processedMessageIdsRef = useRef({});
  const { token } = useWebSocketToken(meetingId);
  const { user } = useGlobalContext();

  const updateExistingMessages = useCallback((fullName) => {
    setWebsocketText((prevText) =>
      prevText.map((item) => ({
        ...item,
        userName: item.userName === "Unknown" ? fullName : item.userName,
      }))
    );
  }, []);
  // Update userDetailsRef whenever userDetails changes
  useEffect(() => {
    userDetailsRef.current = userDetails;
    // If userDetails has changed and now includes a name, update existing messages
    if (userDetails?.fullName) {
      updateExistingMessages(userDetails.fullName);
    }
  }, [userDetails]);

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

        setUnformattedWebsocketText((prevText) => {
          if (!prevText.trim().endsWith(text.trim())) {
            return `${prevText} ${text}`;
          }
          return prevText;
        });
      });
    },
    [meeting]
  );

  useEffect(() => {
    let intentionalClose = false;
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

      if (websocket) {
        intentionalClose = true;
        websocket.close();
        setWebsocket(null);
        setUnformattedWebsocketText("");
      }

      const newWebsocket = new WebSocket(wsUri);
      newWebsocket.onmessage = handleWebsocketMessage;
      newWebsocket.onopen = () => console.log("WebSocket connected");
      newWebsocket.onerror = (e) => console.log(`WebSocket Error: ${e}`);
      newWebsocket.onclose = function (e) {
        setTimeout(function () {
          if (!intentionalClose) {
            setupWebSocket();
          }
        }, 5000);
      };
      setWebsocket(newWebsocket);
    };

    setupWebSocket();

    return () => {
      if (websocket) {
        intentionalClose = true;
        setWebsocketText([]);
        setUnformattedWebsocketText("");
        websocket.close();
        setWebsocket(null);
      }
    };
  }, [meetingId, meeting, handleWebsocketMessage, token, user]);

  return { websocketText, unformattedWebsocketText, error };
};

export default useWebSocket;
