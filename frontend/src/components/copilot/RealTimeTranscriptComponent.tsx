import React from 'react';
import { Box, Flex, Text, Avatar } from '@radix-ui/themes';
import HtmlText from 'components/HtmlText/HtmlText';
import MarkDownText from 'components/MarkDownText/MarkDownText';

function RealTimeTranscriptComponent({
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
      <Flex gap="2" mt="2">
        <Box style={{ flexShrink: 0, width: '26px', marginLeft: '12px' }}>
          <Avatar
            size="2"
            variant="solid"
            src={profilePic || undefined}
            fallback={fallbackText}
            radius="medium"
          />
        </Box>

        <Flex direction="column" pb="2" style={{ flexGrow: 1, minWidth: 0 }}>
          <Flex gapX="2" align="center">
            {title.length > 0 && (
              <Text size="2" weight="bold" style={{ color: 'var(--pink-9)' }}>
                {title}
              </Text>
            )}
            <Text size="1" weight="medium" style={{ color: 'var(--gray-9)' }}>
              {timestamp}
            </Text>
          </Flex>
          <MarkDownText value={content || 'No content provided'} />
        </Flex>
      </Flex>
    </Box>
  );
}

export default RealTimeTranscriptComponent;