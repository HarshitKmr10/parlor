import React from 'react';
import { Box, Flex, Text } from '@radix-ui/themes';
import AIChatIcon from 'components/icons/AIChatIcon';

function SuggestionsIsLoading({ loading = true }) {
  if (!loading) return null;

  return (
    <div className="items-stretch sm:px-0 flex flex-col gap-4 overflow-hidden">
      <Box className="border-b border-[var(--accent-3)]" pb="4">
        <Flex gap="2" mt="2">
          <AIChatIcon />
          <Flex direction="column" width="100%" pr="4">
            <Flex gap="2">
              <Text size="2" weight="bold" style={{ color: 'var(--pink-9)' }}>
                Voice Co-Resolve
              </Text>
            </Flex>
            <Flex direction="column" gap="2" mt="3">
              <Box
                className="loading-skeleton"
                style={{
                  height: '10px',
                  width: '33%',
                  backgroundColor: 'var(--accent-4)',
                  borderRadius: 'var(--radius-2)',
                }}
              />
              <Box
                className="loading-skeleton"
                style={{
                  height: '10px',
                  width: '100%',
                  backgroundColor: 'var(--accent-4)',
                  borderRadius: 'var(--radius-2)',
                }}
              />
              <Box
                className="loading-skeleton"
                style={{
                  height: '10px',
                  width: '95%', // Slightly reduced to prevent sticking to the right edge
                  backgroundColor: 'var(--accent-4)',
                  borderRadius: 'var(--radius-2)',
                }}
              />
            </Flex>
          </Flex>
        </Flex>
      </Box>
    </div>
  );
}

export default SuggestionsIsLoading;
