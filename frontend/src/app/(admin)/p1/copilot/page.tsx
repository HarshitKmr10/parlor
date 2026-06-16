'use client';

import React, { useState, Suspense } from 'react';
import 'react-toastify/dist/ReactToastify.css';
import {
  Box, Flex, Tabs, Text,
} from '@radix-ui/themes';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';

import Spinner from 'components/spinner/spinner';
import withAuth from 'components/withAuth';
import useP1MeetingDetails from 'hooks/useP1MeetingDetails';
import useP1Suggestions from 'hooks/useP1Suggestions';
import useWebSocket from 'hooks/useWebSocket'; // Import the shared useWebSocket hook
import useMeetingDuration from 'hooks/useMeetingDuration';
import { useOrganizationConfig } from 'hooks/useOrganizationConfig';
import useUserAndRelatedData from 'hooks/useUserAndRelatedData';
import { useGlobalContext } from 'contexts/store';

const PDFModal = dynamic(() => import('components/Modals/PDFModal'), {
  loading: () => <Spinner />,
});
const IntakeChat = dynamic(() => import('components/copilot/IntakeChat'), {
  loading: () => <Spinner />,
});
const CopilotPage = dynamic(() => import('components/copilot/CopilotPage'), {
  loading: () => <Spinner />,
});
const CopilotSuggest = dynamic(
  () => import('components/copilot/CopilotSuggest'),
  {
    loading: () => <Spinner />,
  },
);

function P1Copilot() {
  const searchParams = useSearchParams();
  const meetingId = searchParams.get('meetingId');
  const [selectedTab, setSelectedTab] = useState('suggestedResponse');
  const [activeCitation, setActiveCitation] = useState('');
  const [showCitation, setShowCitation] = useState(false);
  const [status, setStatus] = useState(null);
  const { organization } = useGlobalContext();

  const {
    config,
    loading: configLoading,
    error: configError,
  } = useOrganizationConfig();
  const { isUserLoading, meeting, error: userError } = useUserAndRelatedData(
    meetingId,
    config?.ticketingSystem || '',
    config?.endpointManagement || false,
    config?.endpointSystem || '',
    false,
    false,
  );

  const {
    websocketText,
    unformattedWebsocketText,
    error: websocketError,
  } = useWebSocket(meetingId, meeting, null);
  const duration = useMeetingDuration(meeting, status);
  const {
    suggestions,
    loading: suggestionsLoading,
    error: suggestionsError,
  } = useP1Suggestions(unformattedWebsocketText, meetingId);

  const errors = [
    configError,
    userError,
    websocketError,
    suggestionsError,
  ].filter(Boolean);
  if (errors.length > 0) {
    throw errors[0];
  }
  if (configLoading || isUserLoading) {
    return <Spinner />;
  }

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
            {JSON.parse(organization?.config || '{}').Modules?.p1_copilot
              ?.name ?? 'P1 Co-Resolve'}
          </Text>
        </Flex>
      </Box>
      <Flex className="flex-grow overflow-hidden">
        <Box className="w-1/3">
          <Suspense fallback={<Spinner />}>
            <CopilotPage
              userDetails={{
                fullName: '',
                mobilePhone: '',
                email: '',
                employeeId: '',
              }}
              duration={duration}
              meeting={meeting}
              transcript={websocketText}
              setStatus={setStatus}
              type="P1"
            />
          </Suspense>
        </Box>

        <Box className="w-2/3 min-w-64 border-l border-[var(--gray-8)] flex flex-col">
          <Tabs.Root
            value={selectedTab}
            onValueChange={setSelectedTab}
            className="flex flex-col h-full"
          >
            <Tabs.List className="flex-shrink-0">
              <Tabs.Trigger value="suggestedResponse">
                <Text size="1">AI Suggestions</Text>
              </Tabs.Trigger>
              <Tabs.Trigger value="AiCoResolve">
                <Text size="1">AI Assist</Text>
              </Tabs.Trigger>
            </Tabs.List>
            <Box className="flex-grow overflow-auto">
              <Suspense fallback={<Spinner />}>
                <Tabs.Content value="suggestedResponse" className="h-full">
                  <CopilotSuggest
                    summary=""
                    moduleName="P1 Co-Resolve"
                    suggestions={suggestions}
                    loading={suggestionsLoading}
                    setActiveCitation={setActiveCitation}
                    setShowCitation={setShowCitation}
                    meeting_id={meetingId}
                    app_id=""
                  />
                </Tabs.Content>
                <Tabs.Content value="AiCoResolve" className="h-full">
                  <IntakeChat
                    transcript={unformattedWebsocketText}
                    meetingId={meetingId}
                    version="v1"
                    userDetails={{
                      fullName: '',
                      mobilePhone: '',
                      email: '',
                      employeeId: '',
                    }}
                    app_id=""
                    agentName="P1 Co-Resolve"
                  />
                </Tabs.Content>
              </Suspense>
            </Box>
          </Tabs.Root>
        </Box>
      </Flex>

      {showCitation && !!activeCitation && (
        <Suspense fallback={<Spinner />}>
          <PDFModal
            onClose={() => setShowCitation(false)}
            url={activeCitation}
          />
        </Suspense>
      )}
    </Flex>
  );
}

export default withAuth(P1Copilot);
