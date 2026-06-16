'use client';

import { parseAnswerToHtml } from 'components/Answer/AnswerParser';
import { getCitationFilePath } from 'api/chat/api';
import SuggestionBox from 'components/common/SuggestionBox';
import { useEffect, useRef, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useGlobalContext } from 'contexts/store';
import { useCopilotStore } from 'store/Copilot';
import { useSuggestionsStore, TicketSuggestion } from 'store/Suggestions';
import { useVoiceAgents } from 'hooks/useVoiceAgents';
import { useOrganizationConfig } from 'hooks/useOrganizationConfig';
import SuggestionsIsLoading from '../SuggestionIsLoading';
import SummaryCard from '@/components/copilot/SummaryCard';
import CreateCopilotTicketModal from '@/components/copilot/CreateCopilotTicketModal';
import { Box, Text } from '@radix-ui/themes';
import { coPilotInstance } from 'api/common/axiosInstance';
import { toast } from 'react-toastify';

interface ServiceNowField {
  display_value: string;
  value: string;
  link?: string;
}

interface ServiceNowTicket {
  short_description: ServiceNowField;
  assignment_group?: ServiceNowField;
  impact: ServiceNowField;
  description: ServiceNowField;
  sys_updated_on: ServiceNowField;
  priority: ServiceNowField;
  sys_id: ServiceNowField;
  number: ServiceNowField;
  urgency: ServiceNowField;
  caller_id: ServiceNowField;
  sys_created_on: ServiceNowField;
  state: ServiceNowField;
  assigned_to: ServiceNowField;
  category?: ServiceNowField;
  work_notes?: ServiceNowField;
}

interface GetTicketByNumberResponse {
  success: boolean;
  ticket: ServiceNowTicket;
  message: string;
}

interface SuggestionsProps {
  setActiveCitation: (citation: string) => void;
  setShowCitation: (show: boolean) => void;
  app_id: string;
  moduleName?: string;
}

const Suggestions = ({
  setActiveCitation,
  setShowCitation,
  app_id,
  moduleName = 'Voice Co-Resolve',
}: SuggestionsProps) => {
  const searchParams = useSearchParams();
  const meeting_id = searchParams.get('meetingId');
  const { user, organization } = useGlobalContext();
  const { config } = useOrganizationConfig();
  
  // Check if ticket integration is enabled
  const isTicketIntegrationEnabled = config?.ticketIntegrationEnabled || false;
  
  // Modal state for ticket creation
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [ticketCreatedOrUpdated, setTicketCreatedOrUpdated] = useState(false);
  
  // Modal state for VVA ticket viewing
  const [isVVATicketModalOpen, setIsVVATicketModalOpen] = useState(false);
  const [vvaTicketData, setVvaTicketData] = useState<ServiceNowTicket | null>(null);
  const [isLoadingVVATicket, setIsLoadingVVATicket] = useState(false);
  
  // Get data from stores
  const meeting = useCopilotStore((state) => state.meeting);
  const userDetails = useCopilotStore((state) => state.userDetails);
  
  // Get suggestions from store (managed by useWebSocketConnection)
  const suggestions = useSuggestionsStore((state) => state.suggestions);
  const loading = useSuggestionsStore((state) => state.loading);
  const loadingTicketSuggestions = useSuggestionsStore((state) => state.loadingTicketSuggestions);
  const ticketSuggestionsMap = useSuggestionsStore((state) => state.ticketSuggestions);
  
  // Fetch VVA summary
  const { vvaSummary } = useVoiceAgents(
    user,
    meeting,
    meeting_id,
    organization ? JSON.parse(organization.config) : undefined,
  );
  const VVASummary = {
    answer: vvaSummary,
    question: 'Voice Virtual Agent Summary',
    citations: [],
  };
  
  const capitalizeFirst = (value?: string) =>
    value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
  
  // Get the latest ticket suggestion from the separate ticketSuggestions state
  // This is completely independent from the suggestions array
  const latestTicketSuggestion = useMemo(() => {
    // Get all messageIds from suggestions (to find the most recent one with ticket suggestions)
    const messageIds = suggestions.map(s => s.messageId);
    
    // Iterate backwards through messageIds to find the most recent one with ticket suggestions
    for (let i = messageIds.length - 1; i >= 0; i--) {
      const messageId = messageIds[i];
      const ticketSuggestion = ticketSuggestionsMap[messageId];
      
      if (!ticketSuggestion) continue;

      // Check for update ticket suggestions first
      if (
        ticketSuggestion.update_ticket_suggest &&
        ticketSuggestion.update_ticket_suggest.suggested_updates &&
        ticketSuggestion.update_ticket_suggest.suggested_updates.length > 0
      ) {
        return { 
          ticketSuggestion, 
          type: 'update' as const,
          messageId 
        };
      }
      
      // Check for create ticket suggestions
      if (
        ticketSuggestion.create_ticket_suggest &&
        ticketSuggestion.create_ticket_suggest.suggested_tickets &&
        ticketSuggestion.create_ticket_suggest.suggested_tickets.length > 0
      ) {
        return { 
          ticketSuggestion, 
          type: 'create' as const,
          messageId 
        };
      }
    }
    return null;
  }, [suggestions, ticketSuggestionsMap]);

  // Get the last ticket from create_ticket_suggest or update_ticket_suggest
  const lastTicketSuggestion = useMemo<TicketSuggestion | null>(() => {
    if (!latestTicketSuggestion) return null;
    
    if (latestTicketSuggestion.type === 'create') {
      const tickets = latestTicketSuggestion.ticketSuggestion.create_ticket_suggest?.suggested_tickets;
      return tickets && tickets.length > 0 ? tickets[tickets.length - 1] : null;
    }
    
    if (latestTicketSuggestion.type === 'update') {
      const updates = latestTicketSuggestion.ticketSuggestion.update_ticket_suggest?.suggested_updates;
      return updates && updates.length > 0 ? updates[updates.length - 1] : null;
    }
    
    return null;
  }, [latestTicketSuggestion]);

  // Reset ticket created/updated state when new ticket suggestions arrive
  useEffect(() => {
    if (latestTicketSuggestion) {
      setTicketCreatedOrUpdated(false);
    }
  }, [latestTicketSuggestion]);

  // Handle ticket creation callback
  const handleTicketCreatedUpdated = (created: boolean) => {
    if (created) {
      setTicketCreatedOrUpdated(true);
    }
  };

  // Handle ticket update - show toast and update state
  const handleTicketUpdated = () => {
    toast.success('Ticket updated successfully!');
    setTicketCreatedOrUpdated(true);
  };
  
  const suggestionRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = () => {
    suggestionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [suggestions]);

  // Parse VVA summary JSON to extract structured data for SummaryCard
  const parsedVVASummary = useMemo(() => {
    if (!vvaSummary || vvaSummary.length === 0) return null;
    
    try {
      // The vvaSummary might be a JSON string or already parsed
      const summaryData = typeof vvaSummary === 'string' ? JSON.parse(vvaSummary) : vvaSummary;

      
      
      // Check if it has the expected structure from voice_virtual_agent_calls.summary
      if (summaryData.issue_summary) {
        return {
          title: 'VVA Call Summary',
          summary: summaryData.issue_summary,
          description: summaryData.customer_details || summaryData.issue_summary,
          category: 'Voice Call',
          sentiment: summaryData.sentiment || 'Neutral',
          ticket_number: summaryData.ticket_number,
        };
      }
      
      // If summaryData is just a plain object without issue_summary, try to use it directly
      if (typeof summaryData === 'object' && summaryData !== null) {
        console.log('[Suggestions] VVA summary does not have expected structure:', Object.keys(summaryData));
      }
    } catch (error) {
      console.log('[Suggestions] Could not parse VVA summary as JSON:', error);
      console.log('[Suggestions] Raw vvaSummary:', vvaSummary.substring(0, 200));
    }
    
    return null;
  }, [vvaSummary]);

  const normalizeTicketNumber = (input: unknown): string => {
    if (typeof input !== 'string') return '';
    const trimmed = input.trim();
    if (!trimmed) return '';

    // If multiple tickets are present, pick the first (e.g. "INC001, INC002")
    const firstToken = trimmed.split(', ')[0]?.trim() ?? '';

    // If it looks like a char-comma separated string ("I,N,C,0,0,0"), remove commas
    if (firstToken.includes(',') && !firstToken.includes(', ')) {
      return firstToken.replace(/,/g, '').replace(/\s+/g, '');
    }

    return firstToken;
  };

  // Fetch ticket by number
  const fetchTicketByNumber = async (ticketNumber: string) => {
    const normalizedTicketNumber = normalizeTicketNumber(ticketNumber);

    if (!normalizedTicketNumber) {
      toast.error('Ticket number is required');
      return;
    }

    setIsLoadingVVATicket(true);
    try {
      const response = await coPilotInstance.post<GetTicketByNumberResponse>('/api/users/get-ticket-by-number', {
        ticket_number: normalizedTicketNumber,
        phone_number: meeting?.phone_number || null,
        user_sys_id: userDetails?.employeeId || null,
      });

      if (response.data?.success && response.data?.ticket) {
        setVvaTicketData(response.data.ticket);
        setIsVVATicketModalOpen(true);
      } else {
        toast.error(response.data?.message || 'Ticket not found');
      }
    } catch (error: any) {
      console.error('[Suggestions] Error fetching ticket:', error);
      const errorMessage = error?.response?.data?.message || error?.response?.data?.detail || 'Failed to fetch ticket details';
      toast.error(errorMessage);
    } finally {
      setIsLoadingVVATicket(false);
    }
  };

  // Handle VVA ticket view click
  const handleViewVVATicket = () => {
    if (parsedVVASummary?.ticket_number) {
      fetchTicketByNumber(parsedVVASummary.ticket_number);
    } else {
      toast.error('Ticket number not available');
    }
  };

  return (
    <div className="w-full pr-2 h-full">
      {/* VVA Summary Card - Show for Genesys calls with structured summary */}
      {parsedVVASummary && (
        <Box className="mb-4 p-2">
          <SummaryCard
            title={parsedVVASummary.title}
            summary={parsedVVASummary.summary}
            description={parsedVVASummary.description}
            category={parsedVVASummary.category}
            onViewTicket={handleViewVVATicket}
            ticketAction={isTicketIntegrationEnabled && parsedVVASummary?.ticket_number ? 'view' : ""}
            isLoading={isLoadingVVATicket}
          />
        </Box>
      )}
      
      {/* Legacy VVA Summary Box - Fallback for non-structured summaries */}
      {vvaSummary.length > 0 && !parsedVVASummary && (
        <SuggestionBox
          key="vva"
          moduleName={moduleName}
          suggestion={VVASummary}
          getCitationFilePath={getCitationFilePath}
          setShowCitation={setShowCitation}
          parseAnswerToHtml={parseAnswerToHtml}
          setActiveCitation={setActiveCitation}
          session_id={meeting_id}
          app_id={"vva_suumary"}
        />
      )}

      {/* Show suggestions immediately - they are decoupled from ticket suggestions */}
      {suggestions.map((suggestion, index) => (
        <SuggestionBox
          key={index}
          moduleName={moduleName}
          suggestion={suggestion}
          getCitationFilePath={getCitationFilePath}
          setShowCitation={setShowCitation}
          parseAnswerToHtml={parseAnswerToHtml}
          setActiveCitation={setActiveCitation}
          session_id={meeting_id}
          app_id={app_id}
        />
      ))}

      {/* Ticket Recommendation Card - Only show if ticket suggestions exist */}
      {/* This is completely decoupled from the suggestions above */}
      {latestTicketSuggestion && lastTicketSuggestion && !ticketCreatedOrUpdated && (
        <Box className="mt-4 p-4 border-t-1 border-coolGrey-200">
          <SummaryCard
            title={lastTicketSuggestion.title}
            summary={
              latestTicketSuggestion.type === 'update' && 'work_notes' in lastTicketSuggestion
                ? lastTicketSuggestion.work_notes || lastTicketSuggestion.title
                : lastTicketSuggestion.description || lastTicketSuggestion.title
            }
            category={capitalizeFirst(lastTicketSuggestion.category)}
            onViewTicket={() => {
              setIsTicketModalOpen(true);
            }}
            ticketAction={isTicketIntegrationEnabled ? latestTicketSuggestion.type : ''}
          />
        </Box>
      )}

      {/* Show loading indicator for ticket suggestions (only if we have suggestions but no ticket suggestions yet) */}
      {suggestions.length > 0 && loadingTicketSuggestions && !latestTicketSuggestion && (
        <Box className="mt-4 p-4 border-t-1 border-coolGrey-200">
          <Text size="2" color="gray" className="text-center">
            Checking for ticket recommendations...
          </Text>
        </Box>
      )}

      <SuggestionsIsLoading loading={loading} />
      <div ref={suggestionRef} />

      {/* Ticket Creation/Update Modal */}
      {isTicketIntegrationEnabled && latestTicketSuggestion && lastTicketSuggestion && (
        <CreateCopilotTicketModal
          open={isTicketModalOpen}
          setOpen={setIsTicketModalOpen}
          meetingId={meeting_id || ''}
          prefilledTitle={lastTicketSuggestion.title}
          prefilledDescription={
            latestTicketSuggestion.type === 'update' && 'work_notes' in lastTicketSuggestion
              ? lastTicketSuggestion.description || lastTicketSuggestion.work_notes || lastTicketSuggestion.title
              : lastTicketSuggestion.description || ''
          }
          prefilledCategory={lastTicketSuggestion.category}
          prefilledPriority={lastTicketSuggestion.priority?.toString()}
          prefilledUrgency={lastTicketSuggestion.urgency?.toString()}
          prefilledImpact={lastTicketSuggestion.impact?.toString()}
          prefilledWorkNotes={
            latestTicketSuggestion.type === 'update' && 'work_notes' in lastTicketSuggestion
              ? lastTicketSuggestion.work_notes
              : undefined
          }
          ticketNumber={
            latestTicketSuggestion.type === 'update' && 'ticket_number' in lastTicketSuggestion
              ? lastTicketSuggestion.ticket_number
              : undefined
          }
          ticketCreatedUpdated={handleTicketCreatedUpdated}
          onTicketUpdated={handleTicketUpdated}
        />
      )}

      {/* VVA Ticket View Modal */}
      {isTicketIntegrationEnabled && parsedVVASummary && vvaTicketData && (
        <CreateCopilotTicketModal
          open={isVVATicketModalOpen}
          setOpen={setIsVVATicketModalOpen}
          meetingId={meeting_id || ''}
          prefilledTitle={vvaTicketData.short_description?.display_value || parsedVVASummary.title}
          prefilledDescription={vvaTicketData.description?.display_value || parsedVVASummary.description}
          prefilledCategory={vvaTicketData.category?.display_value || parsedVVASummary.category}
          prefilledPriority={vvaTicketData.priority?.value}
          prefilledUrgency={vvaTicketData.urgency?.value}
          prefilledImpact={vvaTicketData.impact?.value}
          prefilledWorkNotes={vvaTicketData.work_notes?.display_value}
          viewOnly={true}
          ticketNumber={vvaTicketData.number?.display_value || parsedVVASummary.ticket_number}
        />
      )}
    </div>
  );
};

export default Suggestions;
