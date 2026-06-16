import React from 'react';
import { Box, Flex, Text, Avatar } from '@radix-ui/themes';
import clsx from 'clsx';
import MarkDownText from 'components/MarkDownText/MarkDownText';

function Question({
  content,
  userName,
  profilePic,
  extra,
  hideNoContent
}: {
  content: string;
  userName: string;
  profilePic?: string;
  extra?: string;
  hideNoContent?: boolean;
}) {
  const generateFallback = (name: string): string => {
    if (!name) return '?';
    const names = name.trim().split(' ');
    return names.length === 1
      ? names[0][0].toUpperCase()
      : `${names[0][0]}${names[1][0]}`.toUpperCase();
  };
  const fallbackText = generateFallback(userName);

  // If hideNoContent is true and content is empty, don't render anything
  if (hideNoContent && !content) {
    return null;
  }

  return (
    <Box className={clsx(extra, 'bg-[var(--accent-3)] p-2')}>
      <Flex gap="2">
        {/* Hide on mobile, show on md+ */}
        <div className="hidden md:block">
          <Avatar
            size="2"
            src={profilePic}
            fallback={fallbackText}
            radius="medium"
            variant="solid"
          />
        </div>
        
        <Flex direction="column" minWidth="0">
          {/* Hide on mobile, show on md+ */}
          <Text
            size="2"
            weight="bold"
            className="hidden md:block"
            style={{ color: 'var(--pink-9)' }}
          >
            You
          </Text>

          <MarkDownText value={content || 'No content provided'} />
        </Flex>
      </Flex>
    </Box>
  );
}

export default Question;
