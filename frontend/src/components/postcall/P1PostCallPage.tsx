import { Flex, Box } from '@radix-ui/themes';
import React from 'react';
import { Meeting } from 'types/meetingTypes';
import PostCallPanel from './PostCallPanel';
import P1PostCallCallingInfo from './P1PostCallCallingInfo';

interface P1PostCallProps {
  meeting: Meeting;
  loading: boolean;
  entityData: string;
  sentimentData: string;
  summaryData: string;
  transcriptData: string;
}

function P1PostCallPage({
  meeting,
  loading,
  entityData,
  sentimentData,
  summaryData,
  transcriptData,
}: P1PostCallProps) {
  return (
    <Flex direction="column" className="h-full">
      <Box className="flex-shrink-0">
        <P1PostCallCallingInfo
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
          meetingName={meeting?.title}
          meetingDate={meeting?.start_timestamp}
          meetingId={meeting?.meeting_id}
          agentName="P1 Co-Resolve"
        />
      </Box>

    </Flex>
  );
}

export default P1PostCallPage;
