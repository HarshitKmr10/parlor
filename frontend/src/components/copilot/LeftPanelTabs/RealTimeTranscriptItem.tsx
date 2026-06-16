import React from 'react';
import { Box, Flex, Text, Avatar } from '@radix-ui/themes';
import MarkDownText from 'components/MarkDownText/MarkDownText';

function RealTimeTranscriptItem({
  content,
  userName,
  profilePic,
  title,
  timestamp,
  extra,
}: {
  content: string;
  userName: string;
  profilePic?: string | null;
  title: string;
  timestamp?: string;
  extra?: string;
}) {
  const generateFallback = (name: string): string => {
    if (!name) return '?';
    const names = name.trim().split(' ');
    return names.length === 1
      ? names[0][0].toUpperCase()
      : `${names[0][0]}${names[1][0]}`.toUpperCase();
  };
  const fallbackText = generateFallback(userName);

  return (
    <Box style={{ background: 'var(--accent-3)' }} className={extra}>
      <Flex gap="2" mt="2" className='px-3'>
        <Box style={{ flexShrink: 0 }}>
          <Avatar
            size="1"
            variant="solid"
            src={profilePic || undefined}
            fallback={fallbackText}
            radius="medium"
          />
        </Box>

        <Flex gapY="0.5" direction="column" pb="2" style={{ flexGrow: 1, minWidth: 0 }}>
          <Flex gapX="1" align="center">
            {title.length > 0 && (
              <Text size="2" weight="bold" style={{ color: 'var(--pink-9)' }}>
                {title}
              </Text>
            )}
            <Text size="2" weight="regular" className='text-neutral-alpha'>
              {timestamp}
            </Text>
          </Flex>
          <MarkDownText value={content || 'No content provided'} />
        </Flex>
      </Flex>
    </Box>
  );
}

export default RealTimeTranscriptItem;