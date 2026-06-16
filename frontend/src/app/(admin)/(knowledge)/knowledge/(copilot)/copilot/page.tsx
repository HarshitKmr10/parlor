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

import { useOrganizationConfig } from 'hooks/useOrganizationConfig';
import useUserAndRelatedData from 'hooks/useUserAndRelatedData';
import useWebSocket from 'hooks/useWebSocket';
import useMeetingDuration from 'hooks/useMeetingDuration';
import { useGlobalContext } from 'contexts/store';
import { ArrowLeftIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';

// Dynamically imported components
const CopilotPage = dynamic(() => import('components/copilot/CopilotPage'), {
  loading: () => <Spinner />,
});

const IntakeChat = dynamic(() => import('components/knowledgeAssist/IntakeChat'), {
  loading: () => <Spinner />,
});

function KnowledgeCopilot() {
  const searchParams = useSearchParams();
  const meetingId = searchParams.get('meetingId');
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState('AiCoResolve');
  const [status, setStatus] = useState(null);
  const { organization } = useGlobalContext();

  const {
    config,
    loading: configLoading,
    error: configError,
  } = useOrganizationConfig();
  const {
    isUserLoading,
    meeting,
    userDetails,
    error: userError,
  } = useUserAndRelatedData(
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
  } = useWebSocket(meetingId, meeting, userDetails);

  const duration = useMeetingDuration(meeting, status);

  if (configLoading || isUserLoading) {
    return <Spinner />;
  }
  const errors = [
    configError,
    userError,
    websocketError,
    // suggestionsError,
  ].filter(Boolean);
  if (errors.length > 0) {
    throw errors[0];
  }

  return (
    <Flex direction="column" className="h-full">
      <Box className="flex-shrink-0">
        <Flex
          align="center"
          gap="2"
          className="h-12 border-b border-[var(--gray-8)] bg-[var(--color-background)]"
          px="4"
        >
          <ArrowLeftIcon
            className="cursor-pointer"
            onClick={() => router.push('/knowledge/logs')}
          />
          <Text size="4" weight="medium">
            {JSON.parse(organization?.config || '{}').Modules?.knowledge_assist
              ?.name ?? 'Knowledge AI'}
          </Text>
        </Flex>
      </Box>
      <Flex className="flex-grow overflow-hidden">
        <Box className="w-1/3">
          <Suspense fallback={<Spinner />}>
            <CopilotPage
              meeting={meeting}
              userDetails={userDetails}
              transcript={websocketText}
              duration={duration}
              setStatus={setStatus}
              type="KnowledgeAssist"
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
              <Tabs.Trigger value="AiCoResolve">
                <Text size="1">AI Assist</Text>
              </Tabs.Trigger>

            </Tabs.List>
            <Box className="flex-grow overflow-auto">


              <Suspense fallback={<Spinner />}>

                <Tabs.Content value="AiCoResolve" className="h-full">
                  <IntakeChat
                    transcript={unformattedWebsocketText}
                    meetingId={meetingId}
                    version={config?.version_knowledge || 'v1'}
                    userDetails={{
                      fullName: '',
                      mobilePhone: '',
                      email: '',
                      employeeId: '',
                    }}
                  />
                </Tabs.Content>
              </Suspense>
            </Box>
          </Tabs.Root>
        </Box>
      </Flex>

    </Flex>
  );
}

export default withAuth(KnowledgeCopilot);
