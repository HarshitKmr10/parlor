'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import Spinner from 'components/spinner/spinner';
import withAuth from 'components/withAuth';
import {
  Flex, Box, Text, Tabs, IconButton,
} from '@radix-ui/themes';
import { ArrowLeft } from 'lucide-react';
import { useGlobalContext } from 'contexts/store';
import { useOrganizationConfig } from 'hooks/useOrganizationConfig';
import useUserAndRelatedData from 'hooks/useUserAndRelatedData';
import PostCallPage from 'components/postcall/PostCallPage';
import usePostcallDetails from 'hooks/usePostcallDetails';
import PostCallChat from 'components/postcall/PostCallChat';

function PostCall() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();
  const meetingId = searchParams.get('meetingId');
  const showSideBar = searchParams.get('showSideBar');
  const { organization } = useGlobalContext();
  const [selectedTab, setSelectedTab] = useState('AiCoResolve');
  const [useSnowUI, setUseSnowUI] = useState<boolean>(false);
  const [showSentiments, setShowSentiments] = useState<boolean>(true);

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
    entityData,
    sentimentData,
    summaryData,
    transcriptData,
    chatMessages,
    isLoadingDetails,
    isLoadingChat,
    error: postcallDetailsError,
  } = usePostcallDetails(meetingId);

  useEffect(() => {
    if (!organization?.config || !meetingId) {
      return;
    }

    try {
      const orgConfig = JSON.parse(organization.config);
      const voiceCopilot = orgConfig.Modules?.voice_copilot?.features;
      const snowUI = voiceCopilot?.useSnowUI?.enabled || false;
      const sentiments = voiceCopilot?.showSentiments?.enabled !== false;
      setUseSnowUI(snowUI);
      setShowSentiments(sentiments);

      const params = new URLSearchParams(searchParams.toString());
      
      if (snowUI && showSideBar !== 'false') {
        params.set('showSideBar', 'false');
        router.replace(`/postcall?${params.toString()}`, { scroll: false });
      } else if (!snowUI && showSideBar === 'false') {
        params.delete('showSideBar');
        router.replace(`/postcall?${params.toString()}`, { scroll: false });
      }
    } catch (e) {
      console.error('Error parsing organization config:', e);
    }
  }, [organization, meetingId, showSideBar, searchParams, router]);

  const handleBackClick = () => {
    if (useSnowUI) {
      router.push('/calls?showCall=true&showSideBar=false');
    } else {
      router.push('/calls?showCall=true');
    }
  };

  if (configLoading || isUserLoading || isLoadingDetails) {
    return <Spinner />;
  }

  const errors = [userError, configError, postcallDetailsError].filter(Boolean);
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
          <Flex align="center" gap="3">
            <IconButton
              variant="ghost"
              onClick={handleBackClick}
              className="cursor-pointer"
              size="3"
            >
              <ArrowLeft size={20} />
            </IconButton>
            <Text size="4" weight="medium">
              {t('voice_copilot.callPostcall')}
            </Text>
          </Flex>
        </Flex>
      </Box>
      <Flex className="flex-grow overflow-hidden">
        <Box className="w-3/4">
          <PostCallPage
            meeting={meeting}
            userDetails={userDetails}
            loading={isLoadingDetails}
            entityData={entityData}
            sentimentData={sentimentData}
            summaryData={summaryData}
            transcriptData={transcriptData}
            showSentiments={showSentiments}
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
                <Text size="1">{t('voice_copilot.aiAssist')}</Text>
              </Tabs.Trigger>
            </Tabs.List>
            <Box className="flex-grow overflow-auto">
              <Tabs.Content value="AiCoResolve" className="h-full">
                <PostCallChat
                  key={chatMessages?.length ?? 0}
                  chatMessages={chatMessages ?? []}
                  meetingId={meetingId ?? ''}
                  transcriptData={transcriptData}
                  loading={isLoadingChat}
                  userDetails={userDetails}
                  version={config?.version_copilot || 'v1'}
                  app_id="voice_copilot_chat_assist"
                  agentName={t('voice_copilot.voiceCoResolve')}
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
