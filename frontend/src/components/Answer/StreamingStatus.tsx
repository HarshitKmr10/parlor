import React from 'react';
import { Box, Flex, Text } from '@radix-ui/themes';
import AIChatIcon from 'components/icons/AIChatIcon';
import { Loader2, Database, Brain, Sparkles, Search } from 'lucide-react';

export type StreamingStage = 'initializing' | 'analyzing' | 'retrieving' | 'generating' | 'streaming';

interface StreamingStatusProps {
  assistantName: string;
  stage: StreamingStage;
  message?: string;
}

const stageConfig: Record<StreamingStage, { icon: React.ReactNode; defaultMessage: string; color: string }> = {
  initializing: {
    icon: <Database className="h-4 w-4" />,
    defaultMessage: 'Loading organization data...',
    color: 'var(--blue-9)',
  },
  analyzing: {
    icon: <Brain className="h-4 w-4" />,
    defaultMessage: 'Analyzing your request...',
    color: 'var(--violet-9)',
  },
  retrieving: {
    icon: <Search className="h-4 w-4" />,
    defaultMessage: 'Searching knowledge base...',
    color: 'var(--orange-9)',
  },
  generating: {
    icon: <Sparkles className="h-4 w-4" />,
    defaultMessage: 'Generating response...',
    color: 'var(--pink-9)',
  },
  streaming: {
    icon: <Sparkles className="h-4 w-4" />,
    defaultMessage: 'Generating response...',
    color: 'var(--pink-9)',
  },
};

export function StreamingStatus({ assistantName, stage, message }: StreamingStatusProps) {
  const config = stageConfig[stage] || stageConfig.initializing;
  const displayMessage = message || config.defaultMessage;

  return (
    <Box className="items-stretch sm:px-0 flex flex-col gap-4 px-2 md:px-2">
      <Box className="border-b border-[var(--accent-3)] py-2 pr-2">
        <Flex gap="2">
          <div className="hidden md:block">
            <AIChatIcon />
          </div>

          <Flex direction="column" className="w-full">
            <Flex gap="2">
              <Text
                size="2"
                weight="bold"
                className="hidden md:block"
                style={{ color: 'var(--pink-9)' }}
              >
                {assistantName}
              </Text>
            </Flex>

            <Flex align="center" gap="2" className="py-2">
              <Flex
                align="center"
                justify="center"
                className="animate-pulse"
                style={{ color: config.color }}
              >
                {config.icon}
              </Flex>
              <Text size="2" style={{ color: 'var(--gray-11)' }}>
                {displayMessage}
              </Text>
              <Loader2 className="h-3 w-3 animate-spin" style={{ color: 'var(--gray-9)' }} />
            </Flex>

            {/* Progress indicator */}
            <Flex gap="1" className="mt-1">
              {(['initializing', 'analyzing', 'retrieving', 'generating'] as StreamingStage[]).map((s, idx) => {
                const stages = ['initializing', 'analyzing', 'retrieving', 'generating'];
                const currentIdx = stages.indexOf(stage);
                const isCompleted = idx < currentIdx;
                const isCurrent = s === stage;

                return (
                  <Box
                    key={s}
                    className="h-1 flex-1 rounded-full transition-all duration-300"
                    style={{
                      backgroundColor: isCompleted
                        ? 'var(--green-9)'
                        : isCurrent
                          ? config.color
                          : 'var(--gray-4)',
                      opacity: isCurrent ? 1 : isCompleted ? 0.8 : 0.4,
                    }}
                  />
                );
              })}
            </Flex>
          </Flex>
        </Flex>
      </Box>
    </Box>
  );
}
