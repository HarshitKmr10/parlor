import { Flex, Box } from '@radix-ui/themes';
import React from 'react';
import { useTranslation } from 'react-i18next';
import CallingHeader from 'components/copilot/CallingHeader';
import { UserDetails } from 'types/common';
import { Meeting } from 'types/meetingTypes';
import PostCallCallingInfo from './PostCallCallingInfo';
import PostCallPanel from './PostCallPanel';

interface PostCallProps {
  meeting: Meeting;
  userDetails: UserDetails;
  loading: boolean;
  entityData: string;
  sentimentData: string;
  summaryData: string;
  transcriptData: string;
  showSentiments?: boolean;
}

function PostCallPage({
  meeting,
  userDetails,
  loading,
  entityData,
  sentimentData,
  summaryData,
  transcriptData,
  showSentiments = true,
}: PostCallProps) {
  const { t } = useTranslation();
  return (
    <Flex direction="column" className="h-full">
      {(meeting?.channel === 'Phone' || meeting?.channel === t('voice_copilot.phone')) && (
        <Box className="flex-shrink-0 p-1">
          <CallingHeader
            userName={userDetails.fullName}
            userSysId={userDetails.employeeId}
            userEmail={userDetails.email}
            userPhone={userDetails.mobilePhone}
            meetingStartTime={meeting?.start_timestamp}
            employeeNumber={userDetails.employeeNumber}
          />
        </Box>
      )}
      <Box className="flex-shrink-0">
        <PostCallCallingInfo
          userName={userDetails.fullName}
          userPhone={userDetails.mobilePhone}
          userSysId={userDetails.employeeId}
          incomingOrOutgoing={
            meeting?.title.startsWith('Incoming Call') || meeting?.title.startsWith(t('voice_copilot.incomingCall')) ? t('voice_copilot.incoming') : t('voice_copilot.outgoing')
          }
          meetingEndTime={meeting?.end_timestamp}
          recordingUrl={meeting?.call_recording_url}
          meetingStartTime={meeting?.start_timestamp}
          channel={meeting?.channel}
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
          agentName={t('voice_copilot.voiceCoResolve')}
          callerName={userDetails?.fullName}
          showSentiments={showSentiments}
        />
      </Box>

    </Flex>
  );
}

export default PostCallPage;
