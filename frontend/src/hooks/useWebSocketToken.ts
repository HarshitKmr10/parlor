import { useState, useEffect } from "react";
import { API } from "api";
import { useGlobalContext } from "contexts/store";

export const useWebSocketToken = (selectedCallId?: string) => {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useGlobalContext();
  useEffect(() => {
    const fetchToken = async () => {
      try {
        if (!user) {
          throw new Error("User not found");
        }
        const response = await API.WebSocketCalls.getWebSocketToken(
          user?.access_token
        );
        if (response.success) {
          setToken(response.data.access_token);
        } else {
          throw new Error("Failed to fetch WebSocket token");
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
        console.error("Error fetching WebSocket token:", err);
      }
    };
    if (selectedCallId) {
      fetchToken();
    }
    else{
      setToken(null);
    }
  }, [user, selectedCallId]);

  return { token, error };
};
