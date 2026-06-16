'use client';

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Spinner from 'components/spinner/spinner';
import withAuth from 'components/withAuth';
import {
  Flex, Box, Text, Tabs,
} from '@radix-ui/themes';
import usePostcallDetails from 'hooks/usePostcallDetails';
import PostCallChat from 'components/postcall/PostCallChat';
import useP1MeetingDetails from 'hooks/useP1MeetingDetails';
import P1PostCallPage from 'components/postcall/P1PostCallPage';
import { useOrganizationConfig } from 'hooks/useOrganizationConfig';
import useUserAndRelatedData from 'hooks/useUserAndRelatedData';

function PostCall() {
  const searchParams = useSearchParams();
  const meetingId = searchParams.get('meetingId');
  const [selectedTab, setSelectedTab] = useState('AICoResolve');

  const {
    config,
    loading: configLoading,
    error: configError,
  } = useOrganizationConfig();
  const {
    isUserLoading,
    meeting,
    // userDetails,
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
    entityData,
    sentimentData,
    summaryData,
    transcriptData,
    chatMessages,
    isLoadingDetails,
    isLoadingChat,
    error: postcallDetailsError,
  } = usePostcallDetails(meetingId);

  if (isLoadingDetails || isUserLoading || configLoading) {
    return <Spinner />;
  }

  const errors = [postcallDetailsError, userError, configError].filter(Boolean);
  if (errors.length > 0) {
    throw errors[0];
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
            P1 Postcall
          </Text>
        </Flex>
      </Box>
      <Flex className="flex-grow overflow-hidden">
        <Box className="w-3/4">
          <P1PostCallPage
            meeting={meeting}
            loading={isLoadingDetails}
            entityData={entityData}
            sentimentData={sentimentData}
            summaryData={summaryData}
            transcriptData={transcriptData}
          />
        </Box>

        <Box className="w-1/4 min-w-64 border-l border-[var(--gray-8)] flex flex-col">
          <Tabs.Root
            value={selectedTab}
            onValueChange={setSelectedTab}
            className="flex flex-col h-full"
          >
            <Tabs.List className="flex-shrink-0 ">
              <Tabs.Trigger value="AICoResolve">
                <Text size="1">AI Assist</Text>
              </Tabs.Trigger>
            </Tabs.List>
            <Box className="flex-grow overflow-auto">
              <Tabs.Content value="AICoResolve" className="h-full">
                <PostCallChat
                  key={chatMessages?.length ?? 0} // Force re-render when chatMessages changes
                  chatMessages={chatMessages ?? []}
                  meetingId={meetingId ?? ''}
                  transcriptData={transcriptData}
                  loading={isLoadingChat}
                  userDetails={{
                    fullName: '',
                    mobilePhone: '',
                    email: '',
                    employeeId: '',
                  }}
                  version="v1"
                  app_id=""
                  agentName="P1 Co-Resolve"
                />
              </Tabs.Content>
            </Box>
          </Tabs.Root>
        </Box>
      </Flex>
    </Flex>
  );
}

export default withAuth(PostCall);
