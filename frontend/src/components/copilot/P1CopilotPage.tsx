import React from 'react';
import { Box, Flex } from '@radix-ui/themes';
import { Meeting } from 'types/meetingTypes';
import CopilotPanel from './CopilotPanel';
import P1CopilotCallingInfo from './P1CopilotCallingInfo';

interface CopilotProps {
  duration: string;
  meeting: Meeting;
  transcript: TranscriptItem[];
  setStatus: React.Dispatch<React.SetStateAction<string>>;
}

interface TranscriptItem {
  content: string;
  timestamp: string;
  isPartial: boolean;
  userName: string;
}

function P1CopilotPage({
  meeting, transcript, duration, setStatus,
}: CopilotProps) {
  return (
    <Flex direction="column" className="h-full">
      <Box className="flex-shrink-0">
        <P1CopilotCallingInfo
          meetingId={meeting?.meeting_id}
          channel={meeting?.channel}
          title={meeting?.title}
          link={meeting?.link}
          duration={duration}
          setStatus={setStatus}
        />
      </Box>
      <Box className="flex-grow overflow-auto bg-[var(--accent-2)]">
        <CopilotPanel transcript={transcript} userName="" />
      </Box>
    </Flex>
  );
}

export default P1CopilotPage;
