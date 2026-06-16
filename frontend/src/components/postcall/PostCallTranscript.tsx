import React, { useEffect, useRef } from 'react';
import {
  Box, Flex, Text,
} from '@radix-ui/themes';
import CustomAvatar from 'components/CustomAvatar';

function PostCallTranscript({ transcript, loading }) {
  const transcriptEndRef = useRef(null);

  const scrollToBottom = () => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [transcript]);

  if (loading) {
    return (
      <Box>
        {[...Array(3)].map((_, index) => (
          <Box key={index} className="border-b bg-[var(--accent-3)] py-2">
            <Flex gap="2">
              <Box className="ml-3">
                <div
                  className="loading-skeleton"
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent-4)',
                  }}
                />
              </Box>
              <Flex direction="column" width="100%">
                <Flex gap="2">
                  <div
                    className="loading-skeleton"
                    style={{
                      width: '100px',
                      height: '16px',
                      backgroundColor: 'var(--accent-4)',
                      borderRadius: 'var(--radius-2)',
                    }}
                  />
                </Flex>
                <div
                  className="loading-skeleton"
                  style={{
                    width: '100%',
                    height: '16px',
                    backgroundColor: 'var(--accent-4)',
                    borderRadius: 'var(--radius-2)',
                    marginTop: '8px',
                  }}
                />
              </Flex>
            </Flex>
          </Box>
        ))}
      </Box>
    );
  }

  return (

    <Box>
      {transcript.map((item, index) => (
        <Box key={index} className="border-b bg-[var(--accent-3)] py-2">
          <Flex gap="2">
            <Box className="ml-3">
              <CustomAvatar
                src={null}
                name={item.user}
                alt="profile"
                height="24px"
                width="24px"
              />
            </Box>
            <Flex direction="column">
              <Flex gap="2">
                <Text size="2" weight="bold" style={{ color: 'var(--pink-9)' }}>
                  {item.user}
                </Text>
              </Flex>
              <Text size="2">{item.content}</Text>
            </Flex>
          </Flex>
        </Box>
      ))}
      <div ref={transcriptEndRef} />
    </Box>

  );
}

export default PostCallTranscript;
