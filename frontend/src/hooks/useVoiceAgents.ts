import { getVVASummaryFilePath } from 'api/chat/api';
import { useState, useEffect } from 'react';
import { API } from 'api'; // Assuming this is your API module
import { UserType } from 'types/common';
import { Meeting } from 'types/meetingTypes';
import { VoiceAgentCalls } from 'api/voiceVirtualAgent';

interface MeetingWithCalls {
  meeting: any;
  voice_calls: VoiceAgentCalls[];
  voice_calls_count: number;
}

interface UseVoiceAgentsResult {
  vvaSummary: string;
  vvaTranscript: string;
  isHumanTransferredCall: boolean;
}

export function useVoiceAgents(user: UserType, meetingData: Meeting, meetingId: string, organizationConfig?: any,): UseVoiceAgentsResult {
  const [vvaSummary, setVvaSummary] = useState<string>('');
  const [vvaTranscript, setVvaTranscript] = useState<string>('');
  const [isHumanTransferredCall, setIsHumanTransferredCall] = useState<boolean>(false);
  const [processedCallId, setProcessedCallId] = useState<string | null>(null);

  const generateVVASummary = async (transcript: string, userName: string) => {
    try {
      const response = await fetch('/api/create-vva-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, userName, ticketDetails: [] }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch from /api/create-vva-summary');
      }

      const data = await response.json();

      if (data.response) {
        return data.response;
      }
      console.error('~API response does not contain expected `response` field:', data);
      return null;
    } catch (error) {
      console.error('~Error generating VVA summary:', error);
      return null;
    }
  };

  // Helper function for existing summary generation method
  const processWithExistingMethod = async (transferredCall: VoiceAgentCalls) => {
    const response = await getVVASummaryFilePath(transferredCall.id);
    const callDetails = response.data.content;

    const { transcript } = callDetails;
    const { user_name: name } = transferredCall;
    setVvaTranscript(transcript);

    
    // Generate summary
    const summary = await generateVVASummary(transcript, name);
    if (summary) {
      setVvaSummary(summary);
      // setProcessedCallId(transferredCall.id); // Mark this call as processed
    } else {
      console.log();
    }
    setIsHumanTransferredCall(true);
  };

  useEffect(() => {
    const getVoiceAgents = async (): Promise<boolean> => {
      if (meetingData?.channel === 'Phone' && meetingData?.phone_number) {
        try {
          // Use the new targeted API to get meeting with associated voice calls
          const meetingWithCalls: MeetingWithCalls = await API.Meetings.GetCallsByMeetingById(
            meetingId,
            user,
          );

          if (!meetingWithCalls || !meetingWithCalls.voice_calls) {
            return false;
          }

          
          // Find the transferred call directly from the voice calls
          const transferredCall = meetingWithCalls.voice_calls.find(
            (call: VoiceAgentCalls) => call.ended_reason === 'assistant-forwarded-call',
          );

          if (transferredCall) {
            try {
              // Check if summary is already available in the transferredCall object (from vcp_meeting_by_id)
              if (transferredCall.summary) {
                
                // Update summary with actual ticket_id if available
                let updatedSummary = transferredCall.summary;
                try {
                  const summaryData = typeof transferredCall.summary === 'string' 
                    ? JSON.parse(transferredCall.summary) 
                    : transferredCall.summary;

                  const ticketIds: string[] = [];

                  if (transferredCall.ticket_id && typeof transferredCall.ticket_id === 'string') {
                    ticketIds.push(transferredCall.ticket_id);
                  }

                    // Check incident_ticket_ids array
                  if (ticketIds.length === 0 && transferredCall.incident_ticket_ids && Array.isArray(transferredCall.incident_ticket_ids)) {
                    ticketIds.push(...transferredCall.incident_ticket_ids);
                  }

                  const uniqueTicketIds = [...new Set(ticketIds)].filter(id => id && id.trim().length > 0);

                  console.log('[useVoiceAgents] ticket extraction', {
                    callId: transferredCall.id,
                    ticket_id: transferredCall.ticket_id,
                    incident_ticket_ids: transferredCall.incident_ticket_ids,
                    ticketIds,
                    uniqueTicketIds,
                    existingTicketNumber: summaryData?.ticket_number,
                  });

                  if (uniqueTicketIds.length >= 1) {
                    summaryData.ticket_number = uniqueTicketIds[0];
                    console.log('[useVoiceAgents] ticket_number set from ids', {
                      callId: transferredCall.id,
                      ticket_number: summaryData.ticket_number,
                    });
                  } else {
                    summaryData.ticket_number = null;
                    console.log('[useVoiceAgents] ticket_number cleared (no ids)', {
                      callId: transferredCall.id,
                    });
                  }

                  updatedSummary = JSON.stringify(summaryData);
                } catch (error) {
                  console.error('[useVoiceAgents] Error updating summary with ticket_id:', error);
                  // Continue with original summary if update fails
                }
                
                setVvaSummary(updatedSummary);
                setIsHumanTransferredCall(true);
                setProcessedCallId(transferredCall.id);
                return true;
              }
              
              // Fallback: Check if livekit_summary is enabled in organization config
              const isLivekitSummaryEnabled = organizationConfig?.Modules?.voice_virtual_agent?.livekit_summary;

              if (isLivekitSummaryEnabled) {
                // Use the backend endpoint as fallback if summary not in transferredCall
                try {
                  const summaryResponse = await API.VoiceVirtualCalls.GetSummaryAndSentiment(
                    transferredCall.id,
                    user?.access_token,
                  );

                  if ('summary' in summaryResponse) {
                    // Set summary from livekit response
                    setVvaSummary(summaryResponse.summary);
                    setIsHumanTransferredCall(true);
                    setProcessedCallId(transferredCall.id);
                    // return true;
                  } else {
                    // Fallback to existing method when summary is empty
                    await processWithExistingMethod(transferredCall);
                  }
                } catch (error) {
                  console.error('Failed to fetch summary from backend endpoint:', error);
                  // Fallback to existing method
                  await processWithExistingMethod(transferredCall);
                }
              } else {
                // Use existing method for livekit_summary=false
                await processWithExistingMethod(transferredCall);
              }
              return true;
            } catch (error) {
              console.error('Error processing transferred call:', error);
              return false;
            }
          }
        } catch (error) {
          console.error(`Error fetching voice agents: ${error}`);
        }
      } else {
        console.log();
      }
      return false;
    };

    const attemptGetVoiceAgents = async (attemptsLeft: number): Promise<void> => {
      if (attemptsLeft <= 0) {
        return;
      }

      const success = await getVoiceAgents();
      if (!success) {
        setTimeout(() => attemptGetVoiceAgents(attemptsLeft - 1), 2000);
      }
    };

    if (meetingData) {
      attemptGetVoiceAgents(4);
    }
  }, [user, meetingData, meetingId]);

  return { vvaSummary, vvaTranscript, isHumanTransferredCall };
}
