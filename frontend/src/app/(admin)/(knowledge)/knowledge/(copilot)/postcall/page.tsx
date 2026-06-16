'use client';

import React, { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import Spinner from 'components/spinner/spinner';
import withAuth from 'components/withAuth';
import {
  Flex, Box, Text, Tabs,
} from '@radix-ui/themes';
import KnowledgeTransitionPostCallPage from 'components/postcall/KnowledgeTransitionPostCallPage';
import usePostcallDetails from 'hooks/usePostcallDetails';
import KnowledgePostCallChat from 'components/knowledgeAssist/KnowledgePostCallChat';
import { useOrganizationConfig } from 'hooks/useOrganizationConfig';
import useUserAndRelatedData from 'hooks/useUserAndRelatedData';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { ArrowLeftIcon } from 'lucide-react';
import { useGlobalContext } from 'contexts/store';

function PostCall() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const meetingId = searchParams.get('meetingId');
  const [selectedTab, setSelectedTab] = useState('AiCoResolve');
  const [translationsLoaded, setTranslationsLoaded] = useState(false);

  const {
    config,
    loading: configLoading,
    error: configError,
  } = useOrganizationConfig();
  const { organization } = useGlobalContext();
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
    postcallTopics,
    isLoadingPostcallTopics,
    setPostcallTopics,
  } = usePostcallDetails(meetingId);

  const router = useRouter();

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
        <Box className="w-3/4">
          <KnowledgeTransitionPostCallPage
            meeting={meeting}
            loading={isLoadingDetails}
            entityData={entityData}
            sentimentData={sentimentData}
            summaryData={summaryData}
            transcriptData={transcriptData}
            type="KnowledgeAssist"
            postcallTopics={postcallTopics}
            isLoadingPostcallTopics={isLoadingPostcallTopics}
            setPostcallTopics={setPostcallTopics}
          />
        </Box>

        <Box className="w-1/4 min-w-64 border-l border-[var(--gray-8)] flex flex-col">
          <Tabs.Root
            value={selectedTab}
            onValueChange={setSelectedTab}
            className="flex flex-col h-full"
          >
            <Tabs.List className="flex-shrink-0 ">
              <Tabs.Trigger value="AiCoResolve">
                <Text size="1">AI Assist</Text>
              </Tabs.Trigger>
            </Tabs.List>
            <Box className="flex-grow overflow-auto">
              <Tabs.Content value="AiCoResolve" className="h-full">
                <KnowledgePostCallChat
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
                  version={config?.version_knowledge || 'v1'}
                  assistantName={"Knowledge Assist"}
                />
              </Tabs.Content>
            </Box>
          </Tabs.Root>
        </Box>
      </Flex>
      <ToastContainer />
    </Flex>
  );
}

export default withAuth(PostCall);
