import React from 'react';
import { Box, Flex } from '@radix-ui/themes';
import { UserDetails } from 'types/common';
import { Meeting } from 'types/meetingTypes';
import CopilotPanel from './CopilotPanel';
import CallingHeader from './CallingHeader';
import CopilotCallingInfo from './CopilotCallingInfo';

interface CopilotProps {
  meeting: Meeting;
  userDetails: UserDetails;
  transcript: TranscriptItem[];
  duration: string;
  setStatus: React.Dispatch<React.SetStateAction<string>>;
  type?: 'Copilot' | 'P1' | 'KnowledgeAssist';
}

interface TranscriptItem {
  content: string;
  timestamp: string;
  isPartial: boolean;
  userName: string;
}

function CopilotPage({
  meeting,
  userDetails,
  transcript,
  duration,
  setStatus,
  type = 'Copilot',
}: CopilotProps) {
  return (
    <Flex direction="column" className="h-full">
      {meeting?.channel === 'Phone' && (
        <Box className="flex-shrink-0 p-1">
          <CallingHeader
            userName={userDetails.fullName}
            userSysId={userDetails.employeeId}
            userEmail={userDetails.email}
            userPhone={userDetails.mobilePhone}
            meetingStartTime={meeting?.start_timestamp}
          />
        </Box>
      )}
      <Box className="flex-shrink-0">
        <CopilotCallingInfo
          userName={userDetails.fullName}
          userPhone={userDetails.mobilePhone}
          userSysId={userDetails.employeeId}
          incomingOrOutgoing={
            meeting?.title.startsWith('Incoming Call') ? 'Incoming' : 'Outgoing'
          }
          meetingId={meeting?.meeting_id}
          channel={meeting?.channel}
          title={meeting?.title || ''}
          link={meeting?.link}
          duration={duration}
          type={type}
          setStatus={setStatus}
        />
      </Box>
      <Box className="flex-grow overflow-auto bg-[var(--accent-2)]">
        <CopilotPanel transcript={transcript} userName={userDetails.fullName} />
      </Box>
    </Flex>
  );
}

export default CopilotPage;
