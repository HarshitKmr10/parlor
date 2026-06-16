import { Flex, Text, Badge, Box, IconButton, Tabs, BadgeProps, Spinner } from '@radix-ui/themes';
import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import CustomAvatar from 'components/CustomAvatar';
import { formatDate } from 'utils/dateUtils';
import { IoCallOutline } from 'react-icons/io5';
import { CopyIcon } from '@radix-ui/react-icons';
import moment from 'moment';
import { VoiceAgentCalls } from 'api/voiceVirtualAgent';
import PostCallSummary from 'components/postcall/PostCallSummary';
import RealTimeVVATranscript from './RealTimeVVATranscript';
import { useGlobalContext } from 'contexts/store';
import Sentiment from '@/components/voicevirtualagent/Sentiment';
import { serviceDeskInstance } from 'api/common/axiosInstance';
import { useTranslation } from 'react-i18next';

interface TranscriptItem {
  content: string;
  timestamp: string;
  isPartial: boolean;
  role: string;
}

interface VoiceVirtualAgentProps {
  userName: string;
  phoneNumer: string;
  meetingStartTime: string;
  meetingEndTime: string | null;
  transcript: TranscriptItem[];
  selectedCall: VoiceAgentCalls;
  loadingSummary: boolean;
  summary: string;
  ticket_id?: string;
  meeting_id?: string;
}

interface InstanceDetails {
  name: string;
  baseUrl: string;
}
interface ServiceRequest {
  number: string;
  short_description: string;
  description: string;
  state: string;
  priority: string;
  opened_at: string;
  sys_id: string;
  request_state: string;
  stage: string;
  approval: string;
  u_bu_approval: string;
  urgency: string;
  impact: string;
  _instanceDetails: InstanceDetails;
}

interface RITM {
  number: string;
  short_description: string;
  state: string;
  stage: string;
  opened_at: string;
  sys_id: string;
  cat_item?: {
    value: string;
    display_value: string;
  };
  _instanceDetails: InstanceDetails;
}

interface TicketDetails {
  serviceRequest: ServiceRequest;
  ritm: RITM | null;
}

function VoiceVirtualAgentPage({
  userName,
  phoneNumer,
  meetingStartTime,
  meetingEndTime,
  transcript,
  selectedCall,
  loadingSummary,
  summary,
  ticket_id,
  meeting_id,
}: VoiceVirtualAgentProps) {
  const { t } = useTranslation();
  const { user } = useGlobalContext();
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [ticketDetails, setTicketDetails] = useState<TicketDetails | null>(null);
  const [loadingTicket, setLoadingTicket] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('transcript');

  const { organization } = useGlobalContext();

  // Memoize the parsed config to prevent unnecessary re-renders
  const orgConfig = useMemo(() => {
    try {
      return organization?.config ? JSON.parse(organization.config) : null;
    } catch (error) {
      console.error('Error parsing organization config:', error);
      return null;
    }
  }, [organization?.config]);

  useEffect(() => {
    setActiveTab('transcript');
  }, [selectedCall]);

  const fetchTicketDetails = useCallback(async () => {
    if (!ticket_id && !user?.org_id) return;

    setLoadingTicket(true);
    setTicketError(null);

    try {
      const { data } = await serviceDeskInstance.post(`/servicenow/get_service_request`, {
        request_number: ticket_id,
        org_id: user?.org_id,
      });
      setTicketDetails({
        serviceRequest: data.serviceRequest,
        ritm: data.ritm,
      });
    } catch (error: any) {
      setTicketError(
        error?.response?.data?.error ||
          error?.response?.data?.detail ||
          error?.message ||
          t('voice_virtual_agent.failedToFetchTicketDetails'),
      );
    } finally {
      setLoadingTicket(false);
    }
  }, [ticket_id, user?.org_id]);

  useEffect(() => {
    if (ticket_id) {
      fetchTicketDetails();
    }
  }, [activeTab, ticket_id, selectedCall]);

  const scrollToBottom = () => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [transcript]);

  const filteredTranscript = transcript.filter((item, index) => {
    if (index === (transcript?.length || 0) - 1) {
      return item?.content !== '';
    }
    return true;
  });

  const initialDuration = meetingEndTime
    ? moment.duration(moment(meetingEndTime).diff(moment(meetingStartTime)))
    : t('voice_virtual_agent.inProgress');

  const durationStr = moment.isDuration(initialDuration)
    ? `${initialDuration.minutes().toString().padStart(2, '0')}:${initialDuration
        .seconds()
        .toString()
        .padStart(2, '0')}`
    : t('voice_virtual_agent.inProgress');

  const renderTicketContent = () => {
    if (loadingTicket) {
      return (
        <Flex justify="center" align="center" className="h-full">
          <Spinner />
        </Flex>
      );
    }

    if (ticketError) {
      return (
        <Flex justify="center" align="center" className="h-full">
          <Text color="red" size="2">
            {ticketError}
          </Text>
        </Flex>
      );
    }

    if (!ticketDetails) {
      return (
        <Flex justify="center" align="center" className="h-full">
          <Text color="gray" size="2">
            {t('voice_virtual_agent.noTicketDetailsAvailable')}
          </Text>
        </Flex>
      );
    }

    const getBadgeVariant = (
      type: string,
    ): { color: BadgeProps['color']; variant: BadgeProps['variant'] } => {
      switch (type.toLowerCase()) {
        case 'in_process':
          return { color: 'orange', variant: 'soft' };
        case 'approved':
          return { color: 'green', variant: 'soft' };
        case 'rejected':
          return { color: 'red', variant: 'soft' };
        case 'medium':
          return { color: 'blue', variant: 'outline' };
        default:
          return { color: 'gray', variant: 'outline' };
      }
    };

    const openInServiceNow = (item: ServiceRequest | RITM) => {
      const { _instanceDetails, sys_id } = item;
      const { baseUrl } = _instanceDetails;
      const path = item.number.startsWith('RITM') ? 'sc_req_item.do' : 'sc_request.do';

      window.open(`${baseUrl}/nav_to.do?uri=${path}?sys_id=${sys_id}`, '_blank');
    };

    return (
      <Box className="p-4">
        {/* Service Request Details */}
        <Box className="mb-6">
          <div className="mb-4">
            <Text size="5" weight="bold">
              {t('voice_virtual_agent.serviceRequestDetails')}
            </Text>
          </div>

          <Box className="space-y-4">
            <Flex align="start" justify="between">
              <Text weight="bold">{t('voice_virtual_agent.requestNumber')}</Text>
              <Text
                className="cursor-pointer text-blue-600 hover:underline"
                onClick={() => openInServiceNow(ticketDetails.serviceRequest)}
              >
                {ticketDetails.serviceRequest.number}
              </Text>
            </Flex>

            <Flex align="start" justify="between">
              <Text weight="bold">{t('voice_virtual_agent.requestState')}</Text>
              <Badge {...getBadgeVariant(ticketDetails.serviceRequest.request_state)}>
                {ticketDetails.serviceRequest.request_state}
              </Badge>
            </Flex>

            <Flex align="start" justify="between">
              <Text weight="bold">{t('voice_virtual_agent.stage')}</Text>
              <Text>{ticketDetails.serviceRequest.stage}</Text>
            </Flex>

            <Flex align="start" justify="between">
              <Text weight="bold">{t('voice_virtual_agent.priority')}</Text>
              <Badge {...getBadgeVariant('medium')}>Medium</Badge>
            </Flex>

            <Flex align="start" justify="between">
              <Text weight="bold">{t('voice_virtual_agent.approvalStatus')}</Text>
              <Flex gap="2">
                <Badge {...getBadgeVariant(ticketDetails.serviceRequest.approval)}>
                  {ticketDetails.serviceRequest.approval}
                </Badge>
              </Flex>
            </Flex>

            <Box>
              <Text weight="bold" className="mb-1">
                {t('voice_virtual_agent.shortDescription')}
              </Text>
              <Text>{ticketDetails.serviceRequest.short_description}</Text>
            </Box>

            {!!ticketDetails.serviceRequest.description && (
              <Box>
                <Text weight="bold" className="mb-1">
                  {t('voice_virtual_agent.description')}
                </Text>
                <Text>{ticketDetails.serviceRequest.description}</Text>
              </Box>
            )}
          </Box>
        </Box>

        {/* RITM Details */}
        <Box>
          <Text size="5" weight="bold" className="mb-4">
            {t('voice_virtual_agent.requestedItemDetails')}
          </Text>

          {ticketDetails.ritm ? (
            <Box className="space-y-4">
              <Flex align="start" justify="between">
                <Text weight="medium">{t('voice_virtual_agent.ritmNumber')}</Text>
                <Text
                  className="cursor-pointer text-blue-600 hover:underline"
                  onClick={() => openInServiceNow(ticketDetails.ritm)}
                >
                  {ticketDetails.ritm.number}
                </Text>
              </Flex>

              <Flex align="start" justify="between">
                <Text weight="medium">{t('voice_virtual_agent.state')}</Text>
                <Badge {...getBadgeVariant(ticketDetails.ritm.state)}>
                  {ticketDetails.ritm.state.toUpperCase()}
                </Badge>
              </Flex>

              <Flex align="start" justify="between">
                <Text weight="medium">{t('voice_virtual_agent.stage')}</Text>
                <Text>{ticketDetails.ritm.stage}</Text>
              </Flex>

              {ticketDetails.ritm.cat_item && (
                <Flex align="start" justify="between">
                  <Text weight="medium">{t('voice_virtual_agent.catalogItem')}</Text>
                  <Text>{ticketDetails.ritm.cat_item.display_value}</Text>
                </Flex>
              )}

              <Box>
                <Text weight="medium" className="mb-1">
                  {t('voice_virtual_agent.shortDescription')}
                </Text>
                <Text>{ticketDetails.ritm.short_description}</Text>
              </Box>
            </Box>
          ) : (
            <Flex align="center" justify="center" py="6">
              <Text color="gray" size="2">
                {t('voice_virtual_agent.noRitmLinkedToRequest')}
              </Text>
            </Flex>
          )}
        </Box>
      </Box>
    );
  };

  return (
    <Flex direction="column" className="h-full w-full">
      <Box className="flex-shrink-0">
        <Flex
          direction="column"
          align="center"
          justify="center"
          className="h-full w-full items-center border-b border-[var(--gray-8)] bg-[var(--gray-11)]"
          px="4"
          py="4"
          gapX="2"
          gapY="6"
        >
          <Flex gapX="2" className="w-full">
            <CustomAvatar alt="image" src={null} name={userName} />
            <Box className="w-full space-y-1">
              <Flex gapX="2" gapY="7" align="center" justify="between" className="w-full">
                <Flex align="center" gapX="2">
                  <Text as="div" size="2" weight="bold" className="text-white">
                    {userName}
                  </Text>
                  <Flex gapX="1">
                    <IconButton
                      size="1"
                      aria-label="Copy value"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(phoneNumer);
                      }}
                    >
                      <CopyIcon className="text-white" />
                    </IconButton>
                    <Text as="div" size="1" weight="regular" className="text-white">
                      {phoneNumer}
                    </Text>
                  </Flex>
                </Flex>
              </Flex>
              <Flex gapX="2" align="center" className="w-full">
                <Flex gapX="1">
                  <IoCallOutline color="white" />
                  <Text as="div" size="1" weight="regular" className="text-white">
                    {t('voice_virtual_agent.incoming')}
                  </Text>
                </Flex>
                <Text size="1" className="font-bold text-white">
                  {t('voice_virtual_agent.callStarted')}
                </Text>
                <Text size="1" className="text-white">
                  {formatDate(meetingStartTime)}
                </Text>
                <Flex gapX="1">
                  {meetingEndTime ? (
                    <Text as="div" size="1" weight="medium" className="text-white">
                      <span className="font-bold text-white">{t('voice_virtual_agent.duration')} </span>
                      {durationStr}
                    </Text>
                  ) : (
                    <Text as="div" size="1" weight="bold" className="text-white">
                      {t('voice_virtual_agent.ongoing')}
                    </Text>
                  )}
                </Flex>
              </Flex>
            </Box>
          </Flex>
        </Flex>
      </Box>
      <Box className="flex-grow overflow-hidden">
        <Tabs.Root value={activeTab} className="flex h-full flex-col" onValueChange={setActiveTab}>
          <Box className="flex-shrink-0 bg-[var(--color-background)]">
            <Tabs.List>
              <Tabs.Trigger value="transcript">{t('voice_virtual_agent.realtimeTranscript')}</Tabs.Trigger>
              {!orgConfig?.Modules?.voice_virtual_agent?.livekit_summary && (
                <>
                  {selectedCall.status === 'ended' && (
                    <Tabs.Trigger value="summary">{t('voice_virtual_agent.summary')}</Tabs.Trigger>
                  )}
                </>
              )}

              {!!ticket_id && <Tabs.Trigger value="ticket">{t('voice_virtual_agent.ticketDetails')}</Tabs.Trigger>}
              {orgConfig?.Modules?.voice_virtual_agent?.livekit_summary && (
                <Tabs.Trigger value="sentiment">{t('voice_virtual_agent.sentiment')}</Tabs.Trigger>
              )}
            </Tabs.List>
          </Box>
          <Box className="flex-grow overflow-hidden">
            <Tabs.Content
              value="transcript"
              className="h-full overflow-y-auto bg-[var(--color-background)]"
            >
              {filteredTranscript.map((line, index) => (
                <RealTimeVVATranscript
                  key={index}
                  content={line.content}
                  userName={userName}
                  extra={`pt-1 border-b ${line.isPartial ? 'text-gray-400' : ''}`}
                  timestamp={line.timestamp}
                  role={line.role}
                />
              ))}
              <div ref={transcriptEndRef} />
            </Tabs.Content>
            {!orgConfig?.Modules?.voice_virtual_agent?.livekit_summary && (
              <Tabs.Content
                value="summary"
                className="h-full overflow-y-auto bg-[var(--color-background)]"
              >
                <PostCallSummary
                  meetingId={meeting_id}
                  summary={summary}
                  loading={loadingSummary}
                  agentName={t('voice_virtual_agent.voiceVirtualAgent')}
                />
              </Tabs.Content>
            )}
            {orgConfig?.Modules?.voice_virtual_agent?.livekit_summary && (
              <Tabs.Content
                value="sentiment"
                className="h-full overflow-y-auto bg-[var(--color-background)]"
              >
                <Sentiment meetingId={meeting_id} agentName={t('voice_virtual_agent.voiceVirtualAgent')} />
              </Tabs.Content>
            )}

            {!!ticket_id && (
              <Tabs.Content
                value="ticket"
                className="h-full overflow-y-auto bg-[var(--color-background)]"
              >
                {renderTicketContent()}
              </Tabs.Content>
            )}
          </Box>
        </Tabs.Root>
      </Box>
    </Flex>
  );
}

export default VoiceVirtualAgentPage;
