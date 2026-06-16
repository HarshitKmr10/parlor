import React, { useEffect, useRef } from 'react';
import { Box, Tabs, Flex } from '@radix-ui/themes';
import RealTimeTranscriptComponent from './RealTimeTranscriptComponent';

interface TranscriptItem {
  content: string;
  timestamp: string;
  isPartial: boolean;
  userName: string;
}

interface CopilotPanelProps {
  transcript: TranscriptItem[];
  userName: string;
  extra?: string;
}

function CopilotPanel({ transcript, userName, extra }: CopilotPanelProps) {
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [transcript]);

  // Filter out the last item if its content is empty
  const filteredTranscript = transcript.filter((item, index) => {
    if (index === transcript.length - 1) {
      return item.content !== '';
    }
    return true;
  });

  return (
    <Flex direction="column" className={`h-full ${extra}`}>
      <Tabs.Root defaultValue="transcript" className="flex flex-col h-full">
        <Box className="flex-shrink-0 bg-[var(--color-background)]">
          <Tabs.List>
            <Tabs.Trigger value="transcript">Realtime Transcript</Tabs.Trigger>
          </Tabs.List>
        </Box>

        <Tabs.Content
          value="transcript"
          className="flex-grow overflow-y-auto bg-[var(--color-background)]"
        >
          {filteredTranscript.map((line, index) => (
            <RealTimeTranscriptComponent
              key={index}
              content={line.content}
              userName={line.userName}
              profilePic={null}
              extra={`pt-1 border-b ${line.isPartial ? 'text-gray-400' : ''}`}
              title={line.userName}
              timestamp={line.timestamp}
            />
          ))}
          <div ref={transcriptEndRef} />
        </Tabs.Content>
      </Tabs.Root>
    </Flex>
  );
}

CopilotPanel.defaultProps = {
  extra: '',
};

export default CopilotPanel;
