import React from 'react';
import { Box, Flex, Text } from '@radix-ui/themes';
import AIChatIcon from 'components/icons/AIChatIcon';

export function CustomAnswerCard({
  assistantName,
  children,
}: {
  assistantName: string;
  children: React.ReactNode;
}) {
  return (
    <Box className="items-stretch sm:px-0 flex flex-col gap-4">
      <Box className="border-b border-[var(--accent-3)] py-2">
        <Flex gap="2">
          {/* Hide AIChatIcon on mobile */}
          <div className="hidden md:block">
            <AIChatIcon />
          </div>

          <Flex direction="column" className="w-full px-2">
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
            </Flex>
            {children}
          </Flex>
        </Flex>
      </Box>
    </Box>
  );
}