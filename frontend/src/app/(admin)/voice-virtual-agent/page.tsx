'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

import withAuth from 'components/withAuth';
import { API } from 'api';
import VoiceVirtualCallList from 'components/voicevirtualagent/VoiceVirtualCallList';
import { VoiceAgentCalls, VoiceAgents, VoiceAgentsTranscript } from 'api/voiceVirtualAgent';
import { useGlobalContext } from 'contexts/store';
import NoDataIcon from 'components/icons/NoDataIcon';
import { getVVASummaryFilePath } from 'api/chat/api';
import { Flex, Box, Text } from '@radix-ui/themes';
import VoiceVirtualAgentPage from './VoiceVirtualAgentPage';
import { useWebSocketToken } from 'hooks/useWebSocketToken';
import { useTranslation } from 'react-i18next';

function SelectCallScreen() {
  const { t } = useTranslation();
  return (
    <Box className="h-full px-2">
      <Flex direction="column" gapY="2" height="100%" justify="center" align="center">
        <NoDataIcon />
        <Text size="1" align="center" className="text-balance text-gray-700">
          {t('voice_virtual_agent.pleaseSelectCallToProceed')}
        </Text>
      </Flex>
    </Box>
  );
}
const COPILOT_SERVER_WS_URL = `${process.env.NEXT_PUBLIC_FRONTEND_IP}`;

function VoiceVirtualCall() {
  const { t } = useTranslation();
  const [voiceAgents, setVoiceAgents] = useState<VoiceAgents[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<VoiceAgents | null>(null);
  const selectedAgentRef = useRef<VoiceAgents | null>(null);
  const selectedCallRef = useRef<VoiceAgentCalls | null>(null);
  const [calls, setCalls] = useState<VoiceAgentCalls[]>([]);
  const [selectedCall, setSelectedCall] = useState<VoiceAgentCalls>(null);
  const [websocket, setWebsocket] = useState(null);
  const [websocketText, setWebsocketText] = useState([]);
  const [summary, setSummary] = useState('');
  const intervalRef = useRef(null);
  const { user, organization } = useGlobalContext();
  const { token } = useWebSocketToken(selectedCall?.id);

  const fetchCalls = useCallback(async () => {
    try {
      const fetchedCalls = await API.VoiceVirtualCalls.GetCalls(user.org_id, user?.access_token);
      const fetchedVoiceAgents = await API.VoiceVirtualCalls.GetAgents(
        user.org_id,
        user?.access_token,
      );
      setVoiceAgents(fetchedVoiceAgents);
      setCalls(fetchedCalls);

      if (fetchedVoiceAgents.length > 0 && !selectedAgentRef.current) {
        setSelectedAgent(fetchedVoiceAgents[0]);
      }

      // Check if there's a selected call and update it if necessary
      if (selectedCallRef.current) {
        const updatedCall = fetchedCalls.find((call) => call.id === selectedCallRef.current.id);
        if (updatedCall) {
          // Compare the current selected call with the updated one
          if (JSON.stringify(selectedCallRef.current) !== JSON.stringify(updatedCall)) {
            // Update the ref and state only if there's a change
            selectedCallRef.current = updatedCall;
            setSelectedCall(updatedCall);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch calls:', error);
    }
  }, [user?.access_token, user?.org_id]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  useEffect(() => {
    if (selectedCall?.status === 'ongoing') {
      return undefined;
    }

    const intervalId = setInterval(() => {
      fetchCalls();
    }, 10000);

    return () => clearInterval(intervalId);
  }, [fetchCalls, selectedCall?.status]);

  useEffect(() => {
    if (selectedCall) {
      fetchCalls();
    }
  }, [fetchCalls, selectedCall?.id]);

  const firstItemTimestampRef = useRef(null);
  const handleWebsocketMessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.meeting_ended === 'True') {
      clearInterval(intervalRef.current);
      return;
    }
    data.forEach((item, index) => {
      const content = item.content || {};
      const text = content.text || '';
      const currentItemTimestamp = new Date(item.created_at).getTime();

      if (firstItemTimestampRef.current === null) {
        firstItemTimestampRef.current = currentItemTimestamp; // Store the first item's timestamp
      }
      const timeDifference = (currentItemTimestamp - firstItemTimestampRef.current) / 1000;
      const minutes = Math.floor(timeDifference / 60)
        .toString()
        .padStart(2, '0');
      const seconds = Math.floor(timeDifference % 60)
        .toString()
        .padStart(2, '0');
      const timestamp = `${minutes}:${seconds}`;

      if (item?.content?.message_type === 'FinalTranscript') {
        setWebsocketText((prevText) => {
          const newText = prevText.filter((prevItem) => !prevItem.isPartial);
          return [
            ...newText,
            {
              content: text,
              timestamp,
              isPartial: false,
              role: item.role,
            },
          ];
        });
      } else {
        const newPartialTranscript = {
          content: text,
          timestamp,
          isPartial: true,
          role: item.role,
        };

        setWebsocketText((prevText) => {
          const newText = prevText.filter((prevItem) => !prevItem.isPartial);
          return [...newText, newPartialTranscript];
        });
      }
    });
  };

  useEffect(() => {
    const fetchMeetingDetailsAndSetupWebSocket = async () => {
      try {
        let wsUri = '';

        if (selectedCall?.status === 'ongoing' && token) { // Add token check
          if (selectedCall) {
            wsUri = `${COPILOT_SERVER_WS_URL}/service_desk/${selectedCall.id}/real_time_transcript?token=${token}&user_id=${user.id}`;
          } else {
            console.error(
              'Required parameters for establishing a WebSocket connection are missing.',
            );
          }

          setWebsocketText([]);
          if (websocket) {
            websocket.close();
            setWebsocket(null);
          }

          const newWebsocket = new WebSocket(wsUri);
          newWebsocket.onmessage = handleWebsocketMessage;
          // newWebsocket.onopen = () => {
          //   console.log("WebSocket connection established:", wsUri);
          // };
          newWebsocket.onerror = (error) => {
            // console.error('WebSocket Error:', error);
          };
          setWebsocket(newWebsocket);
        } else if (selectedCall && selectedCall.status !== 'ongoing') {
          setWebsocketText([]);
          if (websocket) {
            websocket.close();
            setWebsocket(null);
          }

          const VVATranscript: VoiceAgentsTranscript[] = await API.VoiceVirtualCalls.GetTranscripts(
            selectedCall.id,
            user?.access_token,
          );

          VVATranscript.sort(
            (a: VoiceAgentsTranscript, b: VoiceAgentsTranscript) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
          );

          VVATranscript.forEach((item) => {
            if (item.content?.message_type === 'FinalTranscript') {
              const content = item.content || {};
              const text = content.text || '';

              const currentItemTimestamp = new Date(item.created_at).getTime();

              if (firstItemTimestampRef.current === null) {
                firstItemTimestampRef.current = currentItemTimestamp;
              }

              const timeDifference = (currentItemTimestamp - firstItemTimestampRef.current) / 1000;
              const minutes = Math.floor(timeDifference / 60)
                .toString()
                .padStart(2, '0');
              const seconds = Math.floor(timeDifference % 60)
                .toString()
                .padStart(2, '0');
              const timestamp = `${minutes}:${seconds}`;

              setWebsocketText((prevText) => {
                const newText = prevText.filter((prevItem) => !prevItem.isPartial);
                return [
                  ...newText,
                  {
                    content: text,
                    timestamp,
                    isPartial: false,
                    role: item.role,
                  },
                ];
              });
            }
          });
        }
      } catch (error) {
        console.error('Error establishing WebSocket connection or fetching transcript:', error);
      }
    };

    fetchMeetingDetailsAndSetupWebSocket();

    return () => {
      if (websocket) {
        websocket.close();
        setWebsocketText([]);
      }
    };
  }, [selectedCall, token, user]);

  const generateVVASummary = async (transcript: string, userName: string) => {
    try {
      const ticketDetails = [];
      // First, fetch all ticket details
      for (const ticketId of selectedCall.incident_ticket_ids) {
        const response = await fetch(`${process.env.NEXT_PUBLIC_FRONTEND_IP}/servicenow/get_incident`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            incidentNumber: ticketId,
            org_id: user.org_id
          })
        });

        const data = await response.json();
        console.log('~Data: ', data);
        if (data.incident) {
          ticketDetails.push(data.incident);
        }
      }
      console.log('~Ticket Details: ', ticketDetails);

      // Then, generate the summary with all ticket details
      const summaryResponse = await fetch('/api/create-vva-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, userName, ticketDetails }),
      });

      if (!summaryResponse.ok) {
        console.error('Failed to fetch from /api/create-vva-summary');
        return null;
      }

      const summaryData = await summaryResponse.json();

      if (summaryData.response) {
        return summaryData.response;
      }
      console.error('API response does not contain expected `response` field:', summaryData);
      return null;
    } catch (error) {
      console.error('Error generating VVA summary:', error);
      return null;
    }
  };

  useEffect(() => {
    // Define the async function inside the useEffect
    const fetchSummary = async () => {
      setSummary('');
      if (selectedCall && selectedCall.status === 'ended') {
        try {
          // Check if livekit_summary is enabled in organization config
          const orgConfig = JSON.parse(organization?.config || '{}');
          const isLivekitSummaryEnabled = orgConfig.Modules?.voice_virtual_agent?.livekit_summary;

          if (isLivekitSummaryEnabled) {
            // Use the new backend endpoint for livekit_summary=true
            try {
              const summaryResponse = await API.VoiceVirtualCalls.GetSummaryAndSentiment(
                selectedCall.id,
                user?.access_token,
              );

              if ('summary' in summaryResponse) {
                setSummary(summaryResponse.summary);
              } else {
                console.log('No summary data available in database, using frontend method:', summaryResponse.message);
                // Fallback to existing method when summary is empty
                await fetchSummaryWithExistingMethod();
              }
            } catch (error) {
              console.error('Failed to fetch summary from backend endpoint:', error);
              // Fallback to existing method
              await fetchSummaryWithExistingMethod();
            }
          } else {
            // Use existing method for livekit_summary=false
            await fetchSummaryWithExistingMethod();
          }
        } catch (error) {
          console.error('Failed to fetch call summary:', error);
        }
      }
    };

    // Helper function for existing summary generation method
    const fetchSummaryWithExistingMethod = async () => {
      try {
        const response = await getVVASummaryFilePath(selectedCall.id);
        const result = response.data;

        if (result.content && result.content.transcript) {
          const { user_name: userName } = selectedCall;
          const generatedSummary = await generateVVASummary(result.content.transcript, userName);
          setSummary(generatedSummary);
        } else {
          console.error('Summary not found in the response.');
        }
      } catch (error) {
        console.error('Failed to fetch call summary with existing method:', error);
      }
    };

    fetchSummary();
  }, [selectedCall, organization]);
  const handleAgentChange = useCallback((agent: VoiceAgents) => {
    setSelectedAgent(agent);
    selectedAgentRef.current = agent; // Update the ref when agent is changed
  }, []);

  const handleSelectCall = (call: VoiceAgentCalls) => {
    setSelectedCall(call);
    selectedCallRef.current = call;
  };

  return (
    <Flex direction="column" className="h-full">
      <Box className="flex-shrink-0">
        <Flex
          align="center"
          justify="between"
          className="h-14 border-b border-[var(--gray-8)]"
          px="4"
        >
          <Text size="4" weight="medium">
            {JSON.parse(organization?.config || '{}').Modules?.voice_virtual_agent?.name ??
              t('voice_virtual_agent.voiceVirtualAgent')}
          </Text>
        </Flex>
      </Box>
      <Flex className="flex-grow overflow-hidden">
        <Box className="w-1/4">
          <VoiceVirtualCallList
            calls={calls}
            onSelect={handleSelectCall}
            voiceAgents={voiceAgents}
            selectedAgent={selectedAgent}
            onAgentChange={handleAgentChange}
          />
        </Box>
        <Box className="w-3/4 flex-grow overflow-hidden">
          {selectedCall === null ? (
            <SelectCallScreen />
          ) : (
            <VoiceVirtualAgentPage
              userName={selectedCall.user_name}
              phoneNumer={selectedCall.caller}
              meetingStartTime={selectedCall.created_at}
              meetingEndTime={selectedCall.ended_at}
              ticket_id={selectedCall.ticket_id}
              meeting_id={selectedCall?.id}
              transcript={websocketText}
              selectedCall={selectedCall}
              loadingSummary={summary === null || summary?.length === 0}
              summary={summary || ''}
            />
          )}
        </Box>
      </Flex>
    </Flex>
  );
}

export default withAuth(VoiceVirtualCall);
