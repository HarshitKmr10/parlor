import React from 'react';
import { Box, Flex, Text, Button } from '@radix-ui/themes';
import HtmlText from 'components/HtmlText/HtmlText';
import AIChatIcon from 'components/icons/AIChatIcon';
import MarkDownText from 'components/MarkDownText/MarkDownText';

interface Props {
  error: string;
  onRetry: () => void;
  assistantName: string;
}

export function AnswerError({ error, onRetry, assistantName }: Props) {
  return (
    <div className="flex flex-col items-stretch gap-4 sm:px-0">
      <Box pb="3" className="border-b border-[var(--accent-3)] py-2">
        <Flex gap="2">
          {/* Hide icon on mobile */}
          <div className="hidden md:block">
            <AIChatIcon />
          </div>

          <Flex direction="column">
            <Flex gap="2">
              {/* Hide assistant name on mobile */}
              <Text
                size="2"
                weight="bold"
                className="hidden md:block"
                style={{ color: 'var(--pink-9)' }}
              >
                {assistantName}
              </Text>
              {/* <Badge variant="surface">AI Generated</Badge> */}
            </Flex>
            <MarkDownText value={error.toString()} />
            <Flex>
              <Button onClick={onRetry} color="red">
                Retry
              </Button>
            </Flex>
          </Flex>
        </Flex>
      </Box>
    </div>
  );
}
