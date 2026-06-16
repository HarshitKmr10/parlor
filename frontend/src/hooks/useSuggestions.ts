import { useState, useRef, useCallback, useEffect } from "react";
import { VoiceCopilotApi } from "services/VoiceCopilot/api";
import { useGlobalContext } from "contexts/store";

interface Suggestion {
  question: string;
  answer: string;
  citations: any[];
  messageId: string; // Added message_id field
  most_common_resolver_group?: {
    most_common_resolver_group: string;
    resolution_count: number;
    total_resolved_tickets: number;
    resolution_percentage: number;
    resolver_group_stats: Record<string, {
      resolved_count: number;
      percentage_of_resolutions: number;
    }>;
  };
  similar_tickets?: Array<{
    number: string;
    short_description: string;
    description: string;
    state: string;
    priority: string;
    category: string;
    work_notes: string;
    close_notes: string;
    resolution_code: string;
    source_table: string;
    opened_at: string;
    closed_at: string;
    assignment_group: string;
    assigned_to: string;
    caller_id: string;
    sys_id: string;
  }>;
}

interface ConversationMessage {
  content: string;
  role: "user" | "assistant";
  citations?: any[];
}

class SuggestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SuggestionError";
  }
}

export default function useSuggestions(
  transcript: string,
  meetingId: string,
  version: string,
  employeeId?: string,
) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [reTriggerApiCall, setReTriggerApiCall] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const conversationHistory = useRef<ConversationMessage[]>([]);
  const apiCallInProgress = useRef<boolean>(false);
  const processedTranscript = useRef<string>("");

  const { user } = useGlobalContext();

  const handleApiResponse = useCallback((event: any) => {
    const parsedEvent = JSON.parse(event);
    if (parsedEvent.error) {
      console.error("API Response Error:", parsedEvent.error);
      setError(new SuggestionError(`API Response Error: ${parsedEvent.error}`));
      return;
    }
    const newMessage: ConversationMessage = {
      content: parsedEvent.data.response_message_content.assistant,
      role: "assistant",
      citations: parsedEvent.data.response_aids.citations,
    };

    conversationHistory.current = [...conversationHistory.current, newMessage];

    if (parsedEvent.data.response_aids.duplicate_question_identified === false) {
      const questionDescription =
        parsedEvent.data.response_aids.optimized_query ||
        "No question mentioned";
      if (questionDescription) {
        const newSuggestion: Suggestion = {
          question: questionDescription,
          answer: newMessage.content,
          citations: newMessage.citations,
          messageId: parsedEvent.data.response_aids.message_id, // Added message_id
          most_common_resolver_group: parsedEvent.data.response_aids.most_common_resolver_group || undefined,
          similar_tickets: parsedEvent.data.response_aids.similar_tickets || undefined,
        };
        setSuggestions((prevSuggestions) => [
          ...prevSuggestions,
          newSuggestion,
        ]);
      }
    }
  }, []);

  const fetchApi = useCallback(async () => {
    if (
      apiCallInProgress.current ||
      transcript === processedTranscript.current ||
      transcript.trim().split(" ").length < 5
    ) {
      if (apiCallInProgress.current) {
        setReTriggerApiCall(true);
      }
      return;
    }

    setLoading(true);
    setError(null);
    apiCallInProgress.current = true;
    processedTranscript.current = transcript;
    conversationHistory.current = [
      ...conversationHistory.current,
      { content: transcript, role: "user" },
    ];

    try {
      const response = await VoiceCopilotApi(
        conversationHistory.current,
        meetingId,
        user?.org_id,
        version,
        employeeId
      );
      handleApiResponse(response);
    } catch (err) {
      console.error("Error fetching suggestions:", err);
      setError(
        err instanceof SuggestionError
          ? err
          : new SuggestionError(
              `Failed to fetch suggestions: ${
                err instanceof Error ? err.message : "Unknown error"
              }`
            )
      );
      setSuggestions([]);
    } finally {
      setLoading(false);
      apiCallInProgress.current = false;
      if (reTriggerApiCall) {
        setReTriggerApiCall(false);
        fetchApi();
      }
    }
  }, [
    transcript,
    meetingId,
    reTriggerApiCall,
    handleApiResponse,
    user?.org_id,
    employeeId,
  ]);

  useEffect(() => {
    fetchApi();
  }, [transcript, reTriggerApiCall, fetchApi, meetingId]);

  return { suggestions, loading, error };
}
