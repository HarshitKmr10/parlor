import { Flex, Box } from '@radix-ui/themes';
import React from 'react';
import { Meeting } from 'types/meetingTypes';
import KnowledgeTransitionPostCallCallingInfo from './KnowledgeTransitionPostCallCallingInfo';
import PostCallPanel from './PostCallPanel';
import { PostcallTopic } from 'types/postcallTopicTypes';

interface PostCallProps {
  meeting: Meeting;
  loading: boolean;
  entityData: string;
  sentimentData: string;
  summaryData: string;
  transcriptData: string;
  type?: 'PostCall' | 'P1' | 'KnowledgeAssist';
  postcallTopics: PostcallTopic[];
  isLoadingPostcallTopics: boolean;
  setPostcallTopics: (topics: PostcallTopic[]) => void;
}

function KnowledgeTransitionPostCallPage({
  meeting,
  loading,
  entityData,
  sentimentData,
  summaryData,
  transcriptData,
  type = 'KnowledgeAssist',
  postcallTopics,
  isLoadingPostcallTopics,
  setPostcallTopics,
}: PostCallProps) {
  return (
    <Flex direction="column" className="h-full">
      <Box className="flex-shrink-0">
        <KnowledgeTransitionPostCallCallingInfo
          meetingEndTime={meeting?.end_timestamp}
          recordingUrl={meeting?.call_recording_url}
          meetingStartTime={meeting?.start_timestamp}
          title={meeting?.title}
          link={meeting?.link}
          meetingId={meeting?.meeting_id}
        />
      </Box>
      <Box className="flex-grow overflow-auto bg-[var(--accent-2)]">
        <PostCallPanel
          entity={entityData}
          summary={summaryData}
          transcript={transcriptData}
          sentiment={sentimentData}
          loading={loading}
          type={type}
          meetingId={meeting?.meeting_id}
          meetingName={meeting?.title}
          meetingDate={meeting?.start_timestamp}
          postcallTopics={postcallTopics}
          isLoadingPostcallTopics={isLoadingPostcallTopics}
          setPostcallTopics={setPostcallTopics}
          agentName='Knowledge Assist'
        />
      </Box>
    </Flex>
  );
}

export default KnowledgeTransitionPostCallPage;
