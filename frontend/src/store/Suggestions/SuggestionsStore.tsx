'use client';

import { create } from 'zustand';
import { VoiceCopilotApi, fetchTicketSuggestionsApi } from 'services/VoiceCopilot/api';

// Exported ticket suggestion types
export interface CreateTicketSuggestion {
  title: string;
  description: string;
  category: string;
  resolver_group: string;
  priority: number;
  urgency: number;
  impact: number;
  confidence_score: number;
  reasoning: string;
}

export interface UpdateTicketSuggestion {
  action_type: string;
  ticket_id: string;
  ticket_number: string;
  title: string;
  description: string | null;
  category: string;
  resolver_group: string;
  priority: number;
  urgency: number;
  impact: number;
  work_notes: string;
  update_type: string;
  confidence_score: number;
  reasoning: string;
  related_to_vva?: boolean;
  ticket_display_info?: any;
}

export type TicketSuggestion = CreateTicketSuggestion | UpdateTicketSuggestion;

interface Suggestion {
  question: string;
  answer: string;
  citations: any[];
  messageId: string;
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
  create_ticket_suggest?: {
    suggested_tickets: CreateTicketSuggestion[];
    total_count: number;
    overall_reasoning: string;
    auto_generated: boolean;
    timestamp: string;
  };
  update_ticket_suggest?: {
    suggested_updates: UpdateTicketSuggestion[];
    total_count: number;
    overall_reasoning: string;
    auto_generated: boolean;
    timestamp: string;
  };
}

interface ConversationMessage {
  content: string;
  role: 'user' | 'assistant';
  citations?: any[];
}

interface TicketSuggestions {
  create_ticket_suggest?: {
    suggested_tickets: CreateTicketSuggestion[];
    total_count: number;
    overall_reasoning: string;
    auto_generated: boolean;
    timestamp: string;
  };
  update_ticket_suggest?: {
    suggested_updates: UpdateTicketSuggestion[];
    total_count: number;
    overall_reasoning: string;
    auto_generated: boolean;
    timestamp: string;
  };
}

interface SuggestionsStore {
  // State
  suggestions: Suggestion[];
  loading: boolean;
  error: Error | null;
  conversationHistory: ConversationMessage[];
  processedTranscript: string;
  apiCallInProgress: boolean;
  reTriggerApiCall: boolean;
  ticketSuggestions: Record<string, TicketSuggestions>; // Map messageId to ticket suggestions
  loadingTicketSuggestions: boolean;

  // Actions
  setSuggestions: (suggestions: Suggestion[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
  setConversationHistory: (history: ConversationMessage[]) => void;
  setProcessedTranscript: (transcript: string) => void;
  setApiCallInProgress: (inProgress: boolean) => void;
  setReTriggerApiCall: (reTrigger: boolean) => void;
  addSuggestion: (suggestion: Suggestion) => void;
  addConversationMessage: (message: ConversationMessage) => void;
  fetchSuggestions: (transcript: string, meetingId: string, orgId: string, version: string, employeeId?: string) => Promise<void>;
  fetchTicketSuggestions: (
    messageId: string,
    msgs: ConversationMessage[],
    meetingId: string,
    orgId: string,
    aiResponse: string,
    previousIncidentsContext: string | null,
    vvaHandoverSummary: string | null,
    callTranscript: string | null,
    mostCommonResolverGroup: any,
    primaryCache: any,
    userDetails: { user_name?: string; employee_id?: string },
    version?: string
  ) => Promise<void>;
  clearSuggestions: () => void;
}

export const useSuggestionsStore = create<SuggestionsStore>((set, get) => ({
  // Initial state
  suggestions: [],
  loading: false,
  error: null,
  conversationHistory: [],
  processedTranscript: '',
  apiCallInProgress: false,
  reTriggerApiCall: false,
  ticketSuggestions: {},
  loadingTicketSuggestions: false,

  // Actions
  setSuggestions: (suggestions) => set({ suggestions }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setConversationHistory: (history) => set({ conversationHistory: history }),
  setProcessedTranscript: (transcript) => set({ processedTranscript: transcript }),
  setApiCallInProgress: (inProgress) => set({ apiCallInProgress: inProgress }),
  setReTriggerApiCall: (reTrigger) => set({ reTriggerApiCall: reTrigger }),

  addSuggestion: (suggestion) =>
    set((state) => ({
      suggestions: [...state.suggestions, suggestion],
    })),

  addConversationMessage: (message) =>
    set((state) => ({
      conversationHistory: [...state.conversationHistory, message],
    })),

  fetchSuggestions: async (transcript: string, meetingId: string, orgId: string, version: string, employeeId?: string) => {
    const state = get();

    // Skip if already processing, transcript hasn't changed, or transcript is too short
    if (
      state.apiCallInProgress ||
      transcript === state.processedTranscript ||
      transcript.trim().split(' ').length < 5
    ) {
      if (state.apiCallInProgress) {
        set({ reTriggerApiCall: true });
      }
      return;
    }

    set({ 
      loading: true, 
      error: null, 
      apiCallInProgress: true, 
      processedTranscript: transcript 
    });

    // Add user message to conversation history
    const updatedHistory = [
      ...state.conversationHistory,
      { content: transcript, role: 'user' as const },
    ];
    set({ conversationHistory: updatedHistory });

    try {
      const response = await VoiceCopilotApi(
        updatedHistory,
        meetingId,
        orgId,
        version,
        employeeId
      );

      const parsedEvent = JSON.parse(response);

      if (parsedEvent.error) {
        set({ 
          error: new Error(`API Response Error: ${parsedEvent.error}`),
          loading: false,
          apiCallInProgress: false,
        });
        return;
      }

      // Add assistant message to conversation history
      const newMessage: ConversationMessage = {
        content: parsedEvent.data.response_message_content.assistant,
        role: 'assistant',
        citations: parsedEvent.data.response_aids.citations,
      };

      set((state) => ({
        conversationHistory: [...state.conversationHistory, newMessage],
      }));

      // Add suggestion if not a duplicate question
      if (parsedEvent.data.response_aids.duplicate_question_identified === false) {
        const questionDescription =
          parsedEvent.data.response_aids.optimized_query || 'No question mentioned';

        if (questionDescription) {
          const messageId = parsedEvent.data.response_aids.message_id;
          const newSuggestion: Suggestion = {
            question: questionDescription,
            answer: newMessage.content,
            citations: newMessage.citations || [],
            messageId,
            most_common_resolver_group: parsedEvent.data.response_aids.most_common_resolver_group,
            similar_tickets: parsedEvent.data.response_aids.similar_tickets,
            // Ticket suggestions are stored separately in ticketSuggestions map, not in this object
          };

          set((state) => ({
            suggestions: [...state.suggestions, newSuggestion],
          }));

          // Fetch ticket suggestions separately for this message (async, non-blocking)
          const currentState = get();
          const userDetails = {
            user_name: null,
            employee_id: employeeId || undefined,
          };
          
          // Call fetchTicketSuggestions asynchronously without blocking
          setTimeout(() => {
            get().fetchTicketSuggestions(
              messageId,
              currentState.conversationHistory,
              meetingId,
              orgId,
              newMessage.content,
              parsedEvent.data.response_aids.previous_incidents_context || null,
              parsedEvent.data.response_aids.vva_handover_summary || null,
              null, // call_transcript
              parsedEvent.data.response_aids.most_common_resolver_group,
              parsedEvent.data.response_aids.primary_cache || { create_ticket_suggestions: [], update_ticket_suggestions: [] },
              userDetails,
              version
            ).catch((err) => {
              console.error('[SuggestionsStore] Error fetching ticket suggestions:', err);
            });
          }, 0);
        }
      }
    } catch (err) {
      set({
        error: new Error(
          `Failed to fetch suggestions: ${
            err instanceof Error ? err.message : 'Unknown error'
          }`
        ),
        suggestions: [],
      });
    } finally {
      set({ loading: false, apiCallInProgress: false });

      // Re-trigger if needed
      const currentState = get();
      if (currentState.reTriggerApiCall) {
        set({ reTriggerApiCall: false });
        currentState.fetchSuggestions(transcript, meetingId, orgId, version, employeeId);
      }
    }
  },

  fetchTicketSuggestions: async (
    messageId: string,
    msgs: ConversationMessage[],
    meetingId: string,
    orgId: string,
    aiResponse: string,
    previousIncidentsContext: string | null,
    vvaHandoverSummary: string | null,
    callTranscript: string | null,
    mostCommonResolverGroup: any,
    primaryCache: any,
    userDetails: { user_name?: string; employee_id?: string },
    version = 'v2'
  ) => {
    set({ loadingTicketSuggestions: true });

    try {
      const response = await fetchTicketSuggestionsApi(
        msgs.map(msg => ({ content: msg.content, role: msg.role })),
        meetingId,
        orgId,
        aiResponse,
        previousIncidentsContext,
        vvaHandoverSummary,
        callTranscript,
        mostCommonResolverGroup,
        primaryCache,
        userDetails,
        version
      );

      // Handle response structure - API returns { error: null, data: { create_ticket_suggest: {...}, update_ticket_suggest: {...} } }
      if (response.error) {
        console.error('[SuggestionsStore] Ticket suggestions API error:', response.error);
        set({ loadingTicketSuggestions: false });
        return;
      }

      const responseData = response.data || response;

      // Extract ticket suggestions from response
      // Response structure: { create_ticket_suggest: { suggested_tickets: [...] }, update_ticket_suggest: { suggested_updates: [...] } }
      const createTicketSuggest = responseData.create_ticket_suggest;
      const updateTicketSuggest = responseData.update_ticket_suggest;

      const ticketSuggestions: TicketSuggestions = {
        create_ticket_suggest: createTicketSuggest && 
          createTicketSuggest.suggested_tickets && 
          createTicketSuggest.suggested_tickets.length > 0
          ? {
              suggested_tickets: createTicketSuggest.suggested_tickets,
              total_count: createTicketSuggest.total_count || createTicketSuggest.suggested_tickets.length,
              overall_reasoning: createTicketSuggest.overall_reasoning || '',
              auto_generated: createTicketSuggest.auto_generated !== undefined ? createTicketSuggest.auto_generated : true,
              timestamp: createTicketSuggest.timestamp || new Date().toISOString(),
            }
          : undefined,
        update_ticket_suggest: updateTicketSuggest && 
          updateTicketSuggest.suggested_updates && 
          updateTicketSuggest.suggested_updates.length > 0
          ? {
              suggested_updates: updateTicketSuggest.suggested_updates,
              total_count: updateTicketSuggest.total_count || updateTicketSuggest.suggested_updates.length,
              overall_reasoning: updateTicketSuggest.overall_reasoning || '',
              auto_generated: updateTicketSuggest.auto_generated !== undefined ? updateTicketSuggest.auto_generated : true,
              timestamp: updateTicketSuggest.timestamp || new Date().toISOString(),
            }
          : undefined,
      };

      // Store ticket suggestions in separate state - completely independent from suggestions
      // Suggestions are already shown, ticket suggestions are stored separately
      set((state) => ({
        ticketSuggestions: {
          ...state.ticketSuggestions,
          [messageId]: ticketSuggestions,
        },
      }));
    } catch (err) {
      console.error('[SuggestionsStore] Error fetching ticket suggestions:', err);
    } finally {
      set({ loadingTicketSuggestions: false });
    }
  },

  clearSuggestions: () =>
    set({
      suggestions: [],
      loading: false,
      error: null,
      conversationHistory: [],
      processedTranscript: '',
      apiCallInProgress: false,
      reTriggerApiCall: false,
      ticketSuggestions: {},
      loadingTicketSuggestions: false,
    }),
}));

