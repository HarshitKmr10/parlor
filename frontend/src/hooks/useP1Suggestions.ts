// hooks/useSuggestions.ts
import {
  useState, useRef, useCallback, useEffect,
} from 'react';
import readNDJSONStream from 'ndjson-readablestream';
import { voiceP1BridgeCopilotApi } from 'api/chat/api';
import { GPT4VInput, RetrievalMode, VectorFieldOptions } from 'api/chat/models';
import { useGlobalContext } from 'contexts/store';
import { API } from 'api';

interface Suggestion {
  question: string;
  answer: string;
  citations: any[];
}

interface ConversationMessage {
  content: string;
  role: 'user' | 'assistant';
  citations?: any[];
}

class SuggestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SuggestionError';
  }
}

export default function useP1Suggestions(
  transcript: string,
  meetingId: string,
) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [reTriggerApiCall, setReTriggerApiCall] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [incident, setIncident] = useState(null);

  const conversationHistory = useRef<ConversationMessage[]>([]);
  const apiCallInProgress = useRef<boolean>(false);
  const processedTranscript = useRef<string>('');

  const { user } = useGlobalContext();

  const handleApiResponse = useCallback((event: any) => {
    if (event.error) {
      console.error('API Response Error:', event.error);
      setError(new SuggestionError(`API Response Error: ${event.error}`));
      return;
    }

    const newMessage: ConversationMessage = {
      content: event.data.response_message_content.assistant.replace(
        'RAG Context',
        'context',
      ),
      role: 'assistant',
      citations: event.data.response_aids.citations,
    };

    conversationHistory.current = [...conversationHistory.current, newMessage];

    if (event.data.response_aids.duplicate_question_identified === false) {
      const questionDescription = event.data.response_aids.optimized_query;
      if (questionDescription) {
        const newSuggestion: Suggestion = {
          question: questionDescription,
          answer: newMessage.content,
          citations: newMessage.citations,
        };
        setSuggestions((prevSuggestions) => [
          ...prevSuggestions,
          newSuggestion,
        ]);
      }
    }
  }, []);

  const fetchApi = useCallback(
    async (initialCall = false, incidentLocal: any = null) => {
      if (
        (!initialCall && apiCallInProgress.current)
        || (!initialCall && transcript === processedTranscript.current)
        || (!initialCall && transcript.trim().split(' ').length < 5)
      ) {
        if (apiCallInProgress.current) {
          setReTriggerApiCall(true);
        }
        return;
      }

      setLoading(true);
      setError(null);
      apiCallInProgress.current = true;
      if (!initialCall) {
        processedTranscript.current = transcript;
        conversationHistory.current = [
          ...conversationHistory.current,
          { content: transcript, role: 'user' },
        ];
      }

      try {
        const request = {
          messages: initialCall ? null : conversationHistory.current,
          stream: false,
          context: {
            overrides: {
              top: 7,
              retrieval_mode: RetrievalMode.Vectors,
              semantic_ranker: true,
              semantic_captions: false,
              suggest_followup_questions: false,
              use_oid_security_filter: false,
              use_groups_security_filter: false,
              vector_fields: [VectorFieldOptions.Embedding],
              use_gpt4v: false,
              gpt4v_input: GPT4VInput.Texts,
              meeting_id: meetingId,
              session_id: meetingId,
              app_id: 'voice_p1_bridge',
              ticket_details: incidentLocal
                ? {
                  short_description: incidentLocal.short_description,
                  description: incidentLocal.description,
                  category: incidentLocal.category,
                  priority: incidentLocal.priority,
                }
                : null,
            },
          },
          session_state: null,
          org_id: user?.org_id,
          user: null,
          optimized_questions_so_far: null,
        };

        const response = await voiceP1BridgeCopilotApi(request);
        if (response.status !== 200) {
          console.error(`API request failed with status ${response.status}`);
        }
        for await (const event of readNDJSONStream(response.data)) {
          handleApiResponse(event);
        }
      } catch (err) {
        console.error('Error fetching suggestions:', err);
        setError(
          err instanceof SuggestionError
            ? err
            : new SuggestionError(
              `Failed to fetch suggestions: ${
                err instanceof Error ? err.message : 'Unknown error'
              }`,
            ),
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
    },
    [transcript, meetingId, reTriggerApiCall, handleApiResponse, user?.org_id],
  );

  useEffect(() => {
    if (incident) {
      fetchApi();
    }
  }, [transcript, reTriggerApiCall, fetchApi, meetingId, incident]);

  useEffect(() => {
    if (!incident) return;
    fetchApi(true, incident);
  }, [incident]);

  useEffect(() => {
    const fetchIncident = async () => {
      const p1MeetingDetails = await API.Teams.GetP1MeetingDetails(
        meetingId,
        user,
      );
      const incidentNumber = p1MeetingDetails[0].incident_name;
      setLoading(true);
      try {
        const url = '/api/getIncident';
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ incidentNumber, user }),
        });
        const data = await response.json();
        if (data.success) {
          setIncident(data.incident);
          setSuggestions((prevSuggestions) => [
            ...prevSuggestions,
            {
              question: `Incident (${incidentNumber}) - ${data.incident.short_description}`,
              answer: data.incident.description,
              citations: [],
            },
          ]);
        }
      } catch (e) {
        console.error('Error fetching incident:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchIncident();
  }, []);

  return { suggestions, loading, error };
}
